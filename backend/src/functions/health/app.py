"""
Manuel - Health Check Function
Provides comprehensive health checks and service monitoring
"""

import sys
from typing import Any, Dict

sys.path.append("/opt/python")
sys.path.append("../../shared")

from health_checker import HealthStatus, get_health_checker
from logger import get_logger
from utils import create_response, handle_options_request


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle health check requests

    Endpoints:
    GET /health - Basic health check
    GET /health/deep - Deep health check (all services)
    GET /health/circuit-breakers - Circuit breaker status
    POST /health/circuit-breakers/{service}/reset - Reset circuit breaker
    """

    # Handle CORS preflight
    if event["httpMethod"] == "OPTIONS":
        return handle_options_request()

    logger = get_logger("manuel-health", context)
    health_checker = get_health_checker()

    try:
        path = event.get("path", "")
        method = event.get("httpMethod", "GET")

        logger.info("Health check request", path=path, method=method)

        if method == "GET":
            if path.endswith("/health/deep"):
                return handle_deep_health_check(health_checker, logger)
            elif path.endswith("/health/circuit-breakers"):
                return handle_circuit_breaker_status(health_checker, logger)
            elif path.endswith("/health"):
                return handle_basic_health_check(health_checker, logger)
            else:
                return create_response(404, {"error": "Health endpoint not found"})

        elif method == "POST":
            if "/circuit-breakers/" in path and path.endswith("/reset"):
                return handle_circuit_breaker_reset(event, health_checker, logger)
            else:
                return create_response(404, {"error": "Health endpoint not found"})

        else:
            return create_response(405, {"error": "Method not allowed"})

    except Exception as e:
        logger.error("Error in health check", error=str(e), error_type=type(e).__name__)
        return create_response(
            500,
            {"error": "Health check failed", "status": "unhealthy", "details": str(e)},
        )


def handle_basic_health_check(health_checker, logger) -> Dict[str, Any]:
    """Handle basic health check (lightweight)"""

    try:
        # Only check essential services for basic health check
        health_report = health_checker.perform_health_check(include_deep_checks=False)

        # Determine HTTP status code based on health
        if (
            health_report.overall_status == HealthStatus.HEALTHY
            or health_report.overall_status == HealthStatus.DEGRADED
        ):
            status_code = 200  # Healthy or degraded but operational
        else:
            status_code = 503  # Service unavailable

        logger.info(
            "Basic health check completed",
            overall_status=health_report.overall_status.value,
            services_checked=len(health_report.checks),
        )

        response_data = health_report.to_dict()
        response_data["check_type"] = "basic"

        return create_response(status_code, response_data)

    except Exception as e:
        logger.error("Basic health check failed", error=str(e))
        return create_response(
            503,
            {
                "status": "unhealthy",
                "error": "Health check system failure",
                "details": str(e),
                "check_type": "basic",
            },
        )


def handle_deep_health_check(health_checker, logger) -> Dict[str, Any]:
    """Handle deep health check (comprehensive)"""

    try:
        # Full health check including all external services
        health_report = health_checker.perform_health_check(include_deep_checks=True)

        # Determine HTTP status code based on health
        if (
            health_report.overall_status == HealthStatus.HEALTHY
            or health_report.overall_status == HealthStatus.DEGRADED
        ):
            status_code = 200  # Healthy or degraded but operational
        else:
            status_code = 503  # Service unavailable

        logger.info(
            "Deep health check completed",
            overall_status=health_report.overall_status.value,
            services_checked=len(health_report.checks),
            avg_response_time=health_report.summary.get("average_response_time_ms"),
        )

        response_data = health_report.to_dict()
        response_data["check_type"] = "deep"

        return create_response(status_code, response_data)

    except Exception as e:
        logger.error("Deep health check failed", error=str(e))
        return create_response(
            503,
            {
                "status": "unhealthy",
                "error": "Deep health check system failure",
                "details": str(e),
                "check_type": "deep",
            },
        )


def handle_circuit_breaker_status(health_checker, logger) -> Dict[str, Any]:
    """Handle circuit breaker status request"""

    try:
        status = health_checker.get_circuit_breaker_status()

        logger.info(
            "Circuit breaker status retrieved",
            circuit_breaker_count=len(status["circuit_breakers"]),
        )

        return create_response(200, status)

    except Exception as e:
        logger.error("Circuit breaker status failed", error=str(e))
        return create_response(
            500, {"error": "Failed to get circuit breaker status", "details": str(e)}
        )


def handle_circuit_breaker_reset(event, health_checker, logger) -> Dict[str, Any]:
    """Handle circuit breaker reset request"""

    try:
        # Extract service name from path
        path = event.get("path", "")
        path_parts = path.split("/")

        # Find service name in path: /health/circuit-breakers/{service}/reset
        service_name = None
        for i, part in enumerate(path_parts):
            if part == "circuit-breakers" and i + 1 < len(path_parts):
                service_name = path_parts[i + 1]
                break

        if not service_name:
            return create_response(400, {"error": "Service name not specified in path"})

        # Reset the circuit breaker
        success = health_checker.reset_circuit_breaker(service_name)

        if success:
            logger.info("Circuit breaker reset", service=service_name)
            return create_response(
                200,
                {
                    "message": f"Circuit breaker for {service_name} has been reset",
                    "service": service_name,
                    "status": "reset",
                },
            )
        else:
            logger.warning(
                "Circuit breaker reset failed - service not found", service=service_name
            )
            return create_response(
                404, {"error": f"Circuit breaker for service {service_name} not found"}
            )

    except Exception as e:
        logger.error("Circuit breaker reset failed", error=str(e))
        return create_response(
            500, {"error": "Failed to reset circuit breaker", "details": str(e)}
        )


def get_service_dependencies() -> Dict[str, Any]:
    """Get service dependency information"""
    return {
        "dependencies": {
            "critical": [
                {
                    "service": "dynamodb",
                    "purpose": "User quota and usage tracking",
                    "fallback": "Block new requests if unavailable",
                },
                {
                    "service": "bedrock",
                    "purpose": "AI text generation and embeddings",
                    "fallback": "Return error message to user",
                },
            ],
            "important": [
                {
                    "service": "transcribe",
                    "purpose": "Audio to text conversion",
                    "fallback": "Audio transcription unavailable",
                },
                {
                    "service": "knowledge_base",
                    "purpose": "RAG context retrieval",
                    "fallback": "Generate answers without context",
                },
            ],
            "supporting": [
                {
                    "service": "s3",
                    "purpose": "Manual and audio file storage",
                    "fallback": "Temporary storage issues",
                }
            ],
        },
        "health_check_endpoints": {
            "basic": "/health",
            "deep": "/health/deep",
            "circuit_breakers": "/health/circuit-breakers",
        },
    }
