"""
Manuel - Audio Transcription Function
Handles audio file upload and transcription using AWS Transcribe
"""
import json
import os
import uuid
import base64
from typing import Dict, Any
import boto3
from botocore.exceptions import ClientError
import sys
sys.path.append('/opt/python')
sys.path.append('../../shared')

from utils import (
    create_response, 
    get_user_id_from_event, 
    UsageTracker,
    validate_json_body,
    handle_options_request
)
from logger import get_logger, LoggingContext
from cost_calculator import get_cost_calculator
from health_checker import get_health_checker, CircuitBreakerOpenError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle audio transcription requests
    
    Expected request:
    {
        "audio_data": "base64_encoded_audio",
        "content_type": "audio/mp4" | "audio/wav" | "audio/webm"
    }
    """
    import time
    start_time = time.time()
    logger = get_logger("manuel-transcribe", context)
    cost_calculator = get_cost_calculator()
    health_checker = get_health_checker()
    
    # Initialize cost tracking parameters
    cost_params = {
        "lambda_duration_ms": 0,
        "lambda_memory_mb": int(os.environ.get('AWS_LAMBDA_FUNCTION_MEMORY_SIZE', 256)),
        "dynamodb_reads": 1,  # Quota check read
        "dynamodb_writes": 1,  # Quota update write
        "transcribe_duration_seconds": 0,
        "s3_put_requests": 1,
        "s3_get_requests": 1
    }
    
    try:
        logger.log_request_start(event)
        
        # Handle CORS preflight
        if event['httpMethod'] == 'OPTIONS':
            response = handle_options_request()
            logger.log_request_end(200, (time.time() - start_time) * 1000)
            return response
        
        # Get user ID from JWT token
        user_id = get_user_id_from_event(event)
        if not user_id:
            logger.warning("Unauthorized request - no user ID")
            response = create_response(401, {'error': 'Unauthorized'})
            logger.log_request_end(401, (time.time() - start_time) * 1000)
            return response
        
        logger.info("Processing transcription request", user_id=user_id)
        
        # Validate request body
        is_valid, body = validate_json_body(event, ['audio_data', 'content_type'])
        if not is_valid:
            logger.warning("Invalid request body", validation_error=body)
            response = create_response(400, body)
            logger.log_request_end(400, (time.time() - start_time) * 1000)
            return response
        
        # Check usage quota
        with LoggingContext(logger, "QuotaCheck"):
            usage_tracker = UsageTracker()
            can_proceed, usage_info = usage_tracker.check_and_increment_usage(user_id, 'transcribe')
            logger.log_quota_check(user_id, 'transcribe', can_proceed, usage_info)
        
        if not can_proceed:
            logger.warning("Quota exceeded", user_id=user_id, usage_info=usage_info)
            response = create_response(429, usage_info)
            logger.log_request_end(429, (time.time() - start_time) * 1000)
            return response
        
        try:
            # Estimate audio duration for cost calculation
            audio_size_bytes = len(body['audio_data']) * 3 // 4  # Base64 to bytes conversion
            estimated_duration = cost_calculator.estimate_audio_duration(audio_size_bytes)
            cost_params["transcribe_duration_seconds"] = estimated_duration
            
            logger.info("Starting audio processing", 
                       audio_size_bytes=audio_size_bytes,
                       estimated_duration_seconds=estimated_duration)
            
            # Upload audio to S3
            with LoggingContext(logger, "S3Upload"):
                s3_key = upload_audio_to_s3(body['audio_data'], body['content_type'], user_id, health_checker)
            
            # Start transcription job
            with LoggingContext(logger, "Transcription"):
                transcription_text, actual_duration = transcribe_audio(s3_key, logger, health_checker)
                
            # Update cost parameters with actual duration if available
            if actual_duration > 0:
                cost_params["transcribe_duration_seconds"] = actual_duration
            
            # Clean up audio file
            cleanup_audio_file(s3_key, health_checker)
            
            # Calculate final costs
            cost_params["lambda_duration_ms"] = (time.time() - start_time) * 1000
            
            request_cost = cost_calculator.calculate_request_cost(
                context.aws_request_id if context else "unknown",
                user_id,
                "transcribe",
                **cost_params
            )
            
            # Emit cost metrics and store cost data
            cost_calculator.emit_cost_metrics(request_cost)
            cost_calculator.store_cost_data(request_cost)
            
            logger.info("Transcription completed successfully", 
                       transcription_length=len(transcription_text),
                       actual_duration_seconds=actual_duration,
                       total_cost=request_cost.total_cost)
            
            response_data = {
                'transcription': transcription_text,
                'usage': usage_info,
                'cost': request_cost.to_dict()
            }
            
            response = create_response(200, response_data)
            logger.log_request_end(200, (time.time() - start_time) * 1000, 
                                 transcription_length=len(transcription_text),
                                 total_cost=request_cost.total_cost)
            return response
            
        except CircuitBreakerOpenError as e:
            logger.warning("Circuit breaker open during transcription processing", 
                          error=str(e),
                          user_id=user_id)
            response = create_response(503, {
                'error': 'Service temporarily unavailable',
                'details': 'Transcription service is currently unavailable. Please try again later.',
                'retry_after': 60
            })
            logger.log_request_end(503, (time.time() - start_time) * 1000)
            return response
        except Exception as e:
            logger.error("Error in transcription processing", 
                        error=str(e), 
                        error_type=type(e).__name__,
                        user_id=user_id)
            response = create_response(500, {'error': 'Transcription failed'})
            logger.log_request_end(500, (time.time() - start_time) * 1000)
            return response
        
    except Exception as e:
        logger.error("Unexpected error in lambda handler", 
                    error=str(e), 
                    error_type=type(e).__name__)
        response = create_response(500, {'error': 'Internal server error'})
        logger.log_request_end(500, (time.time() - start_time) * 1000)
        return response


def upload_audio_to_s3(audio_data: str, content_type: str, user_id: str, health_checker) -> str:
    """Upload base64 audio data to S3"""
    s3_client = boto3.client('s3')
    bucket_name = os.environ['AUDIO_BUCKET']
    
    # Generate unique key
    file_extension = get_file_extension(content_type)
    s3_key = f"audio/{user_id}/{uuid.uuid4().hex}{file_extension}"
    
    try:
        # Decode base64 audio data
        audio_bytes = base64.b64decode(audio_data)
        
        # Upload to S3 with circuit breaker protection
        def s3_upload():
            return s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=audio_bytes,
                ContentType=content_type
            )
        
        health_checker.circuit_breakers["s3"].call(s3_upload)
        
        return s3_key
        
    except Exception as e:
        print(f"Error uploading audio to S3: {str(e)}")
        raise


def get_file_extension(content_type: str) -> str:
    """Get file extension from content type"""
    extension_map = {
        'audio/mp4': '.mp4',
        'audio/wav': '.wav',
        'audio/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/ogg': '.ogg'
    }
    return extension_map.get(content_type, '.mp4')


def transcribe_audio(s3_key: str, logger, health_checker) -> tuple:
    """Transcribe audio file using AWS Transcribe"""
    transcribe_client = boto3.client('transcribe')
    bucket_name = os.environ['AUDIO_BUCKET']
    
    # Generate unique job name
    job_name = f"manuel-transcription-{uuid.uuid4().hex}"
    
    try:
        # Start transcription job with circuit breaker protection
        def start_transcription():
            return transcribe_client.start_transcription_job(
                TranscriptionJobName=job_name,
                Media={
                    'MediaFileUri': f's3://{bucket_name}/{s3_key}'
                },
                MediaFormat=get_media_format(s3_key),
                LanguageCode='en-US',
                Settings={
                    'ShowSpeakerLabels': False,
                    'MaxSpeakerLabels': 1,
                    'VocabularyFilterMethod': 'remove'
                }
            )
        
        health_checker.circuit_breakers["transcribe"].call(start_transcription)
        
        # Wait for transcription to complete
        while True:
            def check_transcription():
                return transcribe_client.get_transcription_job(
                    TranscriptionJobName=job_name
                )
            
            response = health_checker.circuit_breakers["transcribe"].call(check_transcription)
            
            status = response['TranscriptionJob']['TranscriptionJobStatus']
            
            if status == 'COMPLETED':
                # Get transcript and duration
                transcript_uri = response['TranscriptionJob']['Transcript']['TranscriptFileUri']
                transcript_text = get_transcript_from_uri(transcript_uri)
                
                # Extract duration from job results if available
                media_info = response['TranscriptionJob'].get('Media', {})
                duration_seconds = media_info.get('MediaFileUri', {}).get('DurationInSeconds', 0)
                
                # If duration not available from job, try to extract from transcript
                if duration_seconds == 0:
                    duration_seconds = extract_duration_from_transcript(transcript_uri)
                
                logger.info("Transcription job completed", 
                           duration_seconds=duration_seconds,
                           transcript_length=len(transcript_text))
                
                # Clean up transcription job
                try:
                    transcribe_client.delete_transcription_job(
                        TranscriptionJobName=job_name
                    )
                except:
                    pass  # Job cleanup is not critical
                
                return transcript_text, duration_seconds
                
            elif status == 'FAILED':
                error = response['TranscriptionJob'].get('FailureReason', 'Unknown error')
                raise Exception(f"Transcription failed: {error}")
            
            # Wait before checking again
            import time
            time.sleep(2)
            
    except Exception as e:
        logger.error("Error in transcription", error=str(e), error_type=type(e).__name__)
        # Clean up failed job
        try:
            transcribe_client.delete_transcription_job(
                TranscriptionJobName=job_name
            )
        except:
            pass
        raise


def get_media_format(s3_key: str) -> str:
    """Get media format from S3 key"""
    if s3_key.endswith('.mp4'):
        return 'mp4'
    elif s3_key.endswith('.wav'):
        return 'wav'
    elif s3_key.endswith('.webm'):
        return 'webm'
    elif s3_key.endswith('.mp3'):
        return 'mp3'
    elif s3_key.endswith('.ogg'):
        return 'ogg'
    else:
        return 'mp4'  # default


def get_transcript_from_uri(transcript_uri: str) -> str:
    """Download and parse transcript from S3 URI"""
    import urllib.request
    
    try:
        with urllib.request.urlopen(transcript_uri) as response:
            transcript_data = json.loads(response.read().decode())
            
        # Extract transcript text
        transcript_text = transcript_data['results']['transcripts'][0]['transcript']
        return transcript_text.strip()
        
    except Exception as e:
        print(f"Error getting transcript: {str(e)}")
        raise


def extract_duration_from_transcript(transcript_uri: str) -> float:
    """Extract duration from transcript JSON if available"""
    import urllib.request
    
    try:
        with urllib.request.urlopen(transcript_uri) as response:
            transcript_data = json.loads(response.read().decode())
        
        # Try to find duration in transcript metadata
        results = transcript_data.get('results', {})
        
        # Look for items with end times to estimate duration
        items = results.get('items', [])
        if items:
            last_item = max(items, key=lambda x: float(x.get('end_time', 0)))
            return float(last_item.get('end_time', 0))
        
        return 0.0
        
    except Exception as e:
        print(f"Warning: Could not extract duration from transcript: {e}")
        return 0.0


def cleanup_audio_file(s3_key: str, health_checker) -> None:
    """Remove audio file from S3 after processing"""
    try:
        s3_client = boto3.client('s3')
        bucket_name = os.environ['AUDIO_BUCKET']
        
        # Delete S3 object with circuit breaker protection
        def delete_s3_object():
            return s3_client.delete_object(
                Bucket=bucket_name,
                Key=s3_key
            )
        
        health_checker.circuit_breakers["s3"].call(delete_s3_object)
        
    except Exception as e:
        print(f"Warning: Could not cleanup audio file {s3_key}: {str(e)}")
        # Non-critical error, file will be cleaned up by S3 lifecycle policy