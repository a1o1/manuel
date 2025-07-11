"""
Enhanced Input Validation and Sanitization
Provides comprehensive validation and sanitization for all user inputs
"""

import html
import json
import re
import urllib.parse
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union

from logger import get_logger


class ValidationError(Exception):
    """Custom validation error"""

    pass


class InputType(Enum):
    """Types of input validation"""

    TEXT = "text"
    EMAIL = "email"
    URL = "url"
    PHONE = "phone"
    UUID = "uuid"
    JSON = "json"
    BASE64 = "base64"
    FILENAME = "filename"
    SQL_IDENTIFIER = "sql_identifier"
    HTML_CONTENT = "html_content"
    QUERY_STRING = "query_string"
    USER_ID = "user_id"
    FILE_PATH = "file_path"


@dataclass
class ValidationRule:
    """Input validation rule"""

    input_type: InputType
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    allowed_chars: Optional[Set[str]] = None
    forbidden_chars: Optional[Set[str]] = None
    allow_empty: bool = False
    custom_validator: Optional[callable] = None


@dataclass
class SanitizationConfig:
    """Sanitization configuration"""

    strip_whitespace: bool = True
    normalize_unicode: bool = True
    escape_html: bool = True
    remove_control_chars: bool = True
    max_length: Optional[int] = None
    allowed_tags: Optional[Set[str]] = None
    remove_null_bytes: bool = True


