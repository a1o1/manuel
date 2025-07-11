"""
Manuel - Admin and Operator Tooling Function
Provides administrative APIs for system management and operations
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Any, Dict, List

import boto3
from botocore.exceptions import ClientError

sys.path.append("/opt/python")
sys.path.append("../../shared")

from cost_calculator import get_cost_calculator
from health_checker import get_health_checker
from logger import LoggingContext, ManuelLogger, get_logger
from utils import create_response, handle_options_request


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle admin and operator requests

    Endpoints:
    GET /admin/users - List users and usage statistics
    GET /admin/users/{user_id} - Get detailed user information
    POST /admin/users/{user_id}/quota - Update user quota
    DELETE /admin/users/{user_id} - Delete user and data

    GET /admin/system/status - Comprehensive system status
    GET /admin/system/metrics - System performance metrics
    POST /admin/system/maintenance - Put system in maintenance mode

    GET /admin/costs - Cost analysis and reporting
    GET /admin/costs/users - Cost breakdown by user
    GET /admin/costs/forecast - Cost forecasting

    POST /admin/operations/cleanup - Cleanup old data
    POST /admin/operations/migrate - Data migration operations
    POST /admin/operations/scale - Scale system components
    """

    # Handle CORS preflight
    if event["httpMethod"] == "OPTIONS":
        return handle_options_request()

    logger = get_logger("manuel-admin", context)

    try:
        path = event.get("path", "")
        method = event.get("httpMethod", "GET")

        # Basic admin authentication check
        if not is_admin_authorized(event):
            logger.warning(
                "Unauthorized admin access attempt", path=path, method=method
            )
            return create_response(403, {"error": "Admin access denied"})

        logger.info("Admin API request", path=path, method=method)

        # Route to appropriate handler
        if "/admin/users" in path:
            return handle_user_management(event, logger)
        elif "/admin/system" in path:
            return handle_system_management(event, logger)
        elif "/admin/costs" in path:
            return handle_cost_management(event, logger)
        elif "/admin/operations" in path:
            return handle_operations(event, logger)
        else:
            return create_response(404, {"error": "Admin endpoint not found"})

    except Exception as e:
        logger.error("Error in admin API", error=str(e), error_type=type(e).__name__)
        return create_response(
            500, {"error": "Admin operation failed", "details": str(e)}
        )


def is_admin_authorized(event: Dict[str, Any]) -> bool:
    """Check if request has admin authorization"""

    # In production, this would validate admin tokens/roles
    # For now, check for admin API key
    headers = event.get("headers", {})
    admin_key = headers.get("X-Admin-Key", "") or headers.get("x-admin-key", "")

    expected_key = os.environ.get("ADMIN_API_KEY", "dev-admin-key")
    return admin_key == expected_key


def handle_user_management(event: Dict[str, Any], logger) -> Dict[str, Any]:
    """Handle user management operations"""

    path = event.get("path", "")
    method = event.get("httpMethod", "GET")

    try:
        if method == "GET":
            if path.endswith("/admin/users"):
                return get_users_list(logger)
            elif "/admin/users/" in path and not path.endswith("/quota"):
                user_id = extract_user_id_from_path(path)
                return get_user_details(user_id, logger)
            else:
                return create_response(404, {"error": "User endpoint not found"})

        elif method == "POST":
            if path.endswith("/quota"):
                user_id = extract_user_id_from_path(path)
                return update_user_quota(event, user_id, logger)
            else:
                return create_response(404, {"error": "User operation not found"})

        elif method == "DELETE":
            if "/admin/users/" in path:
                user_id = extract_user_id_from_path(path)
                return delete_user_data(user_id, logger)
            else:
                return create_response(404, {"error": "User operation not found"})

        else:
            return create_response(405, {"error": "Method not allowed"})

    except Exception as e:
        logger.error("User management error", error=str(e))
        return create_response(
            500, {"error": "User management operation failed", "details": str(e)}
        )


def handle_system_management(event: Dict[str, Any], logger) -> Dict[str, Any]:
    """Handle system management operations"""

    path = event.get("path", "")
    method = event.get("httpMethod", "GET")

    try:
        if method == "GET":
            if path.endswith("/admin/system/status"):
                return get_system_status(logger)
            elif path.endswith("/admin/system/metrics"):
                return get_system_metrics(logger)
            else:
                return create_response(404, {"error": "System endpoint not found"})

        elif method == "POST":
            if path.endswith("/admin/system/maintenance"):
                return toggle_maintenance_mode(event, logger)
            else:
                return create_response(404, {"error": "System operation not found"})

        else:
            return create_response(405, {"error": "Method not allowed"})

    except Exception as e:
        logger.error("System management error", error=str(e))
        return create_response(
            500, {"error": "System management operation failed", "details": str(e)}
        )


