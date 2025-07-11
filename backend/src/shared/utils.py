"""
Shared utilities for Manuel backend functions
"""
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

import boto3
from botocore.exceptions import ClientError


def get_cors_headers() -> Dict[str, str]:
    """Return CORS headers for API responses"""
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    }


def create_response(status_code: int, body: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Create a standardized API response"""
    response_headers = get_cors_headers()
    if headers:
        response_headers.update(headers)
    
    return {
        'statusCode': status_code,
        'headers': response_headers,
        'body': json.dumps(body)
    }


def get_user_id_from_event(event: Dict[str, Any]) -> Optional[str]:
    """Extract user ID from Lambda event context"""
    try:
        # From Cognito JWT claims
        claims = event['requestContext']['authorizer']['claims']
        return claims.get('sub')
    except KeyError:
        return None


def get_current_date() -> str:
    """Get current date in YYYY-MM-DD format"""
    return datetime.utcnow().strftime('%Y-%m-%d')


def get_current_month() -> str:
    """Get current month in YYYY-MM format"""
    return datetime.utcnow().strftime('%Y-%m')


def calculate_ttl(days: int = 32) -> int:
    """Calculate TTL timestamp for DynamoDB (default 32 days)"""
    return int((datetime.utcnow() + timedelta(days=days)).timestamp())


class UsageTracker:
    """Handle user usage tracking and quota enforcement"""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(os.environ['USAGE_TABLE_NAME'])
        self.daily_limit = int(os.environ.get('DAILY_QUOTA', 50))
        self.monthly_limit = int(os.environ.get('MONTHLY_QUOTA', 1000))
    
    def check_and_increment_usage(self, user_id: str, operation: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if user can perform operation and increment usage counter
        Returns (can_proceed, usage_info)
        """
        today = get_current_date()
        month = get_current_month()
        
        try:
            # Get current usage
            response = self.table.get_item(
                Key={'user_id': user_id, 'date': today}
            )
            
            if 'Item' in response:
                item = response['Item']
                daily_count = item.get('daily_count', 0)
                monthly_count = item.get('monthly_count', 0)
            else:
                daily_count = 0
                monthly_count = 0
            
            # Check quotas
            if daily_count >= self.daily_limit:
                return False, {
                    'error': 'Daily quota exceeded',
                    'daily_used': daily_count,
                    'daily_limit': self.daily_limit,
                    'monthly_used': monthly_count,
                    'monthly_limit': self.monthly_limit
                }
            
            if monthly_count >= self.monthly_limit:
                return False, {
                    'error': 'Monthly quota exceeded',
                    'daily_used': daily_count,
                    'daily_limit': self.daily_limit,
                    'monthly_used': monthly_count,
                    'monthly_limit': self.monthly_limit
                }
            
            # Increment usage
            self.table.put_item(
                Item={
                    'user_id': user_id,
                    'date': today,
                    'month': month,
                    'daily_count': daily_count + 1,
                    'monthly_count': monthly_count + 1,
                    'last_operation': operation,
                    'last_updated': datetime.utcnow().isoformat(),
                    'ttl': calculate_ttl()
                }
            )
            
            return True, {
                'daily_used': daily_count + 1,
                'daily_limit': self.daily_limit,
                'monthly_used': monthly_count + 1,
                'monthly_limit': self.monthly_limit
            }
            
        except ClientError as e:
            print(f"Error checking usage: {e}")
            return False, {'error': 'Usage tracking error'}
    
    def get_usage_stats(self, user_id: str) -> Dict[str, Any]:
        """Get current usage statistics for user"""
        today = get_current_date()
        
        try:
            response = self.table.get_item(
                Key={'user_id': user_id, 'date': today}
            )
            
            if 'Item' in response:
                item = response['Item']
                return {
                    'daily_used': item.get('daily_count', 0),
                    'daily_limit': self.daily_limit,
                    'monthly_used': item.get('monthly_count', 0),
                    'monthly_limit': self.monthly_limit,
                    'last_operation': item.get('last_operation'),
                    'last_updated': item.get('last_updated')
                }
            else:
                return {
                    'daily_used': 0,
                    'daily_limit': self.daily_limit,
                    'monthly_used': 0,
                    'monthly_limit': self.monthly_limit,
                    'last_operation': None,
                    'last_updated': None
                }
                
        except ClientError as e:
            print(f"Error getting usage stats: {e}")
            return {'error': 'Failed to get usage statistics'}


def validate_json_body(event: Dict[str, Any], required_fields: list) -> Tuple[bool, Any]:
    """Validate JSON body has required fields"""
    try:
        if not event.get('body'):
            return False, {'error': 'Request body is required'}
        
        body = json.loads(event['body'])
        
        missing_fields = [field for field in required_fields if field not in body]
        if missing_fields:
            return False, {'error': f'Missing required fields: {", ".join(missing_fields)}'}
        
        return True, body
    except json.JSONDecodeError:
        return False, {'error': 'Invalid JSON in request body'}


def handle_options_request() -> Dict[str, Any]:
    """Handle CORS preflight OPTIONS request"""
    return create_response(200, {}, get_cors_headers())