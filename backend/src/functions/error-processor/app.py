"""
Error Processor Function for Manuel Backend
Processes errors from dead letter queue and sends notifications
"""
import json
import os
import boto3
from datetime import datetime
from typing import Dict, Any, List
import sys
sys.path.append('/opt/python')
sys.path.append('../../shared')

from logger import get_logger
from utils import create_response


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Process error messages from SQS dead letter queue
    """
    logger = get_logger("manuel-error-processor", context)
    
    # Initialize AWS clients
    dynamodb = boto3.resource('dynamodb')
    sns_client = boto3.client('sns')
    
    # Get configuration
    error_table_name = os.environ.get('ERROR_TABLE_NAME')
    error_topic_arn = os.environ.get('ERROR_TOPIC_ARN')
    
    if not error_table_name:
        logger.error("ERROR_TABLE_NAME not configured")
        return create_response(500, {'error': 'Configuration error'})
    
    try:
        table = dynamodb.Table(error_table_name)
        processed_count = 0
        failed_count = 0
        
        # Process each SQS record
        for record in event.get('Records', []):
            try:
                # Parse the error message
                message_body = json.loads(record['body'])
                logger.info("Processing error message", 
                           message_id=record.get('messageId'),
                           function_name=message_body.get('function_name'),
                           service=message_body.get('service'))
                
                # Extract error details
                error_data = {
                    'error_id': f"{message_body.get('request_id', 'unknown')}#{int(datetime.utcnow().timestamp())}",
                    'timestamp': message_body.get('timestamp', datetime.utcnow().isoformat()),
                    'function_name': message_body.get('function_name', 'unknown'),
                    'request_id': message_body.get('request_id', 'unknown'),
                    'user_id': message_body.get('user_id', 'unknown'),
                    'service': message_body.get('service', 'unknown'),
                    'operation': message_body.get('operation', 'unknown'),
                    'exception_type': message_body.get('exception', {}).get('type', 'Unknown'),
                    'exception_message': message_body.get('exception', {}).get('message', 'Unknown error'),
                    'error_details': message_body.get('error_details', {}),
                    'severity': _determine_severity(message_body),
                    'ttl': int((datetime.utcnow().timestamp() + (30 * 24 * 60 * 60)))  # 30 days
                }
                
                # Add AWS-specific error details if available
                aws_error = message_body.get('exception', {}).get('aws_error', {})
                if aws_error:
                    error_data['aws_error_code'] = aws_error.get('Code', '')
                    error_data['aws_error_message'] = aws_error.get('Message', '')
                
                response_metadata = message_body.get('exception', {}).get('response_metadata', {})
                if response_metadata:
                    error_data['http_status_code'] = response_metadata.get('HTTPStatusCode', 0)
                
                # Store error in DynamoDB
                table.put_item(Item=error_data)
                
                # Send notification for high/critical errors
                if error_data['severity'] in ['high', 'critical'] and error_topic_arn:
                    _send_error_notification(sns_client, error_topic_arn, error_data, logger)
                
                processed_count += 1
                logger.info("Error processed successfully", 
                           error_id=error_data['error_id'],
                           severity=error_data['severity'])
                
            except Exception as e:
                failed_count += 1
                logger.error("Failed to process error record", 
                           error=str(e),
                           record_id=record.get('messageId', 'unknown'))
        
        logger.info("Error processing completed", 
                   processed=processed_count,
                   failed=failed_count,
                   total=len(event.get('Records', [])))
        
        return create_response(200, {
            'processed': processed_count,
            'failed': failed_count,
            'total': len(event.get('Records', []))
        })
        
    except Exception as e:
        logger.error("Error processor failed", error=str(e))
        return create_response(500, {'error': 'Error processing failed'})


def _determine_severity(message_body: Dict[str, Any]) -> str:
    """Determine error severity based on message content"""
    exception_type = message_body.get('exception', {}).get('type', '')
    aws_error = message_body.get('exception', {}).get('aws_error', {})
    error_code = aws_error.get('Code', '') if aws_error else ''
    http_status = message_body.get('exception', {}).get('response_metadata', {}).get('HTTPStatusCode', 0)
    
    # Critical errors
    if error_code in ['InternalServerError', 'ServiceUnavailableException']:
        return 'critical'
    
    # High severity errors
    if (error_code in ['LimitExceededException', 'QuotaExceededException', 'RequestLimitExceeded'] or
        http_status >= 500 or
        'timeout' in exception_type.lower()):
        return 'high'
    
    # Medium severity errors
    if (error_code in ['ResourceNotFoundException', 'ValidationException'] or
        http_status >= 400):
        return 'medium'
    
    # Default to low
    return 'low'


def _send_error_notification(sns_client, topic_arn: str, error_data: Dict[str, Any], logger):
    """Send error notification via SNS"""
    try:
        subject = f"Manuel {error_data['severity'].upper()} Error - {error_data['service']}"
        message = f"""
A {error_data['severity']} error occurred in Manuel backend:

Error ID: {error_data['error_id']}
Function: {error_data['function_name']}
Service: {error_data['service']}
Operation: {error_data['operation']}
Request ID: {error_data['request_id']}
User ID: {error_data['user_id']}
Timestamp: {error_data['timestamp']}

Exception: {error_data['exception_type']}
Message: {error_data['exception_message']}

AWS Error Code: {error_data.get('aws_error_code', 'N/A')}
HTTP Status: {error_data.get('http_status_code', 'N/A')}

Error Details:
{json.dumps(error_data['error_details'], indent=2)}

This error has been logged and is being tracked for analysis.
"""
        
        sns_client.publish(
            TopicArn=topic_arn,
            Subject=subject,
            Message=message,
            MessageAttributes={
                'Severity': {
                    'StringValue': error_data['severity'],
                    'DataType': 'String'
                },
                'Service': {
                    'StringValue': error_data['service'],
                    'DataType': 'String'
                },
                'FunctionName': {
                    'StringValue': error_data['function_name'],
                    'DataType': 'String'
                }
            }
        )
        
        logger.info("Error notification sent", 
                   error_id=error_data['error_id'],
                   severity=error_data['severity'])
        
    except Exception as e:
        logger.error("Failed to send error notification", 
                   error=str(e),
                   error_id=error_data['error_id'])