def handle_cost_management(event: Dict[str, Any], logger) -> Dict[str, Any]:
    """Handle cost analysis and reporting"""

    path = event.get("path", "")
    method = event.get("httpMethod", "GET")

    try:
        if method == "GET":
            if path.endswith("/admin/costs"):
                return get_cost_analysis(event, logger)
            elif path.endswith("/admin/costs/users"):
                return get_user_cost_breakdown(event, logger)
            elif path.endswith("/admin/costs/forecast"):
                return get_cost_forecast(event, logger)
            else:
                return create_response(404, {"error": "Cost endpoint not found"})

        else:
            return create_response(405, {"error": "Method not allowed"})

    except Exception as e:
        logger.error("Cost management error", error=str(e))
        return create_response(
            500, {"error": "Cost management operation failed", "details": str(e)}
        )


def handle_operations(event: Dict[str, Any], logger) -> Dict[str, Any]:
    """Handle operational tasks"""

    path = event.get("path", "")
    method = event.get("httpMethod", "POST")

    try:
        if method == "POST":
            if path.endswith("/admin/operations/cleanup"):
                return perform_data_cleanup(event, logger)
            elif path.endswith("/admin/operations/migrate"):
                return perform_data_migration(event, logger)
            elif path.endswith("/admin/operations/scale"):
                return perform_scaling_operation(event, logger)
            else:
                return create_response(404, {"error": "Operation not found"})

        else:
            return create_response(405, {"error": "Method not allowed"})

    except Exception as e:
        logger.error("Operations error", error=str(e))
        return create_response(500, {"error": "Operation failed", "details": str(e)})


