"""
Advanced Error Handling System for Manuel Backend
Provides sophisticated error handling with retry strategies, dead letter queues, and fault tolerance
"""
import json
import time
import random
import boto3
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable, List, Union
from dataclasses import dataclass
from enum import Enum
import hashlib
import traceback
from botocore.exceptions import ClientError, BotoCoreError
from botocore.config import Config

from logger import get_logger
from utils import create_response


class ErrorSeverity(Enum):
    """Error severity levels for classification"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RetryStrategy(Enum):
    """Different retry strategies"""
    EXPONENTIAL_BACKOFF = "exponential"
    LINEAR_BACKOFF = "linear"
    FIXED_DELAY = "fixed"
    JITTERED_BACKOFF = "jittered"


@dataclass
class RetryConfig:
    """Configuration for retry strategies"""
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF
    jitter: bool = True
    retry_exceptions: List[type] = None
    
    def __post_init__(self):
        if self.retry_exceptions is None:
            self.retry_exceptions = [
                ClientError,
                BotoCoreError,
                ConnectionError,
                TimeoutError
            ]


@dataclass
class ErrorContext:
    """Context information for error handling"""
    function_name: str
    request_id: str
    user_id: Optional[str] = None
    operation: Optional[str] = None
    timestamp: datetime = None
    error_details: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
        if self.error_details is None:
            self.error_details = {}


class AdvancedErrorHandler:
    """Advanced error handling with retry strategies and dead letter queues"""
    
    def __init__(self, function_name: str, context: Any = None):
        self.function_name = function_name
        self.context = context
        self.logger = get_logger(f"error-handler-{function_name}")
        
        # AWS clients
        self.sqs_client = boto3.client('sqs', config=Config(
            retries={'max_attempts': 3},
            max_pool_connections=10
        ))
        self.sns_client = boto3.client('sns', config=Config(
            retries={'max_attempts': 3}
        ))
        self.dynamodb = boto3.resource('dynamodb')
        
        # Configuration
        self.dlq_url = self._get_dlq_url()
        self.error_topic_arn = self._get_error_topic_arn()
        self.error_table_name = self._get_error_table_name()
        
        # Retry configurations for different services
        self.retry_configs = {
            'bedrock': RetryConfig(
                max_retries=3,
                base_delay=2.0,
                max_delay=30.0,
                strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
                jitter=True
            ),
            'transcribe': RetryConfig(
                max_retries=2,
                base_delay=1.0,
                max_delay=10.0,
                strategy=RetryStrategy.LINEAR_BACKOFF,
                jitter=True
            ),
            'dynamodb': RetryConfig(
                max_retries=5,
                base_delay=0.5,
                max_delay=8.0,
                strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
                jitter=True
            ),
            's3': RetryConfig(
                max_retries=3,
                base_delay=1.0,
                max_delay=16.0,
                strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
                jitter=True
            ),
            'cognito': RetryConfig(
                max_retries=3,
                base_delay=1.0,
                max_delay=10.0,
                strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
                jitter=False
            )
        }
        
        # Error classification patterns
        self.error_patterns = {
            'transient': [
                'ThrottlingException',
                'ServiceUnavailableException',
                'InternalServerError',
                'RequestTimeoutException',
                'TooManyRequestsException'
            ],
            'authentication': [
                'UnauthorizedOperation',
                'InvalidUserPoolConfigurationException',
                'NotAuthorizedException',
                'ExpiredTokenException'
            ],
            'validation': [
                'ValidationException',
                'InvalidParameterException',
                'MalformedPolicyDocument',
                'InvalidRequestException'
            ],
            'resource': [
                'ResourceNotFoundException',
                'NoSuchBucket',
                'NoSuchKey',
                'UserNotFoundException'
            ],
            'quota': [
                'LimitExceededException',
                'QuotaExceededException',
                'RequestLimitExceeded'
            ]
        }
    
    def _get_dlq_url(self) -> Optional[str]:
        """Get Dead Letter Queue URL from environment"""
        return os.environ.get('DLQ_URL', '')
    
    def _get_error_topic_arn(self) -> Optional[str]:
        """Get SNS topic ARN for error notifications"""
        return os.environ.get('ERROR_TOPIC_ARN', '')
    
    def _get_error_table_name(self) -> Optional[str]:
        """Get DynamoDB table name for error tracking"""
        return os.environ.get('ERROR_TABLE_NAME', '')
    
    def handle_with_retry(self, 
                         operation: Callable,
                         service: str,
                         *args,
                         error_context: Optional[ErrorContext] = None,
                         **kwargs) -> Any:
        """
        Execute operation with retry logic
        
        Args:
            operation: Function to execute
            service: Service name for retry configuration
            *args: Arguments for operation
            error_context: Context for error handling
            **kwargs: Keyword arguments for operation
            
        Returns:
            Result of operation or raises exception
        """
        config = self.retry_configs.get(service, RetryConfig())
        last_exception = None
        
        for attempt in range(config.max_retries + 1):
            try:
                start_time = time.time()
                result = operation(*args, **kwargs)
                
                # Log successful operation after retries
                if attempt > 0:
                    self.logger.info(
                        "Operation succeeded after retries",
                        service=service,
                        attempt=attempt + 1,
                        duration_ms=int((time.time() - start_time) * 1000)
                    )
                
                return result
                
            except Exception as e:
                last_exception = e
                
                # Check if this exception should be retried
                if not self._should_retry(e, config):
                    self.logger.warning(
                        "Exception not retryable",
                        service=service,
                        exception=str(e),
                        exception_type=type(e).__name__
                    )
                    break
                
                # If this is the last attempt, don't delay
                if attempt == config.max_retries:
                    break
                
                # Calculate delay
                delay = self._calculate_delay(attempt, config)
                
                self.logger.warning(
                    "Operation failed, retrying",
                    service=service,
                    attempt=attempt + 1,
                    max_retries=config.max_retries,
                    delay_seconds=delay,
                    exception=str(e),
                    exception_type=type(e).__name__
                )
                
                time.sleep(delay)
        
        # All retries exhausted, handle the final failure
        self._handle_final_failure(last_exception, service, error_context)
        raise last_exception
    
    def _should_retry(self, exception: Exception, config: RetryConfig) -> bool:
        """Determine if an exception should be retried"""
        # Check if exception type is in retry list
        if any(isinstance(exception, exc_type) for exc_type in config.retry_exceptions):
            # For AWS exceptions, check specific error codes
            if hasattr(exception, 'response'):
                error_code = exception.response.get('Error', {}).get('Code', '')
                
                # Don't retry client errors (4xx) except for specific transient ones
                if error_code in self.error_patterns['transient']:
                    return True
                
                # Don't retry authentication/authorization errors
                if error_code in self.error_patterns['authentication']:
                    return False
                
                # Don't retry validation errors
                if error_code in self.error_patterns['validation']:
                    return False
                
                # Don't retry resource not found errors
                if error_code in self.error_patterns['resource']:
                    return False
                
                # Retry quota/limit errors with longer delays
                if error_code in self.error_patterns['quota']:
                    return True
                
                # For other AWS errors, retry 5xx but not 4xx
                http_status = exception.response.get('ResponseMetadata', {}).get('HTTPStatusCode', 0)
                return http_status >= 500
            
            return True
        
        return False
    
    def _calculate_delay(self, attempt: int, config: RetryConfig) -> float:
        """Calculate delay based on retry strategy"""
        if config.strategy == RetryStrategy.EXPONENTIAL_BACKOFF:
            delay = config.base_delay * (2 ** attempt)
        elif config.strategy == RetryStrategy.LINEAR_BACKOFF:
            delay = config.base_delay * (attempt + 1)
        elif config.strategy == RetryStrategy.FIXED_DELAY:
            delay = config.base_delay
        elif config.strategy == RetryStrategy.JITTERED_BACKOFF:
            delay = config.base_delay * (2 ** attempt)
            delay = delay + random.uniform(0, delay * 0.1)  # Add up to 10% jitter
        else:
            delay = config.base_delay
        
        # Apply jitter if enabled
        if config.jitter and config.strategy != RetryStrategy.JITTERED_BACKOFF:
            jitter_amount = delay * 0.1  # 10% jitter
            delay = delay + random.uniform(-jitter_amount, jitter_amount)
        
        # Cap the delay at max_delay
        return min(delay, config.max_delay)
    
    def _handle_final_failure(self, 
                            exception: Exception,
                            service: str,
                            error_context: Optional[ErrorContext] = None):
        """Handle final failure after all retries exhausted"""
        try:
            # Create error context if not provided
            if error_context is None:
                error_context = ErrorContext(
                    function_name=self.function_name,
                    request_id=getattr(self.context, 'aws_request_id', 'unknown'),
                    operation=f"{service}_operation"
                )
            
            # Classify error severity
            severity = self._classify_error_severity(exception)
            
            # Log the final failure
            self.logger.error(
                "Operation failed after all retries",
                service=service,
                exception=str(exception),
                exception_type=type(exception).__name__,
                severity=severity.value,
                error_context=error_context.__dict__,
                stack_trace=traceback.format_exc()
            )
            
            # Send to dead letter queue
            self._send_to_dlq(exception, service, error_context)
            
            # Track error in DynamoDB
            self._track_error(exception, service, error_context, severity)
            
            # Send critical error notifications
            if severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
                self._send_error_notification(exception, service, error_context, severity)
                
        except Exception as e:
            self.logger.error(
                "Failed to handle final failure",
                error=str(e),
                original_exception=str(exception)
            )
    
    def _classify_error_severity(self, exception: Exception) -> ErrorSeverity:
        """Classify error severity based on exception type and content"""
        if hasattr(exception, 'response'):
            error_code = exception.response.get('Error', {}).get('Code', '')
            http_status = exception.response.get('ResponseMetadata', {}).get('HTTPStatusCode', 0)
            
            # Critical errors
            if error_code in ['InternalServerError', 'ServiceUnavailableException']:
                return ErrorSeverity.CRITICAL
            
            # High severity errors
            if error_code in self.error_patterns['quota'] or http_status >= 500:
                return ErrorSeverity.HIGH
            
            # Medium severity errors
            if error_code in self.error_patterns['resource'] or http_status >= 400:
                return ErrorSeverity.MEDIUM
        
        # Default to medium for unknown errors
        return ErrorSeverity.MEDIUM
    
    def _send_to_dlq(self, 
                    exception: Exception,
                    service: str,
                    error_context: ErrorContext):
        """Send failed operation to dead letter queue"""
        if not self.dlq_url:
            return
        
        try:
            message = {
                'timestamp': error_context.timestamp.isoformat(),
                'function_name': error_context.function_name,
                'request_id': error_context.request_id,
                'user_id': error_context.user_id,
                'service': service,
                'operation': error_context.operation,
                'exception': {
                    'type': type(exception).__name__,
                    'message': str(exception),
                    'stack_trace': traceback.format_exc()
                },
                'error_details': error_context.error_details
            }
            
            # Add AWS-specific error details
            if hasattr(exception, 'response'):
                message['exception']['aws_error'] = exception.response.get('Error', {})
                message['exception']['response_metadata'] = exception.response.get('ResponseMetadata', {})
            
            self.sqs_client.send_message(
                QueueUrl=self.dlq_url,
                MessageBody=json.dumps(message),
                MessageAttributes={
                    'Service': {
                        'StringValue': service,
                        'DataType': 'String'
                    },
                    'Severity': {
                        'StringValue': self._classify_error_severity(exception).value,
                        'DataType': 'String'
                    },
                    'FunctionName': {
                        'StringValue': error_context.function_name,
                        'DataType': 'String'
                    }
                }
            )
            
            self.logger.info(
                "Error sent to dead letter queue",
                service=service,
                dlq_url=self.dlq_url,
                message_id=error_context.request_id
            )
            
        except Exception as e:
            self.logger.error(
                "Failed to send message to DLQ",
                error=str(e),
                dlq_url=self.dlq_url
            )
    
    def _track_error(self,
                    exception: Exception,
                    service: str,
                    error_context: ErrorContext,
                    severity: ErrorSeverity):
        """Track error in DynamoDB for analysis"""
        if not self.error_table_name:
            return
        
        try:
            table = self.dynamodb.Table(self.error_table_name)
            
            # Create error hash for deduplication
            error_hash = hashlib.md5(
                f"{type(exception).__name__}{str(exception)}{service}".encode()
            ).hexdigest()
            
            item = {
                'error_id': f"{error_context.request_id}#{int(time.time())}",
                'error_hash': error_hash,
                'timestamp': error_context.timestamp.isoformat(),
                'function_name': error_context.function_name,
                'request_id': error_context.request_id,
                'user_id': error_context.user_id or 'unknown',
                'service': service,
                'operation': error_context.operation or 'unknown',
                'severity': severity.value,
                'exception_type': type(exception).__name__,
                'exception_message': str(exception),
                'error_details': error_context.error_details,
                'ttl': int((datetime.utcnow() + timedelta(days=30)).timestamp())
            }
            
            # Add AWS-specific error details
            if hasattr(exception, 'response'):
                item['aws_error_code'] = exception.response.get('Error', {}).get('Code', '')
                item['aws_error_message'] = exception.response.get('Error', {}).get('Message', '')
                item['http_status_code'] = exception.response.get('ResponseMetadata', {}).get('HTTPStatusCode', 0)
            
            table.put_item(Item=item)
            
            self.logger.info(
                "Error tracked in database",
                service=service,
                error_id=item['error_id'],
                severity=severity.value
            )
            
        except Exception as e:
            self.logger.error(
                "Failed to track error in database",
                error=str(e),
                table_name=self.error_table_name
            )
    
    def _send_error_notification(self,
                               exception: Exception,
                               service: str,
                               error_context: ErrorContext,
                               severity: ErrorSeverity):
        """Send error notification via SNS"""
        if not self.error_topic_arn:
            return
        
        try:
            subject = f"Manuel {severity.value.upper()} Error - {service}"
            message = f"""
