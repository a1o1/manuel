"""
Manuel - Usage Function
Handles user usage statistics and quota information
"""

import os
import sys
from typing import Any, Dict, List

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

sys.path.append("/opt/python")
sys.path.append("../../shared")

from utils import (  # noqa: E402
    UsageTracker,
    create_response,
    get_user_id_from_event,
    handle_options_request,
)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle usage and quota requests

    GET /api/user/usage - Get current usage statistics
    GET /api/user/quota - Get quota limits and remaining usage
    """

    # Handle CORS preflight
    if event["httpMethod"] == "OPTIONS":
        return handle_options_request()

    # Get user ID from JWT token
    user_id = get_user_id_from_event(event)
    if not user_id:
        return create_response(401, {"error": "Unauthorized"})

    # Route based on path
    path = event.get("path", "")

    if path.endswith("/usage"):
        return handle_get_usage(user_id)
    elif path.endswith("/quota"):
        return handle_get_quota(user_id)
    else:
        return create_response(404, {"error": "Endpoint not found"})


def handle_get_usage(user_id: str) -> Dict[str, Any]:
    """Get detailed usage statistics for user."""
    try:
        usage_tracker = UsageTracker()

        # Get current usage stats
        current_stats = usage_tracker.get_usage_stats(user_id)

        # Get historical usage (last 7 days)
        historical_usage = get_historical_usage(user_id, days=7)

        # Get usage by operation type
        operation_breakdown = get_operation_breakdown(user_id)

        # Calculate actual costs
        daily_costs = get_daily_costs(user_id)
        monthly_costs = get_monthly_costs(user_id)

        # Format response to match frontend expectations
        response_data = {
            "current_usage": {
                "daily_queries": current_stats.get("daily_used", 0),
                "daily_limit": current_stats.get("daily_limit", 50),
                "daily_remaining": current_stats.get("daily_limit", 50)
                - current_stats.get("daily_used", 0),
                "monthly_queries": current_stats.get("monthly_used", 0),
                "monthly_limit": current_stats.get("monthly_limit", 1000),
                "monthly_remaining": current_stats.get("monthly_limit", 1000)
                - current_stats.get("monthly_used", 0),
            },
            "daily_costs": {
                "total_cost": daily_costs.get("total", 0.0),
                "transcribe_cost": daily_costs.get("transcribe", 0.0),
                "bedrock_cost": daily_costs.get("bedrock", 0.0),
                "lambda_cost": daily_costs.get("lambda", 0.0),
                "s3_cost": daily_costs.get("s3", 0.0),
                "api_gateway_cost": daily_costs.get("api_gateway", 0.0),
                "currency": "EUR",
            },
            "monthly_costs": {
                "total_cost": monthly_costs.get("total", 0.0),
                "service_breakdown": monthly_costs.get("services", {}),
                "currency": "EUR",
            },
            "recent_queries": get_recent_queries(user_id, limit=5),
            "user_id": user_id,
            "historical": historical_usage,
            "breakdown": operation_breakdown,
        }

        return create_response(200, response_data)

    except Exception as e:
        print(f"Error getting usage stats: {str(e)}")
        return create_response(500, {"error": "Failed to get usage statistics"})


def handle_get_quota(user_id: str) -> Dict[str, Any]:
    """Get quota limits and remaining usage."""
    try:
        usage_tracker = UsageTracker()

        # Get current usage
        stats = usage_tracker.get_usage_stats(user_id)

        # Calculate remaining quota
        daily_remaining = max(0, stats["daily_limit"] - stats["daily_used"])
        monthly_remaining = max(0, stats["monthly_limit"] - stats["monthly_used"])

        # Calculate percentages
        daily_percent = (
            (stats["daily_used"] / stats["daily_limit"]) * 100
            if stats["daily_limit"] > 0
            else 0
        )
        monthly_percent = (
            (stats["monthly_used"] / stats["monthly_limit"]) * 100
            if stats["monthly_limit"] > 0
            else 0
        )

        return create_response(
            200,
            {
                "user_id": user_id,
                "quotas": {
                    "daily": {
                        "limit": stats["daily_limit"],
                        "used": stats["daily_used"],
                        "remaining": daily_remaining,
                        "percent_used": round(daily_percent, 1),
                    },
                    "monthly": {
                        "limit": stats["monthly_limit"],
                        "used": stats["monthly_used"],
                        "remaining": monthly_remaining,
                        "percent_used": round(monthly_percent, 1),
                    },
                },
                "status": determine_quota_status(daily_percent, monthly_percent),
                "last_operation": stats.get("last_operation"),
                "last_updated": stats.get("last_updated"),
            },
        )

    except Exception as e:
        print(f"Error getting quota info: {str(e)}")
        return create_response(500, {"error": "Failed to get quota information"})


def get_historical_usage(user_id: str, days: int = 7) -> List[Dict[str, Any]]:
    """Get historical usage for the last N days."""
    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        from datetime import datetime, timedelta

        # Generate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        historical_data = []

        # Query each day
        # Build batch request keys for better performance
        batch_keys = []
        date_list = []

        for i in range(days):
            query_date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            date_list.append(query_date)
            batch_keys.append({"user_id": user_id, "date": query_date})

        try:
            # Use batch_get_item for better performance (up to 100 items)
            if len(batch_keys) <= 100:
                response = dynamodb.batch_get_item(
                    RequestItems={table.name: {"Keys": batch_keys}}
                )

                # Create lookup dict for retrieved items
                items_by_date = {}
                for item in response.get("Responses", {}).get(table.name, []):
                    items_by_date[item["date"]] = item

                # Build historical data with retrieved items
                for query_date in date_list:
                    if query_date in items_by_date:
                        item = items_by_date[query_date]
                        historical_data.append(
                            {
                                "date": query_date,
                                "daily_count": int(item.get("daily_count", 0)),
                                "operations": dict(item.get("operations", {})),
                            }
                        )
                    else:
                        historical_data.append(
                            {"date": query_date, "daily_count": 0, "operations": {}}
                        )
            else:
                # Fallback to individual queries for very large ranges
                for i in range(days):
                    query_date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")

                    try:
                        response = table.get_item(
                            Key={"user_id": user_id, "date": query_date}
                        )

                        if "Item" in response:
                            item = response["Item"]
                            historical_data.append(
                                {
                                    "date": query_date,
                                    "daily_count": int(item.get("daily_count", 0)),
                                    "operations": dict(item.get("operations", {})),
                                }
                            )
                        else:
                            historical_data.append(
                                {"date": query_date, "daily_count": 0, "operations": {}}
                            )
                    except ClientError as e:
                        print(f"Error getting usage for {query_date}: {e}")
                        historical_data.append(
                            {"date": query_date, "daily_count": 0, "operations": {}}
                        )

        except ClientError as e:
            print(f"Error in batch_get_item: {e}")
            # Fallback to individual queries
            for query_date in date_list:
                try:
                    response = table.get_item(
                        Key={"user_id": user_id, "date": query_date}
                    )

                    if "Item" in response:
                        item = response["Item"]
                        historical_data.append(
                            {
                                "date": query_date,
                                "daily_count": int(item.get("daily_count", 0)),
                                "operations": dict(item.get("operations", {})),
                            }
                        )
                    else:
                        historical_data.append(
                            {"date": query_date, "daily_count": 0, "operations": {}}
                        )
                except ClientError as e:
                    print(f"Error getting usage for {query_date}: {e}")
                    historical_data.append(
                        {"date": query_date, "daily_count": 0, "operations": {}}
                    )

        return historical_data

    except Exception as e:
        print(f"Error getting historical usage: {str(e)}")
        return []


def get_operation_breakdown(user_id: str) -> Dict[str, int]:
    """Get breakdown of usage by operation type for current month."""
    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        from datetime import datetime

        # Get current month data
        current_month = datetime.utcnow().strftime("%Y-%m")

        # Query all records for this user in current month
        from boto3.dynamodb.conditions import Key

        response = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id)
            & Key("date").begins_with(current_month)
        )

        # Aggregate operation counts
        operation_counts = {"transcribe": 0, "query": 0, "total": 0}

        for item in response.get("Items", []):
            last_operation = item.get("last_operation", "")
            daily_count = int(item.get("daily_count", 0))

            if last_operation in operation_counts:
                operation_counts[last_operation] += daily_count

            operation_counts["total"] += daily_count

        return operation_counts

    except Exception as e:
        print(f"Error getting operation breakdown: {str(e)}")
        return {"transcribe": 0, "query": 0, "total": 0}


def determine_quota_status(daily_percent: float, monthly_percent: float) -> str:
    """Determine quota status based on usage percentages."""
    max_percent = max(daily_percent, monthly_percent)

    if max_percent >= 100:
        return "EXCEEDED"
    elif max_percent >= 90:
        return "CRITICAL"
    elif max_percent >= 75:
        return "WARNING"
    elif max_percent >= 50:
        return "MODERATE"
    else:
        return "OK"


def reset_daily_quota(user_id: str) -> bool:
    """Reset daily quota for user (admin function)."""
    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        from datetime import datetime

        from utils import calculate_ttl, get_current_date

        today = get_current_date()

        # Reset daily count but keep monthly count
        response = table.get_item(Key={"user_id": user_id, "date": today})

        if "Item" in response:
            item = response["Item"]
            monthly_count = int(item.get("monthly_count", 0))

            # Update with reset daily count
            table.put_item(
                Item={
                    "user_id": user_id,
                    "date": today,
                    "month": datetime.utcnow().strftime("%Y-%m"),
                    "daily_count": 0,
                    "monthly_count": monthly_count,
                    "last_operation": "quota_reset",
                    "last_updated": datetime.utcnow().isoformat(),
                    "ttl": calculate_ttl(),
                }
            )

        return True

    except Exception as e:
        print(f"Error resetting daily quota: {str(e)}")
        return False


def get_daily_costs(user_id: str) -> Dict[str, float]:
    """Get daily cost breakdown for user."""
    try:
        from datetime import datetime

        today = datetime.utcnow().strftime("%Y-%m-%d")

        # Get cost records for today
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        response = table.query(
            KeyConditionExpression=Key("user_id").eq(f"cost#{user_id}")
            & Key("date").begins_with(today)
        )

        service_costs = {
            "transcribe": 0.0,
            "bedrock": 0.0,
            "lambda": 0.0,
            "s3": 0.0,
            "api_gateway": 0.0,
            "total": 0.0,
        }

        for item in response.get("Items", []):
            total_cost = float(item.get("total_cost", 0))
            service_costs["total"] += total_cost

            # Parse service costs from JSON if available
            import json

            if "service_costs" in item:
                try:
                    service_breakdown = json.loads(item["service_costs"])
                    for service in service_breakdown:
                        service_name = service.get("service", "unknown")
                        service_cost = float(service.get("total_cost", 0))
                        if service_name in service_costs:
                            service_costs[service_name] += service_cost
                except (json.JSONDecodeError, ValueError):
                    pass

        return service_costs

    except Exception as e:
        print(f"Error calculating daily costs: {e}")
        return {
            "total": 0.0,
            "transcribe": 0.0,
            "bedrock": 0.0,
            "lambda": 0.0,
            "s3": 0.0,
            "api_gateway": 0.0,
        }


def get_monthly_costs(user_id: str) -> Dict[str, Any]:
    """Get monthly cost breakdown for user."""
    try:
        from datetime import datetime

        current_month = datetime.utcnow().strftime("%Y-%m")

        # Get cost records for current month
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        response = table.query(
            KeyConditionExpression=Key("user_id").eq(f"cost#{user_id}")
            & Key("date").begins_with(current_month)
        )

        monthly_total = 0.0
        service_breakdown = {}

        for item in response.get("Items", []):
            total_cost = float(item.get("total_cost", 0))
            monthly_total += total_cost

            # Parse service costs
            import json

            if "service_costs" in item:
                try:
                    service_costs = json.loads(item["service_costs"])
                    for service in service_costs:
                        service_name = service.get("service", "unknown")
                        service_cost = float(service.get("total_cost", 0))
                        if service_name not in service_breakdown:
                            service_breakdown[service_name] = 0.0
                        service_breakdown[service_name] += service_cost
                except (json.JSONDecodeError, ValueError):
                    pass

        return {
            "total": monthly_total,
            "services": service_breakdown,
        }

    except Exception as e:
        print(f"Error calculating monthly costs: {e}")
        return {"total": 0.0, "services": {}}


def get_recent_queries(user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Get recent query records for user."""
    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        # Query recent cost records to get query information
        response = table.query(
            KeyConditionExpression=Key("user_id").eq(f"cost#{user_id}"),
            ScanIndexForward=False,  # Descending order
            Limit=limit,
        )

        recent_queries = []
        for item in response.get("Items", []):
            query_info = {
                "timestamp": item.get("date", ""),
                "operation": item.get("operation", "unknown"),
                "cost": float(item.get("total_cost", 0)),
                "currency": "EUR",
            }
            recent_queries.append(query_info)

        return recent_queries

    except Exception as e:
        print(f"Error getting recent queries: {e}")
        return []


def get_quota_limits() -> Dict[str, int]:
    """Get current quota limits from environment."""
    return {
        "daily_limit": int(os.environ.get("DAILY_QUOTA", "50")),
        "monthly_limit": int(os.environ.get("MONTHLY_QUOTA", "1000")),
    }
