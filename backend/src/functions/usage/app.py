"""
Manuel - Usage Function
Handles user usage statistics and quota information
"""
import json
import os
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
    handle_options_request
)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle usage and quota requests
    
    GET /api/user/usage - Get current usage statistics
    GET /api/user/quota - Get quota limits and remaining usage
    """
    
    # Handle CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return handle_options_request()
    
    # Get user ID from JWT token
    user_id = get_user_id_from_event(event)
    if not user_id:
        return create_response(401, {'error': 'Unauthorized'})
    
    # Route based on path
    path = event.get('path', '')
    
    if path.endswith('/usage'):
        return handle_get_usage(user_id)
    elif path.endswith('/quota'):
        return handle_get_quota(user_id)
    else:
        return create_response(404, {'error': 'Endpoint not found'})


def handle_get_usage(user_id: str) -> Dict[str, Any]:
    """Get detailed usage statistics for user"""
    
    try:
        usage_tracker = UsageTracker()
        
        # Get current usage stats
        current_stats = usage_tracker.get_usage_stats(user_id)
        
        # Get historical usage (last 7 days)
        historical_usage = get_historical_usage(user_id, days=7)
        
        # Get usage by operation type
        operation_breakdown = get_operation_breakdown(user_id)
        
        return create_response(200, {
            'user_id': user_id,
            'current': current_stats,
            'historical': historical_usage,
            'breakdown': operation_breakdown
        })
        
    except Exception as e:
        print(f"Error getting usage stats: {str(e)}")
        return create_response(500, {'error': 'Failed to get usage statistics'})


def handle_get_quota(user_id: str) -> Dict[str, Any]:
    """Get quota limits and remaining usage"""
    
    try:
        usage_tracker = UsageTracker()
        
        # Get current usage
        stats = usage_tracker.get_usage_stats(user_id)
        
        # Calculate remaining quota
        daily_remaining = max(0, stats['daily_limit'] - stats['daily_used'])
        monthly_remaining = max(0, stats['monthly_limit'] - stats['monthly_used'])
        
        # Calculate percentages
        daily_percent = (stats['daily_used'] / stats['daily_limit']) * 100 if stats['daily_limit'] > 0 else 0
        monthly_percent = (stats['monthly_used'] / stats['monthly_limit']) * 100 if stats['monthly_limit'] > 0 else 0
        
        return create_response(200, {
            'user_id': user_id,
            'quotas': {
                'daily': {
                    'limit': stats['daily_limit'],
                    'used': stats['daily_used'],
                    'remaining': daily_remaining,
                    'percent_used': round(daily_percent, 1)
                },
                'monthly': {
                    'limit': stats['monthly_limit'],
                    'used': stats['monthly_used'],
                    'remaining': monthly_remaining,
                    'percent_used': round(monthly_percent, 1)
                }
            },
            'status': determine_quota_status(daily_percent, monthly_percent),
            'last_operation': stats.get('last_operation'),
            'last_updated': stats.get('last_updated')
        })
        
    except Exception as e:
        print(f"Error getting quota info: {str(e)}")
        return create_response(500, {'error': 'Failed to get quota information'})


def get_historical_usage(user_id: str, days: int = 7) -> list:
    """Get historical usage for the last N days"""
    
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['USAGE_TABLE_NAME'])
        
        from datetime import datetime, timedelta
        
        # Generate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        historical_data = []
        
        # Query each day
        for i in range(days):
            query_date = (start_date + timedelta(days=i)).strftime('%Y-%m-%d')
            
            try:
                response = table.get_item(
                    Key={'user_id': user_id, 'date': query_date}
                )
                
                if 'Item' in response:
                    item = response['Item']
                    historical_data.append({
                        'date': query_date,
                        'daily_count': item.get('daily_count', 0),
                        'operations': item.get('operations', {})
                    })
                else:
                    historical_data.append({
                        'date': query_date,
                        'daily_count': 0,
                        'operations': {}
                    })
                    
            except ClientError as e:
                print(f"Error getting usage for {query_date}: {e}")
                historical_data.append({
                    'date': query_date,
                    'daily_count': 0,
                    'operations': {}
                })
        
        return historical_data
        
    except Exception as e:
        print(f"Error getting historical usage: {str(e)}")
        return []


def get_operation_breakdown(user_id: str) -> Dict[str, int]:
    """Get breakdown of usage by operation type for current month"""
    
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['USAGE_TABLE_NAME'])
        
        from datetime import datetime
        
        # Get current month data
        current_month = datetime.utcnow().strftime('%Y-%m')
        
        # Query all records for this user in current month
        response = table.query(
            KeyConditionExpression='user_id = :user_id AND begins_with(#date, :month)',
            ExpressionAttributeNames={
                '#date': 'date'
            },
            ExpressionAttributeValues={
                ':user_id': user_id,
                ':month': current_month
            }
        )
        
        # Aggregate operation counts
        operation_counts = {
            'transcribe': 0,
            'query': 0,
            'total': 0
        }
        
        for item in response.get('Items', []):
            last_operation = item.get('last_operation')
            daily_count = item.get('daily_count', 0)
            
            if last_operation in operation_counts:
                operation_counts[last_operation] += daily_count
            
            operation_counts['total'] += daily_count
        
        return operation_counts
        
    except Exception as e:
        print(f"Error getting operation breakdown: {str(e)}")
        return {'transcribe': 0, 'query': 0, 'total': 0}


def determine_quota_status(daily_percent: float, monthly_percent: float) -> str:
    """Determine quota status based on usage percentages"""
    
    max_percent = max(daily_percent, monthly_percent)
    
    if max_percent >= 100:
        return 'EXCEEDED'
    elif max_percent >= 90:
        return 'CRITICAL'
    elif max_percent >= 75:
        return 'WARNING'
    elif max_percent >= 50:
        return 'MODERATE'
    else:
        return 'OK'


def reset_daily_quota(user_id: str) -> bool:
    """Reset daily quota for user (admin function)"""
    
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['USAGE_TABLE_NAME'])
        
        from datetime import datetime
        from utils import get_current_date, calculate_ttl
        
        today = get_current_date()
        
        # Reset daily count but keep monthly count
        response = table.get_item(
            Key={'user_id': user_id, 'date': today}
        )
        
        if 'Item' in response:
            item = response['Item']
            monthly_count = item.get('monthly_count', 0)
            
            # Update with reset daily count
            table.put_item(
                Item={
                    'user_id': user_id,
                    'date': today,
                    'month': datetime.utcnow().strftime('%Y-%m'),
                    'daily_count': 0,
                    'monthly_count': monthly_count,
                    'last_operation': 'quota_reset',
                    'last_updated': datetime.utcnow().isoformat(),
                    'ttl': calculate_ttl()
                }
            )
        
        return True
        
    except Exception as e:
        print(f"Error resetting daily quota: {str(e)}")
        return False


def get_quota_limits() -> Dict[str, int]:
    """Get current quota limits from environment"""
    
    return {
        'daily_limit': int(os.environ.get('DAILY_QUOTA', 50)),
        'monthly_limit': int(os.environ.get('MONTHLY_QUOTA', 1000))
    }