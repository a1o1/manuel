"""
Manuel - Query Function (Enhanced Security Version)
RAG query processing with comprehensive security hardening
"""

import base64
import hashlib
import json
import os

# Import security middleware
import sys
import time
import uuid
from typing import Any, Dict, Optional

import boto3

sys.path.append("/opt/python")  # Lambda layer path
sys.path.append("../../../shared")  # Local development path

try:
    from input_validation import InputType, InputValidator, ValidationRule
    from security_headers import SecurityLevel, security_headers
    from security_middleware import security_middleware

    SECURITY_AVAILABLE = True
except ImportError:
    # Fallback for minimal deployment
    print("Security modules not available, using fallback")
    security_headers = lambda level: lambda func: func
    security_middleware = lambda **kwargs: lambda func: func

    class SecurityLevel:
        STRICT = "STRICT"
        MODERATE = "MODERATE"
        PERMISSIVE = "PERMISSIVE"

    class InputType:
        TEXT = "text"
        BASE64 = "base64"

    class ValidationRule:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class InputValidator:
        @staticmethod
        def validate(data, rule):
            return data, True, None

    SECURITY_AVAILABLE = False


def get_cache_client() -> Optional[object]:
    """Get Redis cache client if available"""
    try:
        redis_endpoint = os.environ.get("REDIS_ENDPOINT", "")
        redis_port = os.environ.get("REDIS_PORT", "6379")
        enable_redis = os.environ.get("ENABLE_REDIS_CACHE", "false").lower() == "true"

        if not enable_redis or not redis_endpoint:
            print("Redis cache is disabled or endpoint not configured")
            return None

        import redis

        print(f"Connecting to Redis at {redis_endpoint}:{redis_port}")
        client = redis.Redis(
            host=redis_endpoint,
            port=int(redis_port),
            socket_connect_timeout=5,
            socket_timeout=5,
            decode_responses=True,
        )
        # Test connection
        client.ping()
        print("Redis connection successful")
        return client
    except Exception as e:
        print(f"Redis connection failed: {str(e)}")
        return None


def create_cache_key(question: str, user_id: str) -> str:
    """Create a cache key for the query"""
    # Create hash of question to ensure consistent key length
    question_hash = hashlib.sha256(question.encode()).hexdigest()[:16]
    return f"query:{user_id}:{question_hash}"


def get_cached_response(cache_client: object, cache_key: str) -> Optional[Dict]:
    """Get cached response if available"""
    if not cache_client:
        return None

    try:
        cached_data = cache_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        print(f"Cache read error: {str(e)}")

    return None


def cache_response(
    cache_client: object, cache_key: str, response_data: Dict, ttl: int = 3600
) -> bool:
    """Cache the response with TTL (default 1 hour)"""
    if not cache_client:
        return False

    try:
        # Add cache metadata
        cache_data = {**response_data, "cached_at": time.time(), "cache_ttl": ttl}
        cache_client.setex(cache_key, ttl, json.dumps(cache_data))
        return True
    except Exception as e:
        print(f"Cache write error: {str(e)}")
        return False


def transcribe_audio(audio_data: str, content_type: str) -> str:
    """Transcribe audio using AWS Transcribe"""
    try:
        # Initialize AWS services
        s3_client = boto3.client("s3")
        transcribe_client = boto3.client("transcribe")

        # Create unique names
        job_name = f"transcribe-{uuid.uuid4()}"
        bucket_name = os.environ.get("AUDIO_BUCKET", "manuel-temp-audio")
        audio_key = f"temp-audio/{job_name}.wav"
        
        print(f"DEBUG: Using bucket: {bucket_name}")
        print(f"DEBUG: Audio key: {audio_key}")

        # Decode and upload audio to S3
        audio_bytes = base64.b64decode(audio_data)
        print(f"DEBUG: Audio data length: {len(audio_bytes)} bytes")
        
        put_response = s3_client.put_object(
            Bucket=bucket_name,
            Key=audio_key,
            Body=audio_bytes,
            ContentType=content_type,
        )
        print(f"DEBUG: S3 upload response: {put_response}")

        # Determine audio format from content type
        if "wav" in content_type.lower():
            media_format = "wav"
        elif "mp3" in content_type.lower():
            media_format = "mp3"
        elif "mp4" in content_type.lower() or "m4a" in content_type.lower():
            media_format = "mp4"
        elif "flac" in content_type.lower():
            media_format = "flac"
        else:
            media_format = "wav"  # Default to wav

        # Start transcription job
        audio_uri = f"s3://{bucket_name}/{audio_key}"
        print(f"DEBUG: Audio URI for transcribe: {audio_uri}")
        print(f"DEBUG: Media format: {media_format}")
        
        transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": audio_uri},
            MediaFormat=media_format,
            LanguageCode="en-US",
        )
        print(f"DEBUG: Transcription job started successfully")

        # Poll for completion with shorter intervals for API Gateway timeout
        max_attempts = 6  # 25 seconds max (6 attempts × 4 seconds = 24 seconds)
        for attempt in range(max_attempts):
            response = transcribe_client.get_transcription_job(
                TranscriptionJobName=job_name
            )
            status = response["TranscriptionJob"]["TranscriptionJobStatus"]

            if status == "COMPLETED":
                transcript_uri = response["TranscriptionJob"]["Transcript"][
                    "TranscriptFileUri"
                ]
                # Get the transcript content using urllib (standard library)
                import urllib.request

                with urllib.request.urlopen(transcript_uri) as transcript_response:
                    transcript_data = json.loads(
                        transcript_response.read().decode("utf-8")
                    )

                # Extract the transcribed text
                transcription = transcript_data["results"]["transcripts"][0][
                    "transcript"
                ]

                # Cleanup
                try:
                    s3_client.delete_object(Bucket=bucket_name, Key=audio_key)
                    transcribe_client.delete_transcription_job(
                        TranscriptionJobName=job_name
                    )
                except Exception as cleanup_error:
                    print(f"Cleanup error: {cleanup_error}")

                return transcription

            elif status == "FAILED":
                raise Exception(
                    f"Transcription failed: {response.get('FailureReason', 'Unknown error')}"
                )

            # Wait 4 seconds before next check (shorter for API Gateway timeout)
            time.sleep(4)

        raise Exception("Transcription timeout - please try with a shorter audio clip")

    except Exception as e:
        print(f"Transcription error: {str(e)}")
        # Cleanup on error
        try:
            s3_client.delete_object(Bucket=bucket_name, Key=audio_key)
        except:
            pass
        return ""