def get_users_list(logger) -> Dict[str, Any]:
    """Get list of users with usage statistics"""

    try:
        with LoggingContext(logger, "UsersList"):
            dynamodb = boto3.resource("dynamodb")
            table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

            # Scan for unique users (this could be optimized with GSI)
            response = table.scan(
                ProjectionExpression="user_id, #date, daily_used, monthly_used",
                ExpressionAttributeNames={"#date": "date"},
            )

            # Aggregate user data
            users_data = {}
            for item in response["Items"]:
                user_id = item["user_id"]
                if user_id not in users_data:
                    users_data[user_id] = {
                        "user_id": user_id,
                        "total_daily_usage": 0,
                        "total_monthly_usage": 0,
                        "last_activity": None,
                        "activity_days": 0,
                    }

                users_data[user_id]["total_daily_usage"] += int(
                    item.get("daily_used", 0)
                )
                users_data[user_id]["total_monthly_usage"] += int(
                    item.get("monthly_used", 0)
                )
                users_data[user_id]["activity_days"] += 1

                # Track latest activity
                item_date = item.get("date", "")
                if (
                    not users_data[user_id]["last_activity"]
                    or item_date > users_data[user_id]["last_activity"]
                ):
                    users_data[user_id]["last_activity"] = item_date

            users_list = list(users_data.values())

            # Sort by usage
            users_list.sort(key=lambda x: x["total_monthly_usage"], reverse=True)

            total_monthly_usage = sum(u["total_monthly_usage"] for u in users_list)
            summary = {
                "total_users": len(users_list),
                "active_users_last_7_days": sum(
                    1 for u in users_list if is_recent_activity(u["last_activity"], 7)
                ),
                "total_requests_this_month": total_monthly_usage,
                "average_requests_per_user": (
                    total_monthly_usage / len(users_list) if users_list else 0
                ),
            }

            logger.info(
                "Users list retrieved",
                total_users=summary["total_users"],
                active_users=summary["active_users_last_7_days"],
            )

            return create_response(
                200,
                {
                    "users": users_list,
                    "summary": summary,
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )

    except Exception as e:
        logger.error("Get users list failed", error=str(e))
        return create_response(
            500, {"error": "Failed to retrieve users list", "details": str(e)}
        )


def get_user_details(user_id: str, logger) -> Dict[str, Any]:
    """Get detailed information for a specific user"""

    try:
        with LoggingContext(logger, "UserDetails"):
            # Get user data from DynamoDB
            dynamodb = boto3.resource("dynamodb")
            table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

            response = table.query(
                KeyConditionExpression="user_id = :uid",
                ExpressionAttributeValues={":uid": user_id},
            )

            items = response["Items"]
            if not items:
                return create_response(404, {"error": f"User {user_id} not found"})

            # Get user info from Cognito
            cognito_info = get_cognito_user_info(user_id)

            # Aggregate usage data
            usage_history = []
            total_usage = {"daily": 0, "monthly": 0}

            for item in items:
                usage_history.append(
                    {
                        "date": item["date"],
                        "daily_used": int(item.get("daily_used", 0)),
                        "monthly_used": int(item.get("monthly_used", 0)),
                        "operation_counts": item.get("operation_counts", {}),
                    }
                )
                total_usage["daily"] += int(item.get("daily_used", 0))
                total_usage["monthly"] += int(item.get("monthly_used", 0))

            # Sort by date
            usage_history.sort(key=lambda x: x["date"], reverse=True)

            user_details = {
                "user_id": user_id,
                "cognito_info": cognito_info,
                "usage_summary": {
                    "total_requests": total_usage["monthly"],
                    "avg_daily_requests": (
                        total_usage["daily"] / len(items) if items else 0
                    ),
                    "last_activity": (
                        usage_history[0]["date"] if usage_history else None
                    ),
                    "account_age_days": len(items),
                },
                "usage_history": usage_history[:30],  # Last 30 entries
                "timestamp": datetime.utcnow().isoformat(),
            }

            logger.info(
                "User details retrieved",
                user_id=user_id,
                total_requests=total_usage["monthly"],
            )

            return create_response(200, user_details)

    except Exception as e:
        logger.error("Get user details failed", error=str(e), user_id=user_id)
        return create_response(
            500, {"error": "Failed to retrieve user details", "details": str(e)}
        )


def get_system_status(logger) -> Dict[str, Any]:
    """Get comprehensive system status"""

    try:
        with LoggingContext(logger, "SystemStatus"):
            health_checker = get_health_checker()

            # Get health check results
            health_report = health_checker.perform_health_check(
                include_deep_checks=True
            )

            # Get Lambda function metrics
            cloudwatch = boto3.client("cloudwatch")
            lambda_metrics = get_lambda_metrics(cloudwatch)

            # Get API Gateway metrics
            api_metrics = get_api_gateway_metrics(cloudwatch)

            # Get DynamoDB metrics
            dynamodb_metrics = get_dynamodb_metrics(cloudwatch)

            # Get cost information
            cost_calculator = get_cost_calculator()
            current_costs = get_current_cost_summary(cost_calculator)

            system_status = {
                "overall_health": health_report.overall_status.value,
                "health_details": health_report.to_dict(),
                "performance_metrics": {
                    "lambda": lambda_metrics,
                    "api_gateway": api_metrics,
                    "dynamodb": dynamodb_metrics,
                },
                "cost_summary": current_costs,
                "timestamp": datetime.utcnow().isoformat(),
                "system_info": {
                    "stage": os.environ.get("STAGE", "unknown"),
                    "region": os.environ.get("AWS_REGION", "unknown"),
                    "version": "1.1",
                },
            }

            logger.info(
                "System status retrieved",
                overall_health=health_report.overall_status.value,
            )

            return create_response(200, system_status)

    except Exception as e:
        logger.error("Get system status failed", error=str(e))
        return create_response(
            500, {"error": "Failed to retrieve system status", "details": str(e)}
        )


def get_cost_analysis(event: Dict[str, Any], logger) -> Dict[str, Any]:
    """Get comprehensive cost analysis"""

    try:
        query_params = event.get("queryStringParameters") or {}
        days = int(query_params.get("days", "7"))

        with LoggingContext(logger, "CostAnalysis"):
            # Get cost data from DynamoDB
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)

            cost_data = get_cost_data_range(start_date, end_date)

            # Analyze costs by service, operation, and time
            analysis = {
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": days,
                },
                "total_cost": sum(item.get("total_cost", 0) for item in cost_data),
                "cost_by_service": aggregate_costs_by_service(cost_data),
                "cost_by_operation": aggregate_costs_by_operation(cost_data),
                "daily_breakdown": aggregate_costs_by_day(cost_data),
                "cost_trends": calculate_cost_trends(cost_data),
                "top_expensive_requests": get_top_expensive_requests(cost_data),
                "recommendations": generate_cost_recommendations(cost_data),
            }

            logger.info(
                "Cost analysis completed",
                period_days=days,
                total_cost=analysis["total_cost"],
            )

            return create_response(200, analysis)

    except Exception as e:
        logger.error("Cost analysis failed", error=str(e))
        return create_response(
            500, {"error": "Cost analysis failed", "details": str(e)}
        )


