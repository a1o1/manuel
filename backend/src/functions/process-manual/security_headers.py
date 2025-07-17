"""
Security Headers and CORS Hardening
Provides comprehensive security headers and CORS configuration
"""

import os
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union

from logger import get_logger


class SecurityLevel(Enum):
    """Security level configurations"""

    STRICT = "strict"
    MODERATE = "moderate"
    PERMISSIVE = "permissive"


@dataclass
class CORSConfig:
    """CORS configuration"""

    allowed_origins: Set[str]
    allowed_methods: Set[str]
    allowed_headers: Set[str]
    exposed_headers: Set[str]
    allow_credentials: bool
    max_age: int  # Preflight cache duration in seconds

    @classmethod
    def from_environment(
        cls, security_level: SecurityLevel = SecurityLevel.STRICT
    ) -> "CORSConfig":
        """Create CORS config from environment variables"""
        # Get allowed origins from environment
        origins_env = os.environ.get("CORS_ALLOWED_ORIGINS", "")
        if origins_env:
            allowed_origins = set(origins_env.split(","))
        else:
            # Default based on security level
            if security_level == SecurityLevel.STRICT:
                allowed_origins = {"https://manuel.yourdomain.com"}
            elif security_level == SecurityLevel.MODERATE:
                allowed_origins = {"https://*.yourdomain.com"}
            else:  # PERMISSIVE
                allowed_origins = {"*"}

        # Define allowed methods based on security level
        if security_level == SecurityLevel.STRICT:
            allowed_methods = {"GET", "POST", "OPTIONS"}
            allowed_headers = {
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "X-API-Version",
                "X-Admin-Key",
            }
            max_age = 300  # 5 minutes
        elif security_level == SecurityLevel.MODERATE:
            allowed_methods = {"GET", "POST", "PUT", "DELETE", "OPTIONS"}
            allowed_headers = {
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "X-API-Version",
                "X-Admin-Key",
                "X-MFA-Code",
            }
            max_age = 600  # 10 minutes
        else:  # PERMISSIVE
            allowed_methods = {"*"}
            allowed_headers = {"*"}
            max_age = 3600  # 1 hour

        return cls(
            allowed_origins=allowed_origins,
            allowed_methods=allowed_methods,
            allowed_headers=allowed_headers,
            exposed_headers={"X-Request-ID", "X-Rate-Limit-Remaining"},
            allow_credentials=security_level != SecurityLevel.PERMISSIVE,
            max_age=max_age,
        )


@dataclass
class SecurityHeadersConfig:
    """Security headers configuration"""

    security_level: SecurityLevel
    cors_config: CORSConfig
    enable_hsts: bool = True
    enable_csp: bool = True
    enable_frame_options: bool = True
    enable_content_type_options: bool = True
    enable_referrer_policy: bool = True
    enable_permissions_policy: bool = True
    custom_headers: Optional[Dict[str, str]] = None

    def __post_init__(self):
        if self.custom_headers is None:
            self.custom_headers = {}