@dataclass
class ValidationResult:
    """Validation result"""

    is_valid: bool
    sanitized_value: Any
    error_message: Optional[str] = None
    warnings: List[str] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class InputValidator:
    """Comprehensive input validator and sanitizer"""

    def __init__(self):
        self.logger = get_logger("input-validator")

        # Common regex patterns
        self.patterns = {
            "email": re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"),
            "uuid": re.compile(
                r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
                re.IGNORECASE,
            ),
            "phone": re.compile(r"^\+?[1-9]\d{1,14}$"),
            "url": re.compile(
                r"^https?://(?:[-\w.])+(?:\:[0-9]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?$"
            ),
            "filename": re.compile(r"^[a-zA-Z0-9._-]+$"),
            "sql_identifier": re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$"),
            "user_id": re.compile(r"^[a-zA-Z0-9-_]+$"),
            "file_path": re.compile(r"^[a-zA-Z0-9._/-]+$"),
        }

        # Dangerous patterns to detect
        self.dangerous_patterns = [
            # SQL injection patterns
            re.compile(
                r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)",
                re.IGNORECASE,
            ),
            # XSS patterns
            re.compile(r"<script[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL),
            re.compile(r"javascript:", re.IGNORECASE),
            re.compile(r"vbscript:", re.IGNORECASE),
            re.compile(r"on\w+\s*=", re.IGNORECASE),
            # Path traversal patterns
            re.compile(r"\.\.[\\/]"),
            # Command injection patterns
            re.compile(r"[;&|`$\(\)\{\}]"),
            # LDAP injection patterns
            re.compile(r"[()#&|]"),
            # XML injection patterns
            re.compile(r"<!(?:DOCTYPE|ENTITY)", re.IGNORECASE),
        ]

        # Control characters to remove
        self.control_chars = set(range(0, 32)) - {9, 10, 13}  # Keep tab, LF, CR

    def validate_and_sanitize(
        self,
        value: Any,
        rule: ValidationRule,
        sanitization: Optional[SanitizationConfig] = None,
    ) -> ValidationResult:
        """
        Validate and sanitize input value

        Args:
            value: Input value to validate
            rule: Validation rule to apply
            sanitization: Optional sanitization configuration

        Returns:
            ValidationResult with validation status and sanitized value
        """
        try:
            # Convert to string if needed
            str_value = str(value) if value is not None else ""
            original_value = str_value

            # Apply sanitization first
            if sanitization:
                str_value = self._sanitize_input(str_value, sanitization)

            # Check for empty values
            if not str_value and not rule.allow_empty:
                return ValidationResult(
                    is_valid=False,
                    sanitized_value="",
                    error_message="Value cannot be empty",
                )

            # Apply validation rules
            validation_result = self._validate_input(str_value, rule)

            if not validation_result.is_valid:
                return validation_result

            # Check for dangerous patterns
            security_result = self._check_security_patterns(str_value)
            if security_result.warnings:
                validation_result.warnings.extend(security_result.warnings)

            # Log validation if warnings or significant changes
            if validation_result.warnings or original_value != str_value:
                self.logger.info(
                    "Input validation completed with changes",
                    input_type=rule.input_type.value,
                    original_length=len(original_value),
                    sanitized_length=len(str_value),
                    warnings_count=len(validation_result.warnings),
                )

            return validation_result

        except Exception as e:
            self.logger.error("Input validation error", error=str(e))
            return ValidationResult(
                is_valid=False,
                sanitized_value="",
                error_message=f"Validation error: {str(e)}",
            )

    def _sanitize_input(self, value: str, config: SanitizationConfig) -> str:
        """Apply sanitization to input value"""
        sanitized = value

        # Remove null bytes
        if config.remove_null_bytes:
            sanitized = sanitized.replace("\x00", "")

        # Strip whitespace
        if config.strip_whitespace:
            sanitized = sanitized.strip()

        # Normalize unicode
        if config.normalize_unicode:
            import unicodedata

            sanitized = unicodedata.normalize("NFKC", sanitized)

        # Remove control characters
        if config.remove_control_chars:
            sanitized = "".join(
                char for char in sanitized if ord(char) not in self.control_chars
            )

        # Escape HTML
        if config.escape_html:
            sanitized = html.escape(sanitized, quote=True)

        # Apply length limit
        if config.max_length and len(sanitized) > config.max_length:
            sanitized = sanitized[: config.max_length]

        # HTML tag filtering (if allowed_tags specified)
        if config.allowed_tags is not None:
            sanitized = self._filter_html_tags(sanitized, config.allowed_tags)

        return sanitized

    def _validate_input(self, value: str, rule: ValidationRule) -> ValidationResult:
        """Apply validation rules to input"""
        warnings = []

        # Length validation
        if rule.min_length is not None and len(value) < rule.min_length:
            return ValidationResult(
                is_valid=False,
                sanitized_value=value,
                error_message=f"Value too short (min: {rule.min_length})",
            )

        if rule.max_length is not None and len(value) > rule.max_length:
            return ValidationResult(
                is_valid=False,
                sanitized_value=value,
                error_message=f"Value too long (max: {rule.max_length})",
            )

        # Pattern validation
        pattern = rule.pattern or self.patterns.get(rule.input_type.value)
        if pattern and not pattern.match(value):
            return ValidationResult(
                is_valid=False,
                sanitized_value=value,
                error_message=f"Value does not match required pattern for {rule.input_type.value}",
            )

        # Character set validation
        if rule.allowed_chars:
            invalid_chars = set(value) - rule.allowed_chars
            if invalid_chars:
                return ValidationResult(
                    is_valid=False,
                    sanitized_value=value,
                    error_message=f"Contains forbidden characters: {invalid_chars}",
                )

        if rule.forbidden_chars:
            forbidden_found = set(value) & rule.forbidden_chars
            if forbidden_found:
                return ValidationResult(
                    is_valid=False,
                    sanitized_value=value,
                    error_message=f"Contains forbidden characters: {forbidden_found}",
                )

        # Type-specific validation
        type_result = self._validate_by_type(value, rule.input_type)
        if not type_result.is_valid:
            return type_result

        warnings.extend(type_result.warnings)

        # Custom validator
        if rule.custom_validator:
            try:
                custom_valid = rule.custom_validator(value)
                if not custom_valid:
                    return ValidationResult(
                        is_valid=False,
                        sanitized_value=value,
                        error_message="Custom validation failed",
                    )
            except Exception as e:
                return ValidationResult(
                    is_valid=False,
                    sanitized_value=value,
                    error_message=f"Custom validation error: {str(e)}",
                )

        return ValidationResult(is_valid=True, sanitized_value=value, warnings=warnings)

    def _validate_by_type(self, value: str, input_type: InputType) -> ValidationResult:
        """Type-specific validation"""
        warnings = []

        if input_type == InputType.EMAIL:
            # Additional email validation
            if "@" not in value or value.count("@") != 1:
                return ValidationResult(
                    is_valid=False,
                    sanitized_value=value,
                    error_message="Invalid email format",
                )

        elif input_type == InputType.URL:
            # URL validation
            try:
                parsed = urllib.parse.urlparse(value)
                if not parsed.scheme or not parsed.netloc:
                    return ValidationResult(
                        is_valid=False,
                        sanitized_value=value,
                        error_message="Invalid URL format",
                    )
                # Only allow HTTP/HTTPS
                if parsed.scheme not in ["http", "https"]:
                    return ValidationResult(
                        is_valid=False,
                        sanitized_value=value,
                        error_message="Only HTTP/HTTPS URLs allowed",
                    )
            except Exception:
                return ValidationResult(
                    is_valid=False,
                    sanitized_value=value,
                    error_message="URL parsing failed",
                )

        elif input_type == InputType.JSON:
            # JSON validation
            try:
                json.loads(value)
            except json.JSONDecodeError as e:
                return ValidationResult(
                    is_valid=False,
                    sanitized_value=value,
                    error_message=f"Invalid JSON: {str(e)}",
                )

        elif input_type == InputType.BASE64:
            # Base64 validation
            try:
                import base64

                base64.b64decode(value, validate=True)
            except Exception:
                return ValidationResult(
                    is_valid=False,
                    sanitized_value=value,
                    error_message="Invalid base64 encoding",
                )

        elif input_type == InputType.FILE_PATH:
            # File path security validation
            if ".." in value or value.startswith("/"):
                warnings.append("Potentially unsafe file path")
            if any(char in value for char in ["<", ">", "|", "*", "?"]):
                return ValidationResult(
                    is_valid=False,
                    sanitized_value=value,
                    error_message="File path contains invalid characters",
                )

        return ValidationResult(is_valid=True, sanitized_value=value, warnings=warnings)

    def _check_security_patterns(self, value: str) -> ValidationResult:
        """Check for dangerous security patterns"""
        warnings = []

        for pattern in self.dangerous_patterns:
            if pattern.search(value):
                warnings.append(
                    f"Detected potentially dangerous pattern: {pattern.pattern}"
                )

        # Check for excessive special characters
        special_char_ratio = sum(
            1 for c in value if not c.isalnum() and not c.isspace()
        ) / max(len(value), 1)
        if special_char_ratio > 0.3:
            warnings.append("High ratio of special characters detected")

        # Check for repeated patterns (potential injection)
        if len(set(value.lower().split())) < len(value.split()) * 0.7:
            warnings.append("Repeated patterns detected")

        return ValidationResult(is_valid=True, sanitized_value=value, warnings=warnings)

    def _filter_html_tags(self, value: str, allowed_tags: Set[str]) -> str:
        """Filter HTML tags, keeping only allowed ones"""
        try:
            from html.parser import HTMLParser

            class TagFilter(HTMLParser):
                def __init__(self, allowed_tags):
                    super().__init__()
                    self.allowed_tags = allowed_tags
                    self.result = []

                def handle_starttag(self, tag, attrs):
                    if tag.lower() in self.allowed_tags:
                        self.result.append(f"<{tag}>")

                def handle_endtag(self, tag):
                    if tag.lower() in self.allowed_tags:
                        self.result.append(f"</{tag}>")

                def handle_data(self, data):
                    self.result.append(html.escape(data))

            parser = TagFilter(allowed_tags)
            parser.feed(value)
            return "".join(parser.result)

        except Exception:
            # Fallback: escape all HTML
            return html.escape(value)

    def validate_request_data(
        self,
        data: Dict[str, Any],
        schema: Dict[str, ValidationRule],
        sanitization: Optional[SanitizationConfig] = None,
    ) -> Dict[str, ValidationResult]:
        """Validate entire request data against schema"""
        results = {}

        for field_name, rule in schema.items():
            value = data.get(field_name)
            result = self.validate_and_sanitize(value, rule, sanitization)
            results[field_name] = result

            if not result.is_valid:
                self.logger.warning(
                    "Field validation failed",
                    field=field_name,
                    error=result.error_message,
                )

        return results

    def create_lambda_validator(
        self,
        schema: Dict[str, ValidationRule],
        sanitization: Optional[SanitizationConfig] = None,
    ):
        """Create a validation decorator for Lambda functions"""

        def decorator(func):
            def wrapper(event, context):
                # Extract body data
                try:
                    if event.get("body"):
                        body_data = json.loads(event["body"])
                    else:
                        body_data = {}
                except json.JSONDecodeError:
                    from utils import create_response

                    return create_response(
                        400, {"error": "Invalid JSON in request body"}
                    )

                # Add query parameters
                query_params = event.get("queryStringParameters") or {}
                all_data = {**body_data, **query_params}

                # Validate all fields
                validation_results = self.validate_request_data(
                    all_data, schema, sanitization
                )

                # Check for validation failures
                failed_fields = [
                    field
                    for field, result in validation_results.items()
                    if not result.is_valid
                ]

                if failed_fields:
                    errors = {
                        field: validation_results[field].error_message
                        for field in failed_fields
                    }
                    from utils import create_response

                    return create_response(
                        400, {"error": "Validation failed", "field_errors": errors}
                    )

                # Update event with sanitized values
                sanitized_data = {
                    field: result.sanitized_value
                    for field, result in validation_results.items()
                }

                # Update event body with sanitized data
                event["sanitized_body"] = sanitized_data

                # Log warnings
                warnings = []
                for field, result in validation_results.items():
                    warnings.extend(result.warnings)

                if warnings:
                    self.logger.warning("Input validation warnings", warnings=warnings)

                return func(event, context)

            return wrapper

        return decorator


