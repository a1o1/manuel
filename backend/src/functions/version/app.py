"""
Manuel - API Version Information Function
Provides information about API versions, capabilities, and compatibility
"""

import json
import os
import sys
from typing import Any, Dict

sys.path.append("/opt/python")
sys.path.append("../../shared")

from api_versioning import ApiVersion, get_versioning_handler
from logger import get_logger
from utils import create_response, handle_options_request


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle API version information requests

    Endpoints:
    GET /version - Get current API version info
    GET /version/compatibility - Get version compatibility matrix
    GET /version/changelog - Get version changelog
    """

    # Handle CORS preflight
    if event["httpMethod"] == "OPTIONS":
        return handle_options_request()

    logger = get_logger("manuel-version", context)
    versioning_handler = get_versioning_handler()

    try:
        path = event.get("path", "")
        method = event.get("httpMethod", "GET")

        # Extract version from request
        requested_version = versioning_handler.extract_version_from_event(event)

        logger.info(
            "Version API request",
            path=path,
            method=method,
            requested_version=requested_version.value,
        )

        if method != "GET":
            return create_versioned_error_response(
                "Method not allowed", 405, requested_version
            )

        if path.endswith("/version/compatibility"):
            return handle_compatibility_info(
                requested_version, versioning_handler, logger
            )
        elif path.endswith("/version/changelog"):
            return handle_changelog_info(requested_version, versioning_handler, logger)
        elif path.endswith("/version"):
            return handle_version_info(requested_version, versioning_handler, logger)
        else:
            return create_versioned_error_response(
                "Version endpoint not found", 404, requested_version
            )

    except Exception as e:
        logger.error("Error in version API", error=str(e), error_type=type(e).__name__)
        return create_versioned_error_response(
            "Version API failed", 500, ApiVersion.V1_1
        )


def handle_version_info(version: ApiVersion, handler, logger) -> Dict[str, Any]:
    """Handle version information request"""

    try:
        # Validate version compatibility
        is_supported, warning = handler.validate_version_compatibility(version)

        if not is_supported:
            return create_versioned_error_response(warning, 400, version)

        version_info = handler.get_version_info()

        # Add runtime information
        version_info.update(
            {
                "environment": {
                    "stage": os.environ.get("STAGE", "unknown"),
                    "region": os.environ.get("AWS_REGION", "unknown"),
                    "runtime": "python3.11",
                },
                "features": get_feature_matrix(version),
                "request_version": version.value,
                "timestamp": "2025-01-10T12:00:00.000Z",
            }
        )

        if warning:
            version_info["warning"] = warning

        logger.info(
            "Version info provided",
            requested_version=version.value,
            current_version=version_info["current_version"],
        )

        return create_versioned_response(version_info, version, handler)

    except Exception as e:
        logger.error("Version info failed", error=str(e))
        return create_versioned_error_response(
            "Failed to get version info", 500, version
        )


def handle_compatibility_info(version: ApiVersion, handler, logger) -> Dict[str, Any]:
    """Handle compatibility matrix request"""

    try:
        compatibility_info = {
            "matrix": {
                "v1.0": {
                    "supported": True,
                    "deprecated": False,
                    "breaking_changes": [],
                    "migration_guide": "No migration required for v1.0",
                    "capabilities": get_feature_matrix(ApiVersion.V1_0),
                },
                "v1.1": {
                    "supported": True,
                    "deprecated": False,
                    "breaking_changes": [],
                    "migration_guide": "Enhanced features, backward compatible",
                    "capabilities": get_feature_matrix(ApiVersion.V1_1),
                },
            },
            "migration_paths": {
                "v1.0_to_v1.1": {
                    "automatic": True,
                    "breaking_changes": [],
                    "new_features": [
                        "Enhanced cost tracking",
                        "Detailed usage metrics",
                        "Circuit breaker status",
                        "Backup operations",
                    ],
                    "deprecated_features": [],
                }
            },
            "version_detection": {
                "methods": [
                    "Accept: application/vnd.manuel.v{version}+json (recommended)",
                    "API-Version: {version} header",
                    "version={version} query parameter",
                    "/v{version}/ path prefix",
                ],
                "default_behavior": f"Uses v{handler.current_version.value} when no version specified",
            },
        }

        logger.info("Compatibility info provided", requested_version=version.value)

        return create_versioned_response(compatibility_info, version, handler)

    except Exception as e:
        logger.error("Compatibility info failed", error=str(e))
        return create_versioned_error_response(
            "Failed to get compatibility info", 500, version
        )


def handle_changelog_info(version: ApiVersion, handler, logger) -> Dict[str, Any]:
    """Handle changelog request"""

    try:
        changelog = {
            "versions": [
                {
                    "version": "1.1",
                    "release_date": "2025-01-10",
                    "status": "current",
                    "changes": {
                        "new_features": [
                            "Enhanced cost tracking with detailed breakdown",
                            "Circuit breaker patterns for fault tolerance",
                            "Comprehensive health checks and monitoring",
                            "Backup and disaster recovery operations",
                            "API versioning and backward compatibility",
                        ],
                        "improvements": [
                            "Better error handling and logging",
                            "Enhanced CloudWatch dashboards",
                            "Optimized Lambda performance",
                            "Improved security configurations",
                        ],
                        "deprecations": [],
                        "breaking_changes": [],
                    },
                },
                {
                    "version": "1.0",
                    "release_date": "2024-12-01",
                    "status": "stable",
                    "changes": {
                        "new_features": [
                            "Initial API implementation",
                            "Voice transcription support",
                            "RAG-powered question answering",
                            "User authentication and quotas",
                            "Basic cost tracking",
                        ],
                        "improvements": [],
                        "deprecations": [],
                        "breaking_changes": [],
                    },
                },
            ],
            "upcoming": {
                "v2.0": {
                    "planned_date": "2025-06-01",
                    "major_features": [
                        "Multi-language support",
                        "Advanced analytics and reporting",
                        "Streaming responses",
                        "WebSocket support",
                    ],
                    "breaking_changes": [
                        "Authentication mechanism changes",
                        "Response format updates",
                    ],
                }
            },
        }

        logger.info("Changelog info provided", requested_version=version.value)

        return create_versioned_response(changelog, version, handler)

    except Exception as e:
        logger.error("Changelog info failed", error=str(e))
        return create_versioned_error_response(
            "Failed to get changelog info", 500, version
        )


def get_feature_matrix(version: ApiVersion) -> Dict[str, Any]:
    """Get feature availability matrix for a specific version"""

    base_features = {
        "authentication": True,
        "voice_transcription": True,
        "question_answering": True,
        "usage_quotas": True,
        "basic_cost_tracking": True,
        "error_handling": True,
    }

    if version == ApiVersion.V1_0:
        return {
            **base_features,
            "detailed_cost_breakdown": False,
            "circuit_breakers": False,
            "health_checks": False,
            "backup_operations": False,
            "api_versioning": False,
        }

    elif version == ApiVersion.V1_1:
        return {
            **base_features,
            "detailed_cost_breakdown": True,
            "circuit_breakers": True,
            "health_checks": True,
            "backup_operations": True,
            "api_versioning": True,
            "enhanced_monitoring": True,
            "disaster_recovery": True,
        }

    else:
        return base_features


def create_versioned_response(
    data: Dict[str, Any], version: ApiVersion, handler
) -> Dict[str, Any]:
    """Create a versioned API response"""

    versioned_response = handler.format_response(version, data, 200)
    version_headers = handler.create_version_headers(version)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,API-Version",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            **version_headers,
        },
        "body": json.dumps(versioned_response.data),
    }


def create_versioned_error_response(
    error: str, status_code: int, version: ApiVersion
) -> Dict[str, Any]:
    """Create a versioned error response"""

    handler = get_versioning_handler()
    error_data = {"error": error, "status_code": status_code, "version": version.value}

    versioned_response = handler.format_response(version, error_data, status_code)
    version_headers = handler.create_version_headers(version)

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,API-Version",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            **version_headers,
        },
        "body": json.dumps(versioned_response.data),
    }