class SecurityHeadersMiddleware:
    """Middleware for adding comprehensive security headers"""

    def __init__(self, config: Optional[SecurityHeadersConfig] = None):
        self.logger = get_logger("security-headers")

        # Default to strict security if no config provided
        if config is None:
            security_level = SecurityLevel(os.environ.get("SECURITY_LEVEL", "strict"))
            cors_config = CORSConfig.from_environment(security_level)
            config = SecurityHeadersConfig(
                security_level=security_level, cors_config=cors_config
            )

        self.config = config

        # Compile regex patterns for origin validation
        self._origin_patterns = self._compile_origin_patterns()

    def add_security_headers(
        self, response: Dict[str, Any], request_origin: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add comprehensive security headers to response

        Args:
            response: Lambda response dict
            request_origin: Origin header from request

        Returns:
            Response with security headers added
        """
        try:
            headers = response.get("headers", {})

            # Add CORS headers
            cors_headers = self._get_cors_headers(request_origin)
            headers.update(cors_headers)

            # Add security headers
            security_headers = self._get_security_headers()
            headers.update(security_headers)

            # Add custom headers
            headers.update(self.config.custom_headers)

            # Update response
            response["headers"] = headers

            self.logger.debug(
                "Security headers added",
                headers_count=len(headers),
                origin=request_origin,
            )

            return response

        except Exception as e:
            self.logger.error("Failed to add security headers", error=str(e))
            # Return original response if header addition fails
            return response

    def validate_cors_request(
        self, method: str, origin: Optional[str], headers: Optional[List[str]] = None
    ) -> bool:
        """
        Validate CORS request

        Args:
            method: HTTP method
            origin: Request origin
            headers: Requested headers

        Returns:
            True if request is allowed, False otherwise
        """
        try:
            # Check method
            if not self._is_method_allowed(method):
                self.logger.warning(
                    "CORS validation failed: method not allowed", method=method
                )
                return False

            # Check origin
            if not self._is_origin_allowed(origin):
                self.logger.warning(
                    "CORS validation failed: origin not allowed", origin=origin
                )
                return False

            # Check headers
            if headers and not self._are_headers_allowed(headers):
                self.logger.warning(
                    "CORS validation failed: headers not allowed", headers=headers
                )
                return False

            return True

        except Exception as e:
            self.logger.error("CORS validation error", error=str(e))
            return False

    def create_cors_preflight_response(
        self, origin: str, method: str, headers: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Create CORS preflight response

        Args:
            origin: Request origin
            method: Requested method
            headers: Requested headers

        Returns:
            Preflight response
        """
        try:
            if not self.validate_cors_request(method, origin, headers):
                return {
                    "statusCode": 403,
                    "headers": {"Content-Type": "application/json"},
                    "body": '{"error": "CORS request not allowed"}',
                }

            cors_headers = self._get_cors_headers(origin)
            security_headers = self._get_security_headers()

            return {
                "statusCode": 200,
                "headers": {
                    **cors_headers,
                    **security_headers,
                    "Content-Type": "application/json",
                    "Content-Length": "0",
                },
                "body": "",
            }

        except Exception as e:
            self.logger.error("Failed to create preflight response", error=str(e))
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json"},
                "body": '{"error": "Internal server error"}',
            }

    def _get_cors_headers(self, origin: Optional[str]) -> Dict[str, str]:
        """Get CORS headers"""
        headers = {}

        # Access-Control-Allow-Origin
        if self._is_origin_allowed(origin):
            if "*" in self.config.cors_config.allowed_origins:
                headers["Access-Control-Allow-Origin"] = "*"
            else:
                headers["Access-Control-Allow-Origin"] = origin or ""

        # Access-Control-Allow-Methods
        if "*" in self.config.cors_config.allowed_methods:
            headers["Access-Control-Allow-Methods"] = "*"
        else:
            headers["Access-Control-Allow-Methods"] = ", ".join(
                sorted(self.config.cors_config.allowed_methods)
            )

        # Access-Control-Allow-Headers
        if "*" in self.config.cors_config.allowed_headers:
            headers["Access-Control-Allow-Headers"] = "*"
        else:
            headers["Access-Control-Allow-Headers"] = ", ".join(
                sorted(self.config.cors_config.allowed_headers)
            )

        # Access-Control-Expose-Headers
        if self.config.cors_config.exposed_headers:
            headers["Access-Control-Expose-Headers"] = ", ".join(
                sorted(self.config.cors_config.exposed_headers)
            )

        # Access-Control-Allow-Credentials
        if self.config.cors_config.allow_credentials:
            headers["Access-Control-Allow-Credentials"] = "true"

        # Access-Control-Max-Age
        headers["Access-Control-Max-Age"] = str(self.config.cors_config.max_age)

        return headers

    def _get_security_headers(self) -> Dict[str, str]:
        """Get security headers based on configuration"""
        headers = {}

        # Strict-Transport-Security (HSTS)
        if self.config.enable_hsts:
            if self.config.security_level == SecurityLevel.STRICT:
                hsts_value = "max-age=31536000; includeSubDomains; preload"
            elif self.config.security_level == SecurityLevel.MODERATE:
                hsts_value = "max-age=31536000; includeSubDomains"
            else:
                hsts_value = "max-age=86400"
            headers["Strict-Transport-Security"] = hsts_value

        # Content-Security-Policy
        if self.config.enable_csp:
            csp_value = self._get_csp_header()
            headers["Content-Security-Policy"] = csp_value

        # X-Frame-Options
        if self.config.enable_frame_options:
            if self.config.security_level == SecurityLevel.STRICT:
                headers["X-Frame-Options"] = "DENY"
            elif self.config.security_level == SecurityLevel.MODERATE:
                headers["X-Frame-Options"] = "SAMEORIGIN"
            # PERMISSIVE: no X-Frame-Options header

        # X-Content-Type-Options
        if self.config.enable_content_type_options:
            headers["X-Content-Type-Options"] = "nosniff"

        # Referrer-Policy
        if self.config.enable_referrer_policy:
            if self.config.security_level == SecurityLevel.STRICT:
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            elif self.config.security_level == SecurityLevel.MODERATE:
                headers["Referrer-Policy"] = "strict-origin"
            else:
                headers["Referrer-Policy"] = "origin"

        # Permissions-Policy (formerly Feature-Policy)
        if self.config.enable_permissions_policy:
            permissions_value = self._get_permissions_policy()
            headers["Permissions-Policy"] = permissions_value

        # X-XSS-Protection (deprecated but still useful for older browsers)
        headers["X-XSS-Protection"] = "1; mode=block"

        # Cache-Control for security
        headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        headers["Pragma"] = "no-cache"

        # Server information hiding
        headers["Server"] = "Manuel/1.0"

        # Additional security headers
        headers["X-Robots-Tag"] = "noindex, nofollow, nosnippet, noarchive"

        return headers

    def _get_csp_header(self) -> str:
        """Generate Content Security Policy header"""
        if self.config.security_level == SecurityLevel.STRICT:
            csp_directives = [
                "default-src 'none'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self'",
                "connect-src 'self'",
                "manifest-src 'self'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
                "upgrade-insecure-requests",
            ]
        elif self.config.security_level == SecurityLevel.MODERATE:
            csp_directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self' https:",
                "connect-src 'self' https:",
                "manifest-src 'self'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'self'",
            ]
        else:  # PERMISSIVE
            csp_directives = [
                "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "img-src 'self' data: https: http:",
                "connect-src 'self' https: http:",
                "font-src 'self' https: http:",
                "base-uri 'self'",
            ]

        return "; ".join(csp_directives)

    def _get_permissions_policy(self) -> str:
        """Generate Permissions Policy header"""
        if self.config.security_level == SecurityLevel.STRICT:
            policies = [
                "camera=()",
                "microphone=()",
                "geolocation=()",
                "payment=()",
                "usb=()",
                "magnetometer=()",
                "gyroscope=()",
                "accelerometer=()",
                "ambient-light-sensor=()",
                "autoplay=()",
                "encrypted-media=()",
                "fullscreen=()",
                "picture-in-picture=()",
            ]
        elif self.config.security_level == SecurityLevel.MODERATE:
            policies = [
                "camera=(self)",
                "microphone=(self)",
                "geolocation=()",
                "payment=()",
                "usb=()",
                "magnetometer=()",
                "gyroscope=()",
                "autoplay=(self)",
                "fullscreen=(self)",
            ]
        else:  # PERMISSIVE
            policies = ["geolocation=()", "payment=()", "usb=()"]

        return ", ".join(policies)

    def _is_origin_allowed(self, origin: Optional[str]) -> bool:
        """Check if origin is allowed"""
        if not origin:
            return "*" in self.config.cors_config.allowed_origins

        # Check exact matches
        if origin in self.config.cors_config.allowed_origins:
            return True

        # Check wildcard
        if "*" in self.config.cors_config.allowed_origins:
            return True

        # Check pattern matches
        for pattern in self._origin_patterns:
            if pattern.match(origin):
                return True

        return False

    def _is_method_allowed(self, method: str) -> bool:
        """Check if HTTP method is allowed"""
        return (
            "*" in self.config.cors_config.allowed_methods
            or method.upper() in self.config.cors_config.allowed_methods
        )

    def _are_headers_allowed(self, headers: List[str]) -> bool:
        """Check if all requested headers are allowed"""
        if "*" in self.config.cors_config.allowed_headers:
            return True

        allowed_headers_lower = {
            h.lower() for h in self.config.cors_config.allowed_headers
        }
        requested_headers_lower = {h.lower() for h in headers}

        return requested_headers_lower.issubset(allowed_headers_lower)

    def _compile_origin_patterns(self) -> List[re.Pattern]:
        """Compile regex patterns for origin matching"""
        patterns = []

        for origin in self.config.cors_config.allowed_origins:
            if "*" in origin:
                # Convert wildcard pattern to regex
                pattern = origin.replace("*", ".*")
                try:
                    patterns.append(re.compile(f"^{pattern}$", re.IGNORECASE))
                except re.error as e:
                    self.logger.warning(
                        f"Invalid origin pattern: {origin}", error=str(e)
                    )

        return patterns

    def create_security_middleware_decorator(self):
        """Create a decorator for Lambda functions"""

        def decorator(handler_func):
            def wrapper(event, context):
                # Get request information
                request_origin = event.get("headers", {}).get("Origin")
                request_method = event.get("httpMethod", "GET")

                # Handle preflight requests
                if request_method == "OPTIONS":
                    requested_headers = (
                        event.get("headers", {})
                        .get("Access-Control-Request-Headers", "")
                        .split(",")
                        if event.get("headers", {}).get(
                            "Access-Control-Request-Headers"
                        )
                        else []
                    )

                    requested_method = event.get("headers", {}).get(
                        "Access-Control-Request-Method", request_method
                    )

                    return self.create_cors_preflight_response(
                        request_origin or "", requested_method, requested_headers
                    )

                # Call original handler
                response = handler_func(event, context)

                # Add security headers to response
                return self.add_security_headers(response, request_origin)

            return wrapper

        return decorator