# Predefined validation rules for common use cases
class CommonValidationRules:
    """Common validation rules for Manuel application"""

    USER_ID = ValidationRule(
        input_type=InputType.USER_ID,
        min_length=1,
        max_length=128,
        pattern=re.compile(r"^[a-zA-Z0-9-_@.]+$"),
    )

    AUDIO_QUERY = ValidationRule(
        input_type=InputType.TEXT,
        min_length=1,
        max_length=1000,
        forbidden_chars={"<", ">", "&", '"', "'"},
    )

    FILENAME = ValidationRule(
        input_type=InputType.FILENAME,
        min_length=1,
        max_length=255,
        pattern=re.compile(r"^[a-zA-Z0-9._-]+\.[a-zA-Z0-9]+$"),
    )

    EMAIL_ADDRESS = ValidationRule(
        input_type=InputType.EMAIL, min_length=5, max_length=254
    )

    ADMIN_API_KEY = ValidationRule(
        input_type=InputType.TEXT,
        min_length=32,
        max_length=128,
        pattern=re.compile(r"^[a-zA-Z0-9-_]+$"),
    )

    FILE_CONTENT_TYPE = ValidationRule(
        input_type=InputType.TEXT,
        min_length=1,
        max_length=100,
        pattern=re.compile(r"^[a-zA-Z0-9-_./]+$"),
    )

    OPERATION_TYPE = ValidationRule(
        input_type=InputType.TEXT,
        min_length=1,
        max_length=50,
        allowed_chars=set("abcdefghijklmnopqrstuvwxyz_"),
    )


# Default sanitization configurations
class DefaultSanitization:
    """Default sanitization configurations"""

    STRICT = SanitizationConfig(
        strip_whitespace=True,
        normalize_unicode=True,
        escape_html=True,
        remove_control_chars=True,
        remove_null_bytes=True,
        max_length=10000,
    )

    PERMISSIVE = SanitizationConfig(
        strip_whitespace=True,
        normalize_unicode=False,
        escape_html=False,
        remove_control_chars=True,
        remove_null_bytes=True,
    )

    HTML_SAFE = SanitizationConfig(
        strip_whitespace=True,
        normalize_unicode=True,
        escape_html=True,
        remove_control_chars=True,
        remove_null_bytes=True,
        allowed_tags={"p", "br", "strong", "em", "u", "i"},
    )


def get_input_validator() -> InputValidator:
    """Factory function to get input validator instance"""
    return InputValidator()