# Input validation schemas
QUERY_TEXT_RULE = ValidationRule(
    input_type=InputType.TEXT, min_length=1, max_length=1000, required=True
)

AUDIO_DATA_RULE = ValidationRule(
    input_type=InputType.BASE64,
    max_length=50_000_000,  # ~50MB base64 encoded
    required=False,
)

CONTENT_TYPE_RULE = ValidationRule(
    input_type=InputType.TEXT, max_length=100, required=False
)


@security_middleware(
    rate_limit_requests=50,  # requests per window
    rate_limit_window_minutes=15,  # 15-minute windows
    max_request_size_mb=50,  # Max 50MB for audio
    enable_ip_allowlist=True,
    enable_request_validation=True,
)
@security_headers(SecurityLevel.MODERATE)
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle RAG query requests with enhanced security"""

    try:
        # Get environment variables
        knowledge_base_id = os.environ["KNOWLEDGE_BASE_ID"]
        text_model_id = os.environ["TEXT_MODEL_ID"]
        use_inference_profile = (
            os.environ.get("USE_INFERENCE_PROFILE", "false").lower() == "true"
        )
        retrieval_results = int(os.environ.get("KNOWLEDGE_BASE_RETRIEVAL_RESULTS", "3"))

        # Simple CORS handling
        method = event.get("httpMethod", "POST")
        path = event.get("path", "")

        if method == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                },
                "body": "",
            }

        # Extract user ID from Cognito JWT (simplified)
        user_id = "default-user"  # For testing, we'll use a default user
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        if claims and "sub" in claims:
            user_id = claims["sub"]

        # Parse and validate request body
        body = event.get("body", "{}")
        if isinstance(body, str):
            try:
                body_data = json.loads(body)
            except json.JSONDecodeError:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                    "body": json.dumps({"error": "Invalid JSON in request body"}),
                }
        else:
            body_data = body

        # Extract and validate inputs
        file_data = body_data.get("file_data")
        content_type = body_data.get("content_type")
        question = body_data.get("question")

        # Validate inputs using security middleware (if available)
        if SECURITY_AVAILABLE:
            if file_data:
                # Validate audio data
                file_data, is_valid, error_msg = InputValidator.validate(
                    file_data, AUDIO_DATA_RULE
                )
                if not is_valid:
                    return {
                        "statusCode": 400,
                        "headers": {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*",
                        },
                        "body": json.dumps(
                            {"error": f"Invalid audio data: {error_msg}"}
                        ),
                    }

                # Validate content type
                if content_type:
                    content_type, is_valid, error_msg = InputValidator.validate(
                        content_type, CONTENT_TYPE_RULE
                    )
                    if not is_valid:
                        return {
                            "statusCode": 400,
                            "headers": {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*",
                            },
                            "body": json.dumps(
                                {"error": f"Invalid content type: {error_msg}"}
                            ),
                        }

            # Validate question text
            if question:
                question, is_valid, error_msg = InputValidator.validate(
                    question, QUERY_TEXT_RULE
                )
                if not is_valid:
                    return {
                        "statusCode": 400,
                        "headers": {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*",
                        },
                        "body": json.dumps({"error": f"Invalid question: {error_msg}"}),
                    }
        else:
            # Basic validation when security modules not available
            if question and len(question) > 1000:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                    "body": json.dumps({"error": "Question too long"}),
                }

        # If audio data is provided, transcribe it first
        if file_data and content_type:
            print("Processing audio transcription request")
            question = transcribe_audio(file_data, content_type)
            if not question:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                    "body": json.dumps({"error": "Failed to transcribe audio"}),
                }
        elif not question:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Question or audio data is required"}),
            }

        # Initialize cache client
        cache_client = get_cache_client()
        cache_key = create_cache_key(question, user_id)

        # Try to get cached response first
        cached_response = get_cached_response(cache_client, cache_key)
        if cached_response:
            print(f"Cache HIT for question: {question[:50]}...")
            # Add cache hit indicator to response
            cached_response["cache_status"] = "hit"
            cached_response["response_time_ms"] = 5  # Fast cache response
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps(cached_response),
            }

        print(f"Cache MISS for question: {question[:50]}...")

        # Initialize Bedrock clients
        bedrock_agent_runtime = boto3.client("bedrock-agent-runtime")
        bedrock_runtime = boto3.client("bedrock-runtime")

        # Track query start time for performance metrics
        query_start_time = time.time()

        # Step 1: Retrieve relevant context from Knowledge Base
        print(f"Retrieving context for question: {question}")

        retrieve_response = bedrock_agent_runtime.retrieve(
            knowledgeBaseId=knowledge_base_id,
            retrievalQuery={"text": question},
            retrievalConfiguration={
                "vectorSearchConfiguration": {"numberOfResults": retrieval_results}
            },
        )

        # Extract context from retrieved documents
        context_pieces = []
        sources = []

        for result in retrieve_response.get("retrievalResults", []):
            content = result.get("content", {}).get("text", "")
            if content:
                context_pieces.append(content)

                # Extract source information with proper structure for frontend
                location = result.get("location", {})
                score = result.get("score", 0.0)  # Get confidence score

                if location.get("type") == "S3":
                    s3_location = location.get("s3Location", {})
                    source_uri = s3_location.get("uri", "")
                    if source_uri:
                        # Extract manual name and page number from S3 URI and metadata
                        manual_name = "Unknown Manual"
                        page_number = None

                        # Parse S3 URI to extract manual name
                        if "/manuals/" in source_uri:
                            try:
                                # Extract filename from S3 path
                                filename = source_uri.split("/")[-1]
                                if filename.endswith(".pdf"):
                                    manual_name = filename[:-4]  # Remove .pdf extension

                                # Look for page number in URI fragment
                                if "#page=" in source_uri:
                                    page_part = source_uri.split("#page=")[-1]
                                    page_number = int(page_part.split("&")[0])

                            except (ValueError, IndexError):
                                pass

                        # Extract page number from Bedrock Knowledge Base metadata
                        metadata = result.get("metadata", {})
                        if metadata.get("x-amz-bedrock-kb-document-page-number"):
                            try:
                                page_number = int(
                                    float(
                                        metadata[
                                            "x-amz-bedrock-kb-document-page-number"
                                        ]
                                    )
                                )
                            except (ValueError, TypeError):
                                pass

                        # Create frontend-compatible source object
                        source_obj = {
                            "manual_name": manual_name,
                            "page_number": page_number,
                            "chunk_text": content,
                            "score": score,
                            "pdf_url": None,  # Will be populated by frontend
                            "pdf_id": None,  # Will be populated by frontend
                        }

                        sources.append(source_obj)

        context = "\n\n".join(context_pieces)

        # Step 2: Generate response using Bedrock with context
        prompt = f"""Human: You are a helpful assistant that answers questions based on product manuals and documentation.