A {severity.value} error occurred in Manuel backend:

Function: {error_context.function_name}
Service: {service}
Operation: {error_context.operation}
Request ID: {error_context.request_id}
User ID: {error_context.user_id}
Timestamp: {error_context.timestamp.isoformat()}

Exception: {type(exception).__name__}
Message: {str(exception)}

Error Details:
{json.dumps(error_context.error_details, indent=2)}

This error occurred after all retry attempts were exhausted.
Please investigate and take appropriate action.
"""
            
            self.sns_client.publish(
                TopicArn=self.error_topic_arn,
                Subject=subject,
                Message=message,
                MessageAttributes={
                    'Severity': {
                        'StringValue': severity.value,
                        'DataType': 'String'
                    },
                    'Service': {
                        'StringValue': service,
                        'DataType': 'String'
                    },
                    'FunctionName': {
                        'StringValue': error_context.function_name,
                        'DataType': 'String'
                    }
                }
            )
            
            self.logger.info(
                "Error notification sent",
                service=service,
                severity=severity.value,
                topic_arn=self.error_topic_arn
            )
            
        except Exception as e:
            self.logger.error(
                "Failed to send error notification",
                error=str(e),
                topic_arn=self.error_topic_arn
            )
    
    def create_error_response(self,
                            exception: Exception,
                            service: str,
                            default_message: str = "An unexpected error occurred") -> Dict[str, Any]:
        """Create user-friendly error response"""
        # Don't expose internal error details to users
        user_message = default_message
        
        if hasattr(exception, 'response'):
            error_code = exception.response.get('Error', {}).get('Code', '')
            
            # Map AWS error codes to user-friendly messages
            error_messages = {
                'ThrottlingException': 'Service is temporarily busy. Please try again in a moment.',
                'ValidationException': 'The request contains invalid parameters.',
                'UnauthorizedOperation': 'You are not authorized to perform this operation.',
                'ResourceNotFoundException': 'The requested resource was not found.',
                'LimitExceededException': 'You have exceeded the service limits. Please try again later.',
                'ServiceUnavailableException': 'The service is temporarily unavailable. Please try again later.'
            }
            
            user_message = error_messages.get(error_code, default_message)
        
        # Determine appropriate HTTP status code
        status_code = 500
        if hasattr(exception, 'response'):
            http_status = exception.response.get('ResponseMetadata', {}).get('HTTPStatusCode', 500)
            status_code = http_status
        
        return create_response(status_code, {
            'error': user_message,
            'service': service,
            'timestamp': datetime.utcnow().isoformat()
        })


def get_error_handler(function_name: str, context: Any = None) -> AdvancedErrorHandler:
    """Factory function to get error handler instance"""
    return AdvancedErrorHandler(function_name, context)


def error_handler_decorator(service: str, default_message: str = "An unexpected error occurred"):
    """Decorator to wrap functions with error handling"""
    def decorator(func):
        def wrapper(event, context):
            error_handler = get_error_handler(func.__name__, context)
            
            try:
                return func(event, context)
            except Exception as e:
                # Create error context from Lambda event
                error_context = ErrorContext(
                    function_name=func.__name__,
                    request_id=context.aws_request_id,
                    user_id=event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub'),
                    operation=f"{event.get('httpMethod', 'unknown')} {event.get('path', 'unknown')}",
                    error_details={
                        'event': event,
                        'function_name': func.__name__
                    }
                )
                
                # Handle the error
                error_handler._handle_final_failure(e, service, error_context)
                
                # Return user-friendly error response
                return error_handler.create_error_response(e, service, default_message)
        
        return wrapper
    return decorator