def perform_data_cleanup(event: Dict[str, Any], logger) -> Dict[str, Any]:
    """Perform data cleanup operations"""

    try:
        body = json.loads(event.get("body", "{}"))
        cleanup_type = body.get("type", "expired_data")
        dry_run = body.get("dry_run", True)

        with LoggingContext(logger, "DataCleanup"):
            results = {
                "cleanup_type": cleanup_type,
                "dry_run": dry_run,
                "timestamp": datetime.utcnow().isoformat(),
                "actions": [],
            }

            if cleanup_type == "expired_data":
                # Clean up expired usage data
                expired_count = cleanup_expired_usage_data(dry_run, logger)
                results["actions"].append(
                    {
                        "action": "cleanup_expired_usage_data",
                        "items_affected": expired_count,
                        "dry_run": dry_run,
                    }
                )

            elif cleanup_type == "old_logs":
                # Clean up old CloudWatch logs
                log_groups_cleaned = cleanup_old_logs(dry_run, logger)
                results["actions"].append(
                    {
                        "action": "cleanup_old_logs",
                        "log_groups_affected": log_groups_cleaned,
                        "dry_run": dry_run,
                    }
                )

            elif cleanup_type == "cost_data":
                # Clean up old cost tracking data
                cost_records_cleaned = cleanup_old_cost_data(dry_run, logger)
                results["actions"].append(
                    {
                        "action": "cleanup_old_cost_data",
                        "records_affected": cost_records_cleaned,
                        "dry_run": dry_run,
                    }
                )

            logger.info(
                "Data cleanup completed",
                cleanup_type=cleanup_type,
                dry_run=dry_run,
                actions_count=len(results["actions"]),
            )

            return create_response(200, results)

    except Exception as e:
        logger.error("Data cleanup failed", error=str(e))
        return create_response(500, {"error": "Data cleanup failed", "details": str(e)})


# Utility functions


def extract_user_id_from_path(path: str) -> str:
    """Extract user ID from API path"""
    parts = path.split("/")
    for i, part in enumerate(parts):
        if part == "users" and i + 1 < len(parts):
            return parts[i + 1]
    return ""


def is_recent_activity(last_activity: str, days: int) -> bool:
    """Check if activity is within specified days"""
    if not last_activity:
        return False

    try:
        activity_date = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
        return (datetime.utcnow() - activity_date).days <= days
    except (ValueError, TypeError, AttributeError):
        return False


def get_cognito_user_info(user_id: str) -> Dict[str, Any]:
    """Get user information from Cognito"""
    try:
        cognito = boto3.client("cognito-idp")
        user_pool_id = os.environ.get("USER_POOL_ID")

        if not user_pool_id:
            return {"error": "User pool not configured"}

        response = cognito.admin_get_user(UserPoolId=user_pool_id, Username=user_id)

        attributes = {
            attr["Name"]: attr["Value"] for attr in response.get("UserAttributes", [])
        }

        return {
            "username": response.get("Username"),
            "user_status": response.get("UserStatus"),
            "enabled": response.get("Enabled"),
            "created": (
                response.get("UserCreateDate", "").isoformat()
                if response.get("UserCreateDate")
                else None
            ),
            "last_modified": (
                response.get("UserLastModifiedDate", "").isoformat()
                if response.get("UserLastModifiedDate")
                else None
            ),
            "email": attributes.get("email"),
            "email_verified": attributes.get("email_verified") == "true",
        }

    except ClientError as e:
        if e.response["Error"]["Code"] == "UserNotFoundException":
            return {"error": "User not found in Cognito"}
        return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}


def get_lambda_metrics(cloudwatch: Any) -> Dict[str, Any]:
    """Get Lambda function metrics"""
    try:
        # This is a simplified version - in production you'd get more
        # comprehensive metrics
        return {
            "note": "Lambda metrics would be retrieved from CloudWatch",
            "avg_duration": "TBD",
            "error_rate": "TBD",
            "invocation_count": "TBD",
        }
    except Exception:
        return {"error": "Failed to retrieve Lambda metrics"}


def get_api_gateway_metrics(cloudwatch: Any) -> Dict[str, Any]:
    """Get API Gateway metrics"""
    try:
        return {
            "note": "API Gateway metrics would be retrieved from CloudWatch",
            "request_count": "TBD",
            "error_rate": "TBD",
            "latency": "TBD",
        }
    except Exception:
        return {"error": "Failed to retrieve API Gateway metrics"}


def get_dynamodb_metrics(cloudwatch: Any) -> Dict[str, Any]:
    """Get DynamoDB metrics"""
    try:
        return {
            "note": "DynamoDB metrics would be retrieved from CloudWatch",
            "read_capacity": "TBD",
            "write_capacity": "TBD",
            "throttled_requests": "TBD",
        }
    except Exception:
        return {"error": "Failed to retrieve DynamoDB metrics"}