def create_security_headers_middleware(
    security_level: Optional[SecurityLevel] = None,
    custom_cors: Optional[CORSConfig] = None,
) -> SecurityHeadersMiddleware:
    """
    Factory function to create security headers middleware

    Args:
        security_level: Security level (defaults to environment or STRICT)
        custom_cors: Custom CORS configuration

    Returns:
        SecurityHeadersMiddleware instance
    """
    if security_level is None:
        security_level = SecurityLevel(os.environ.get("SECURITY_LEVEL", "strict"))

    cors_config = custom_cors or CORSConfig.from_environment(security_level)

    config = SecurityHeadersConfig(
        security_level=security_level, cors_config=cors_config
    )

    return SecurityHeadersMiddleware(config)


# Convenience function for common use case
def secure_lambda_response(
    response: Dict[str, Any],
    event: Dict[str, Any],
    security_level: SecurityLevel = SecurityLevel.STRICT,
) -> Dict[str, Any]:
    """
    Add security headers to a Lambda response

    Args:
        response: Lambda response dict
        event: Lambda event dict
        security_level: Security level to apply

    Returns:
        Response with security headers
    """
    middleware = create_security_headers_middleware(security_level)
    request_origin = event.get("headers", {}).get("Origin")

    return middleware.add_security_headers(response, request_origin)
