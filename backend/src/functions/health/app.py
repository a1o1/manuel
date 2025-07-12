"""
Manuel - Health Check Function (Minimal Version)
Simple health check without complex dependencies
"""

import json
import time
from typing import Any, Dict


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
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
                },
                "body": ""
            }
        
        if method == "GET" and path.endswith("/health"):
            # Basic health check response
            health_data = {
                "status": "healthy",
                "timestamp": int(time.time()),
                "service": "manuel-backend",
                "version": "minimal-v1.0.0",
                "region": context.invoked_function_arn.split(":")[3] if context.invoked_function_arn else "unknown",
                "environment": "dev",
                "checks": {
                    "lambda": {"status": "healthy", "message": "Function executing normally"},
                    "memory": {
                        "status": "healthy", 
                        "used_mb": context.memory_limit_in_mb if hasattr(context, 'memory_limit_in_mb') else "unknown",
                        "available_mb": 512
                    }
                },
                "uptime_seconds": context.get_remaining_time_in_millis() / 1000 if context else "unknown"
            }
            
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps(health_data)
            }
        
        else:
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": "Endpoint not found"})
            }
            
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "status": "unhealthy",
                "error": str(e),
                "timestamp": int(time.time())
            })
        }