def get_current_cost_summary(cost_calculator: Any) -> Dict[str, Any]:
    """Get current cost summary"""
    try:
        return {
            "note": "Cost summary would be calculated from recent data",
            "daily_cost": "TBD",
            "monthly_cost": "TBD",
            "cost_trend": "TBD",
        }
    except Exception:
        return {"error": "Failed to retrieve cost summary"}


def get_cost_data_range(
    start_date: datetime, end_date: datetime
) -> List[Dict[str, Any]]:
    """Get cost data for date range"""
    # Placeholder - would query DynamoDB for cost data
    return []


def aggregate_costs_by_service(cost_data: List[Dict[str, Any]]) -> Dict[str, float]:
    """Aggregate costs by AWS service"""
    return {"placeholder": 0.0}


def aggregate_costs_by_operation(cost_data: List[Dict[str, Any]]) -> Dict[str, float]:
    """Aggregate costs by operation type"""
    return {"placeholder": 0.0}


def aggregate_costs_by_day(cost_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Aggregate costs by day"""
    return []


def calculate_cost_trends(cost_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate cost trends"""
    return {"trend": "stable"}


def get_top_expensive_requests(cost_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Get most expensive requests"""
    return []


def generate_cost_recommendations(cost_data: List[Dict[str, Any]]) -> List[str]:
    """Generate cost optimization recommendations"""
    return ["Consider implementing caching for frequent queries"]


def cleanup_expired_usage_data(dry_run: bool, logger: ManuelLogger) -> int:
    """Clean up expired usage data"""
    # Placeholder - would clean up old DynamoDB records
    logger.info("Cleanup expired usage data", dry_run=dry_run)
    return 0


def cleanup_old_logs(dry_run: bool, logger: ManuelLogger) -> int:
    """Clean up old CloudWatch logs"""
    # Placeholder - would clean up old log groups
    logger.info("Cleanup old logs", dry_run=dry_run)
    return 0


def cleanup_old_cost_data(dry_run: bool, logger: ManuelLogger) -> int:
    """Clean up old cost data"""
    # Placeholder - would clean up old cost tracking records
    logger.info("Cleanup old cost data", dry_run=dry_run)
    return 0


def update_user_quota(
    event: Dict[str, Any], user_id: str, logger: ManuelLogger
) -> Dict[str, Any]:
    """Update user quota limits"""
    logger.info("Update user quota placeholder", user_id=user_id)
    return create_response(
        200, {"message": "Quota update functionality to be implemented"}
    )


def delete_user_data(user_id: str, logger: ManuelLogger) -> Dict[str, Any]:
    """Delete all user data"""
    logger.warning("Delete user data placeholder", user_id=user_id)
    return create_response(
        200, {"message": "User deletion functionality to be implemented"}
    )


def get_system_metrics(logger: ManuelLogger) -> Dict[str, Any]:
    """Get detailed system metrics"""
    logger.info("Get system metrics placeholder")
    return create_response(
        200, {"message": "System metrics functionality to be implemented"}
    )


def toggle_maintenance_mode(
    event: Dict[str, Any], logger: ManuelLogger
) -> Dict[str, Any]:
    """Toggle system maintenance mode"""
    logger.info("Toggle maintenance mode placeholder")
    return create_response(
        200, {"message": "Maintenance mode functionality to be implemented"}
    )


def get_user_cost_breakdown(
    event: Dict[str, Any], logger: ManuelLogger
) -> Dict[str, Any]:
    """Get cost breakdown by user"""
    logger.info("Get user cost breakdown placeholder")
    return create_response(
        200, {"message": "User cost breakdown functionality to be implemented"}
    )


def get_cost_forecast(event: Dict[str, Any], logger: ManuelLogger) -> Dict[str, Any]:
    """Get cost forecasting"""
    logger.info("Get cost forecast placeholder")
    return create_response(
        200, {"message": "Cost forecasting functionality to be implemented"}
    )


def perform_data_migration(
    event: Dict[str, Any], logger: ManuelLogger
) -> Dict[str, Any]:
    """Perform data migration"""
    logger.info("Perform data migration placeholder")
    return create_response(
        200, {"message": "Data migration functionality to be implemented"}
    )


def perform_scaling_operation(
    event: Dict[str, Any], logger: ManuelLogger
) -> Dict[str, Any]:
    """Perform scaling operation"""
    logger.info("Perform scaling operation placeholder")
    return create_response(
        200, {"message": "Scaling operation functionality to be implemented"}
    )
