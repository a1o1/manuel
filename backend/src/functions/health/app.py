"""
Manuel - Health Check Function (Minimal Version)
Simple health check with Redis cache validation
"""

import json
import os
import time
from typing import Any, Dict


def test_redis_connection() -> Dict[str, Any]:
    """Test Redis connectivity and basic operations"""
    try:
        redis_endpoint = os.environ.get("REDIS_ENDPOINT", "")
        redis_port = os.environ.get("REDIS_PORT", "6379")
        enable_redis = os.environ.get("ENABLE_REDIS_CACHE", "false").lower() == "true"

        if not enable_redis or not redis_endpoint:
            return {"status": "disabled", "message": "Redis cache is not enabled"}

        # Try to import redis - if not available, test basic connectivity
        try:
            import redis
        except ImportError:
            # Test basic network connectivity to Redis endpoint
            import socket

            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(5)
                result = sock.connect_ex((redis_endpoint, int(redis_port)))
                sock.close()
                if result == 0:
                    connectivity_status = "network_reachable"
                    connectivity_message = (
                        "Redis endpoint is reachable but client library not available"
                    )
                else:
                    connectivity_status = "network_unreachable"
                    connectivity_message = (
                        f"Cannot connect to Redis endpoint (error: {result})"
                    )
            except Exception as e:
                connectivity_status = "network_error"
                connectivity_message = f"Network test failed: {str(e)}"

            return {
                "status": "unavailable",
                "message": "Redis client library not installed",
                "endpoint": redis_endpoint,
                "port": redis_port,
                "connectivity": connectivity_status,
                "connectivity_message": connectivity_message,
            }

        # Test Redis connection
        start_time = time.time()

        # Connect to Redis
        r = redis.Redis(
            host=redis_endpoint,
            port=int(redis_port),
            socket_connect_timeout=5,
            socket_timeout=5,
            decode_responses=True,
        )

        # Test basic operations
        test_key = f"health_check_{int(time.time())}"
        test_value = "health_test_value"

        # SET operation
        r.set(test_key, test_value, ex=60)  # Expire in 60 seconds

        # GET operation
        retrieved_value = r.get(test_key)

        # DELETE operation
        r.delete(test_key)

        # Calculate response time
        response_time_ms = round((time.time() - start_time) * 1000, 2)

        if retrieved_value == test_value:
            return {
                "status": "healthy",
                "message": "Redis cache is operational",
                "endpoint": redis_endpoint,
                "port": redis_port,
                "response_time_ms": response_time_ms,
                "operations": ["SET", "GET", "DELETE"],
                "test_key": test_key,
            }
        else:
            return {
                "status": "error",
                "message": "Redis operations failed - value mismatch",
                "endpoint": redis_endpoint,
                "expected": test_value,
                "received": retrieved_value,
            }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Redis connection failed: {str(e)}",
            "endpoint": redis_endpoint if "redis_endpoint" in locals() else "unknown",
            "port": redis_port if "redis_port" in locals() else "unknown",
        }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle health check requests"""

    try:
        # Simple health check without dependencies
        method = event.get("httpMethod", "GET")
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

        if method == "GET" and path.endswith("/health"):
            # Basic health check response with Redis testing
            redis_check = test_redis_connection()

            # Determine overall health status
            overall_status = "healthy"
            if redis_check.get("status") == "error":
                overall_status = "degraded"

            health_data = {
                "status": overall_status,
                "timestamp": int(time.time()),
                "service": "manuel-backend",
                "version": "minimal-v1.0.1",
                "region": (
                    context.invoked_function_arn.split(":")[3]
                    if context.invoked_function_arn
                    else "unknown"
                ),
                "environment": "dev",
                "checks": {
                    "lambda": {
                        "status": "healthy",
                        "message": "Function executing normally",
                    },
                    "memory": {
                        "status": "healthy",
                        "used_mb": (
                            context.memory_limit_in_mb
                            if hasattr(context, "memory_limit_in_mb")
                            else "unknown"
                        ),
                        "available_mb": 512,
                    },
                    "redis_cache": redis_check,
                },
                "uptime_seconds": (
                    context.get_remaining_time_in_millis() / 1000
                    if context
                    else "unknown"
                ),
            }

            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps(health_data),
            }

        else:
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Endpoint not found"}),
            }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {"status": "unhealthy", "error": str(e), "timestamp": int(time.time())}
            ),
        }
