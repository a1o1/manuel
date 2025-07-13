"""
Manuel - Query Function (Minimal Version)
Simple RAG query processing without complex dependencies
"""

import base64
import json
import os
import time
import uuid
from typing import Any, Dict

import boto3


def transcribe_audio(audio_data: str, content_type: str) -> str:
    """Transcribe audio using AWS Transcribe"""
    try:
        # Initialize AWS services
        s3_client = boto3.client("s3")
        transcribe_client = boto3.client("transcribe")
        
        # Create unique names
        job_name = f"transcribe-{uuid.uuid4()}"
        bucket_name = os.environ.get("MANUALS_BUCKET", "manuel-temp-audio")
        audio_key = f"temp-audio/{job_name}.wav"
        
        # Decode and upload audio to S3
        audio_bytes = base64.b64decode(audio_data)
        s3_client.put_object(
            Bucket=bucket_name,
            Key=audio_key,
            Body=audio_bytes,
            ContentType=content_type
        )
        
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
        transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": audio_uri},
            MediaFormat=media_format,
            LanguageCode="en-US"
        )
        
        # Poll for completion
        max_attempts = 30  # 5 minutes max
        for attempt in range(max_attempts):
            response = transcribe_client.get_transcription_job(
                TranscriptionJobName=job_name
            )
            status = response["TranscriptionJob"]["TranscriptionJobStatus"]
            
            if status == "COMPLETED":
                transcript_uri = response["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
                # Get the transcript content
                import requests
                transcript_response = requests.get(transcript_uri)
                transcript_data = transcript_response.json()
                
                # Extract the transcribed text
                transcription = transcript_data["results"]["transcripts"][0]["transcript"]
                
                # Cleanup
                try:
                    s3_client.delete_object(Bucket=bucket_name, Key=audio_key)
                    transcribe_client.delete_transcription_job(TranscriptionJobName=job_name)
                except Exception as cleanup_error:
                    print(f"Cleanup error: {cleanup_error}")
                
                return transcription
                
            elif status == "FAILED":
                raise Exception(f"Transcription failed: {response.get('FailureReason', 'Unknown error')}")
            
            # Wait 10 seconds before next check
            time.sleep(10)
        
        raise Exception("Transcription timeout")
        
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        # Cleanup on error
        try:
            s3_client.delete_object(Bucket=bucket_name, Key=audio_key)
        except:
            pass
        return ""


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle RAG query requests"""

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

        # Parse request body
        body = event.get("body", "{}")
        if isinstance(body, str):
            body_data = json.loads(body)
        else:
            body_data = body

        # Check if this is an audio request or text request
        file_data = body_data.get("file_data")
        content_type = body_data.get("content_type")
        question = body_data.get("question")
        
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

        # Initialize Bedrock clients
        bedrock_agent_runtime = boto3.client("bedrock-agent-runtime")
        bedrock_runtime = boto3.client("bedrock-runtime")

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
                        # Create proper source object structure
                        source_obj = {
                            "content": content,
                            "metadata": {"source": source_uri, "score": score},
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

        # Return successful response
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "answer": answer,
                    "question": question,
                    "sources": sources,
                    "context_found": len(context_pieces) > 0,
                    "user_id": user_id,
                    "timestamp": int(time.time()),
                }
            ),
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