Use the following context to answer the user's question. If the context doesn't contain relevant information, say so clearly.

Context:
{context}

Question: {question}

Please provide a clear, helpful answer based on the context provided.

Assistant: I'll help you with that based on the provided context."""

        # Configure model invocation
        if use_inference_profile:
            model_id = text_model_id  # Use inference profile ID
        else:
            model_id = text_model_id

        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": prompt}],
        }

        print(f"Invoking model: {model_id}")

        response = bedrock_runtime.invoke_model(
            modelId=model_id, body=json.dumps(request_body)
        )

        response_body = json.loads(response["body"].read())
        answer = response_body["content"][0]["text"]

        # Calculate response time
        query_end_time = time.time()
        response_time_ms = round((query_end_time - query_start_time) * 1000, 2)

        # Prepare response data
        response_data = {
            "answer": answer,
            "question": question,
            "sources": sources,
            "context_found": len(context_pieces) > 0,
            "user_id": user_id,
            "timestamp": int(time.time()),
            "cache_status": "miss",
            "response_time_ms": response_time_ms,
        }

        # Cache the response for future requests
        cache_success = cache_response(cache_client, cache_key, response_data)
        if cache_success:
            print(f"Response cached successfully for key: {cache_key}")
        else:
            print(f"Failed to cache response for key: {cache_key}")

        # Return successful response
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(response_data),
        }

    except Exception as e:
        print(f"Error processing query: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "error": "Failed to process query",
                    "details": str(e),
                    "timestamp": int(time.time()),
                }
            ),
        }
