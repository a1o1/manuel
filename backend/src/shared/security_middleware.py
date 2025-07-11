"""
Advanced Security Middleware for Manuel Backend
Provides comprehensive security validation and protection
"""

import base64
import hashlib
import hmac
import ipaddress
import json
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError
from logger import get_logger
from utils import create_response


class SecurityMiddleware:
    """Advanced security middleware with enterprise-grade protections"""

    def __init__(self, function_name: str):
        self.logger = get_logger(f"security-{function_name}")
        self.dynamodb = boto3.resource("dynamodb")
        self.secrets_client = boto3.client("secretsmanager")

        # Load security configuration
        self.rate_limit_table = self.dynamodb.Table(
            os.environ.get("RATE_LIMIT_TABLE_NAME", "manuel-rate-limits")
        )

        # Security thresholds
        self.max_request_size = (
            int(os.environ.get("MAX_REQUEST_SIZE_MB", "10")) * 1024 * 1024
        )
        self.max_audio_duration = int(
            os.environ.get("MAX_AUDIO_DURATION_SECONDS", "300")
        )
        self.rate_limit_window = int(os.environ.get("RATE_LIMIT_WINDOW_MINUTES", "1"))
        self.rate_limit_requests = int(os.environ.get("RATE_LIMIT_REQUESTS", "100"))

        # Load IP allowlist from environment or secrets
        self.ip_allowlist = self._load_ip_allowlist()

        # SQL injection patterns
        self.sql_injection_patterns = [
            r"(\bunion\b.*\bselect\b)",
            r"(\bdrop\b.*\btable\b)",
            r"(\binsert\b.*\binto\b)",
            r"(\bupdate\b.*\bset\b)",
            r"(\bdelete\b.*\bfrom\b)",
            r"(\bexec\b.*\b\()",
            r"(\bscript\b.*\>)",
            r"(\bor\b.*\=.*\bor\b)",
        ]

        # XSS patterns
        self.xss_patterns = [
            r"<script[^>]*>.*</script>",
            r"javascript:",
            r"on\w+\s*=",
            r"<iframe[^>]*>",
            r"<embed[^>]*>",
            r"<object[^>]*>",
        ]

    def _load_ip_allowlist(self) -> List[str]:
        """Load IP allowlist from configuration"""
        try:
            # Try to load from AWS Secrets Manager first
            secret_name = os.environ.get("IP_ALLOWLIST_SECRET")
            if secret_name:
                try:
                    response = self.secrets_client.get_secret_value(
                        SecretId=secret_name
                    )
                    secret_data = json.loads(response["SecretString"])
                    return secret_data.get("allowed_ips", [])
                except ClientError:
                    pass

            # Fallback to environment variable
            ip_list = os.environ.get("IP_ALLOWLIST", "").strip()
            if ip_list:
                return [ip.strip() for ip in ip_list.split(",") if ip.strip()]

            # Default: empty list means no IP restrictions
            return []

        except Exception as e:
            self.logger.warning("Failed to load IP allowlist", error=str(e))
            return []

    def validate_request(
        self, event: Dict[str, Any], context: Any
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Comprehensive request validation
        Returns: (is_valid, error_response)
        """
        try:
            # 1. Request size validation
            if not self._validate_request_size(event):
                return False, create_response(
                    413,
                    {
                        "error": "Request too large",
                        "max_size_mb": self.max_request_size / (1024 * 1024),
                    },
                )

            # 2. IP address validation
            if not self._validate_ip_address(event):
                return False, create_response(
                    403, {"error": "Access denied from this IP address"}
                )

            # 3. Rate limiting
            if not self._check_rate_limit(event):
                return False, create_response(
                    429,
                    {
                        "error": "Rate limit exceeded",
                        "retry_after": self.rate_limit_window * 60,
                    },
                )

            # 4. Input validation (SQL injection, XSS)
            if not self._validate_input_content(event):
                return False, create_response(400, {"error": "Invalid input detected"})

            # 5. Authentication token validation
            if not self._validate_auth_token(event):
                return False, create_response(
                    401, {"error": "Invalid or expired authentication token"}
                )

            # 6. Request signature validation (for sensitive operations)
            if not self._validate_request_signature(event):
                return False, create_response(
                    401, {"error": "Invalid request signature"}
                )

            self.logger.info(
                "Request validation passed",
                source_ip=self._get_source_ip(event),
                user_agent=event.get("headers", {}).get("User-Agent", "unknown"),
            )

            return True, None

        except Exception as e:
            self.logger.error("Security validation failed", error=str(e))
            return False, create_response(500, {"error": "Security validation error"})

    def _validate_request_size(self, event: Dict[str, Any]) -> bool:
        """Validate request size is within limits"""
        try:
            body = event.get("body", "")
            if body:
                # Handle base64 encoded body
                if event.get("isBase64Encoded", False):
                    body = base64.b64decode(body)
                    size = len(body)
                else:
                    size = len(body.encode("utf-8"))

                if size > self.max_request_size:
                    self.logger.warning(
                        "Request size exceeded",
                        size_bytes=size,
                        max_size_bytes=self.max_request_size,
                    )
                    return False

            return True

        except Exception as e:
            self.logger.warning("Request size validation failed", error=str(e))
            return False

    def _get_source_ip(self, event: Dict[str, Any]) -> str:
        """Extract source IP from event"""
        # Check for CloudFront IP first
        headers = event.get("headers", {})
        cf_ip = headers.get("CloudFront-Viewer-Address", "")
        if cf_ip:
            return cf_ip.split(":")[0]  # Remove port if present

        # Check X-Forwarded-For header
        xff = headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip()

        # Fallback to source IP
        return (
            event.get("requestContext", {})
            .get("identity", {})
            .get("sourceIp", "127.0.0.1")
        )

    def _validate_ip_address(self, event: Dict[str, Any]) -> bool:
        """Validate source IP against allowlist"""
        if not self.ip_allowlist:
            return True  # No restrictions if allowlist is empty

        source_ip = self._get_source_ip(event)

        try:
            source_addr = ipaddress.ip_address(source_ip)

            for allowed_ip in self.ip_allowlist:
                try:
                    # Handle both individual IPs and CIDR ranges
                    if "/" in allowed_ip:
                        allowed_network = ipaddress.ip_network(allowed_ip, strict=False)
                        if source_addr in allowed_network:
                            return True
                    else:
                        allowed_addr = ipaddress.ip_address(allowed_ip)
                        if source_addr == allowed_addr:
                            return True
                except ValueError:
                    continue

            self.logger.warning(
                "IP address not in allowlist",
                source_ip=source_ip,
                allowlist_count=len(self.ip_allowlist),
            )
            return False

        except ValueError:
            self.logger.warning("Invalid source IP address", source_ip=source_ip)
            return False

    def _check_rate_limit(self, event: Dict[str, Any]) -> bool:
        """Check rate limiting per IP/user"""
        try:
            source_ip = self._get_source_ip(event)
            current_time = datetime.utcnow()
            window_start = current_time - timedelta(minutes=self.rate_limit_window)

            # Use IP as partition key for rate limiting
            rate_limit_key = f"ip#{source_ip}"

            try:
                response = self.rate_limit_table.get_item(
                    Key={"limit_key": rate_limit_key}
                )

                if "Item" in response:
                    item = response["Item"]
                    last_reset = datetime.fromisoformat(item["last_reset"])
                    request_count = item["request_count"]

                    # Reset counter if window has passed
                    if last_reset < window_start:
                        request_count = 0
                        last_reset = current_time

                    # Check if limit exceeded
                    if request_count >= self.rate_limit_requests:
                        self.logger.warning(
                            "Rate limit exceeded",
                            source_ip=source_ip,
                            request_count=request_count,
                            limit=self.rate_limit_requests,
                        )
                        return False

                    # Update counter
                    self.rate_limit_table.put_item(
                        Item={
                            "limit_key": rate_limit_key,
                            "request_count": request_count + 1,
                            "last_reset": current_time.isoformat(),
                            "ttl": int((current_time + timedelta(hours=1)).timestamp()),
                        }
                    )
                else:
                    # First request from this IP
                    self.rate_limit_table.put_item(
                        Item={
                            "limit_key": rate_limit_key,
                            "request_count": 1,
                            "last_reset": current_time.isoformat(),
                            "ttl": int((current_time + timedelta(hours=1)).timestamp()),
                        }
                    )

                return True

            except ClientError as e:
                self.logger.warning("Rate limit check failed", error=str(e))
                return True  # Allow request if rate limit check fails

        except Exception as e:
            self.logger.warning("Rate limit validation failed", error=str(e))
            return True

    def _validate_input_content(self, event: Dict[str, Any]) -> bool:
        """Validate input content against malicious patterns"""
        try:
            # Get all text content from the request
            content_to_check = []

            # Check request body
            body = event.get("body", "")
            if body:
                try:
                    if event.get("isBase64Encoded", False):
                        body = base64.b64decode(body).decode("utf-8")
                    body_data = json.loads(body)
                    content_to_check.extend(self._extract_text_values(body_data))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # If it's not JSON, check the raw body
                    content_to_check.append(body)

            # Check query parameters
            query_params = event.get("queryStringParameters", {})
            if query_params:
                content_to_check.extend(query_params.values())

            # Check headers (exclude standard headers)
            headers = event.get("headers", {})
            suspicious_headers = ["User-Agent", "X-Custom-Header"]
            for header in suspicious_headers:
                if header in headers:
                    content_to_check.append(headers[header])

            # Validate against patterns
            for content in content_to_check:
                if content and isinstance(content, str):
                    if not self._check_content_patterns(content):
                        return False

            return True

        except Exception as e:
            self.logger.warning("Input content validation failed", error=str(e))
            return True  # Allow request if validation fails

    def _extract_text_values(self, data: Any) -> List[str]:
        """Recursively extract text values from nested data structures"""
        values = []

        if isinstance(data, dict):
            for value in data.values():
                values.extend(self._extract_text_values(value))
        elif isinstance(data, list):
            for item in data:
                values.extend(self._extract_text_values(item))
        elif isinstance(data, str):
            values.append(data)

        return values

    def _check_content_patterns(self, content: str) -> bool:
        """Check content against malicious patterns"""
        content_lower = content.lower()

        # Check SQL injection patterns
        for pattern in self.sql_injection_patterns:
            if re.search(pattern, content_lower, re.IGNORECASE):
                self.logger.warning(
                    "SQL injection pattern detected",
                    pattern=pattern,
                    content_preview=content[:100],
                )
                return False

        # Check XSS patterns
        for pattern in self.xss_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                self.logger.warning(
                    "XSS pattern detected",
                    pattern=pattern,
                    content_preview=content[:100],
                )
                return False

        return True

    def _validate_auth_token(self, event: Dict[str, Any]) -> bool:
        """Enhanced JWT token validation"""
        try:
            # Skip validation for OPTIONS requests
            if event.get("httpMethod") == "OPTIONS":
                return True

            # Check if token is present and valid
            auth_header = event.get("headers", {}).get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return False

            # Additional token validation can be added here
            # For now, rely on API Gateway's Cognito authorizer

            return True

        except Exception as e:
            self.logger.warning("Auth token validation failed", error=str(e))
            return False

    def _validate_request_signature(self, event: Dict[str, Any]) -> bool:
        """Validate HMAC signature for sensitive operations"""
        try:
            # Skip signature validation for non-sensitive operations
            path = event.get("path", "")
            if not any(
                sensitive in path for sensitive in ["/admin/", "/upload", "/delete"]
            ):
                return True

            # Check for signature header
            signature_header = event.get("headers", {}).get("X-Manuel-Signature", "")
            if not signature_header:
                self.logger.warning(
                    "Missing signature for sensitive operation", path=path
                )
                return False

            # Get signing key from environment
            signing_key = os.environ.get("HMAC_SIGNING_KEY", "")
            if not signing_key:
                self.logger.warning("HMAC signing key not configured")
                return True  # Allow if not configured

            # Calculate expected signature
            body = event.get("body", "")
            timestamp = event.get("headers", {}).get("X-Manuel-Timestamp", "")

            message = f"{timestamp}{body}"
            expected_signature = hmac.new(
                signing_key.encode("utf-8"), message.encode("utf-8"), hashlib.sha256
            ).hexdigest()

            # Compare signatures
            if not hmac.compare_digest(signature_header, expected_signature):
                self.logger.warning("Invalid request signature", path=path)
                return False

            return True

        except Exception as e:
            self.logger.warning("Request signature validation failed", error=str(e))
            return True  # Allow if validation fails

    def add_security_headers(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Add security headers to response"""
        security_headers = {
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        }

        if "headers" not in response:
            response["headers"] = {}

        response["headers"].update(security_headers)
        return response


def get_security_middleware(function_name: str) -> SecurityMiddleware:
    """Factory function to get security middleware instance"""
    return SecurityMiddleware(function_name)


def security_wrapper(function_name: str):
    """Decorator to wrap Lambda functions with security middleware"""

    def decorator(handler_func):
        def wrapper(event, context):
            security_middleware = get_security_middleware(function_name)

            # Validate request
            is_valid, error_response = security_middleware.validate_request(
                event, context
            )
            if not is_valid:
                return security_middleware.add_security_headers(error_response)

            # Call original handler
            response = handler_func(event, context)

            # Add security headers to response
            return security_middleware.add_security_headers(response)

        return wrapper

    return decorator
