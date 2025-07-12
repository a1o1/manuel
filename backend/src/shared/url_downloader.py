"""Secure URL Download Service.

Provides safe downloading of files from URLs with comprehensive security validation.
"""

import hashlib
import os
import time
import urllib.parse
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

import requests
from file_security import FileUploadConfig, get_file_security_validator
from input_validation import InputType, ValidationRule, get_input_validator
from logger import get_logger
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


@dataclass
class DownloadConfig:
    """Configuration for secure URL downloads."""

    max_file_size_mb: int = 50
    timeout_seconds: int = 30
    max_redirects: int = 5
    allowed_schemes: Set[str] = None
    allowed_domains: Set[str] = None  # If None, uses domain validation rules
    blocked_domains: Set[str] = None
    user_agent: str = "Manuel-Bot/1.0"
    verify_ssl: bool = True

    def __post_init__(self):
        """Initialize default values for configuration."""
        if self.allowed_schemes is None:
            self.allowed_schemes = {"https"}  # Only HTTPS by default
        if self.blocked_domains is None:
            self.blocked_domains = {
                # Block localhost and private networks
                "localhost",
                "127.0.0.1",
                "0.0.0.0",
                "169.254.169.254",  # AWS metadata
                "metadata.google.internal",  # GCP metadata
                # Add other internal/private ranges as needed
            }


@dataclass
class DownloadResult:
    """Result of secure download operation."""

    success: bool
    content: Optional[bytes] = None
    content_type: Optional[str] = None
    filename: Optional[str] = None
    size_bytes: int = 0
    download_time_ms: Optional[float] = None
    final_url: Optional[str] = None  # After redirects
    error_message: Optional[str] = None
    security_warnings: List[str] = None

    def __post_init__(self):
        """Initialize default values for results."""
        if self.security_warnings is None:
            self.security_warnings = []


class SecureUrlDownloader:
    """Secure URL downloader with comprehensive security validation."""

    def __init__(self, config: Optional[DownloadConfig] = None):
        """Initialize the secure URL downloader."""
        self.logger = get_logger("url-downloader")
        self.config = config or DownloadConfig()
        self.input_validator = get_input_validator()

        # Configure requests session for security and performance
        self.session = requests.Session()

        # Configure retries
        retry_strategy = Retry(
            total=3,
            status_forcelist=[429, 500, 502, 503, 504],
            backoff_factor=1,
            allowed_methods=["GET", "HEAD"],
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Set security headers
        self.session.headers.update(
            {
                "User-Agent": self.config.user_agent,
                "Accept": "application/pdf,application/octet-stream,*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "DNT": "1",
                "Upgrade-Insecure-Requests": "1",
            }
        )

    def download_file(
        self, url: str, suggested_filename: Optional[str] = None
    ) -> DownloadResult:
        """Securely download file from URL with comprehensive validation.

        Args:
            url: URL to download from
            suggested_filename: Optional filename override

        Returns:
            DownloadResult with download status and content
        """
        start_time = time.time()

        try:
            # Step 1: URL validation and sanitization
            url_validation_result = self._validate_url(url)
            if not url_validation_result.is_valid:
                return DownloadResult(
                    success=False,
                    error_message=f"Invalid URL: {url_validation_result.error_message}",
                    download_time_ms=(time.time() - start_time) * 1000,
                )

            sanitized_url = url_validation_result.sanitized_value

            # Step 2: Domain and scheme validation
            domain_check_result = self._validate_domain_security(sanitized_url)
            if not domain_check_result.success:
                return domain_check_result

            # Step 3: HEAD request to check content before downloading
            head_result = self._check_content_headers(sanitized_url)
            if not head_result.success:
                return head_result

            content_type = head_result.content_type
            content_length = head_result.size_bytes

            # Step 4: Download the file
            download_result = self._download_content(sanitized_url, content_length)
            if not download_result.success:
                return download_result

            # Step 5: Content validation and security scanning
            content = download_result.content
            filename = suggested_filename or self._extract_filename(
                sanitized_url, content_type
            )

            security_result = self._validate_downloaded_content(
                content, content_type, filename
            )

            download_time = (time.time() - start_time) * 1000

            # Compile final result
            result = DownloadResult(
                success=security_result.is_valid,
                content=content if security_result.is_valid else None,
                content_type=content_type,
                filename=filename,
                size_bytes=len(content),
                download_time_ms=download_time,
                final_url=sanitized_url,
                security_warnings=(
                    security_result.warnings
                    if hasattr(security_result, "warnings")
                    else []
                ),
            )

            if not security_result.is_valid:
                result.error_message = (
                    f"Security validation failed: {security_result.error_message}"
                )

            self.logger.info(
                "URL download completed",
                url=sanitized_url,
                success=result.success,
                size=result.size_bytes,
                download_time_ms=download_time,
                content_type=content_type,
            )

            return result

        except Exception as e:
            download_time = (time.time() - start_time) * 1000
            self.logger.error(
                f"URL download failed: {str(e)}",
                url=url,
                download_time_ms=download_time,
            )

            return DownloadResult(
                success=False,
                error_message=f"Download error: {str(e)}",
                download_time_ms=download_time,
            )

    def _validate_url(self, url: str):
        """Validate and sanitize URL."""
        url_rule = ValidationRule(
            input_type=InputType.URL, min_length=10, max_length=2048
        )

        return self.input_validator.validate_and_sanitize(url, url_rule)

    def _validate_domain_security(self, url: str) -> DownloadResult:
        """Validate domain and scheme for security."""
        try:
            parsed = urllib.parse.urlparse(url)

            # Check scheme
            if parsed.scheme not in self.config.allowed_schemes:
                return DownloadResult(
                    success=False,
                    error_message=f"Scheme '{parsed.scheme}' not allowed. Only {list(self.config.allowed_schemes)} are permitted.",
                )

            # Check blocked domains
            hostname = parsed.hostname
            if not hostname:
                return DownloadResult(
                    success=False, error_message="Invalid hostname in URL"
                )

            # Check against blocked domains
            if hostname.lower() in self.config.blocked_domains:
                return DownloadResult(
                    success=False,
                    error_message=f"Domain '{hostname}' is blocked for security reasons",
                )

            # Check for private IP ranges (basic SSRF protection)
            import ipaddress

            try:
                ip = ipaddress.ip_address(hostname)
                if ip.is_private or ip.is_loopback or ip.is_link_local:
                    return DownloadResult(
                        success=False,
                        error_message="Private/internal IP addresses are not allowed",
                    )
            except ValueError:
                # Not an IP address, which is fine
                pass

            # Check allowed domains if specified
            if self.config.allowed_domains:
                domain_allowed = any(
                    hostname.lower().endswith(domain.lower())
                    for domain in self.config.allowed_domains
                )
                if not domain_allowed:
                    return DownloadResult(
                        success=False,
                        error_message=f"Domain '{hostname}' is not in the allowed domains list",
                    )

            return DownloadResult(success=True)

        except Exception as e:
            return DownloadResult(
                success=False, error_message=f"Domain validation error: {str(e)}"
            )

    def _check_content_headers(self, url: str) -> DownloadResult:
        """Perform HEAD request to check content before downloading."""
        try:
            response = self.session.head(
                url,
                timeout=self.config.timeout_seconds,
                allow_redirects=True,
                verify=self.config.verify_ssl,
            )

            response.raise_for_status()

            # Check content type
            content_type = response.headers.get("Content-Type", "").lower()
            if not self._is_valid_content_type(content_type):
                return DownloadResult(
                    success=False,
                    error_message=f"Invalid content type: {content_type}. Only document types are allowed.",
                )

            # Check content length
            content_length = response.headers.get("Content-Length")
            if content_length:
                size_bytes = int(content_length)
                max_size = self.config.max_file_size_mb * 1024 * 1024
                if size_bytes > max_size:
                    return DownloadResult(
                        success=False,
                        error_message=f"File too large: {size_bytes} bytes > {max_size} bytes",
                    )
            else:
                size_bytes = 0

            return DownloadResult(
                success=True, content_type=content_type, size_bytes=size_bytes
            )

        except requests.exceptions.RequestException as e:
            return DownloadResult(
                success=False,
                error_message=f"HTTP error during content check: {str(e)}",
            )

    def _download_content(self, url: str, expected_size: int) -> DownloadResult:
        """Download the actual file content."""
        try:
            response = self.session.get(
                url,
                timeout=self.config.timeout_seconds,
                allow_redirects=True,
                verify=self.config.verify_ssl,
                stream=True,
            )

            response.raise_for_status()

            # Download with size checking
            content_chunks = []
            downloaded_size = 0
            max_size = self.config.max_file_size_mb * 1024 * 1024

            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    content_chunks.append(chunk)
                    downloaded_size += len(chunk)

                    # Check size limit during download
                    if downloaded_size > max_size:
                        return DownloadResult(
                            success=False,
                            error_message=f"File too large during download: {downloaded_size} bytes > {max_size} bytes",
                        )

            content = b"".join(content_chunks)

            return DownloadResult(
                success=True, content=content, size_bytes=len(content)
            )

        except requests.exceptions.RequestException as e:
            return DownloadResult(
                success=False, error_message=f"Download error: {str(e)}"
            )

    def _validate_downloaded_content(
        self, content: bytes, content_type: str, filename: str
    ):
        """Validate downloaded content using existing security validation."""
        try:
            # Use existing file security validator
            file_validator = get_file_security_validator(
                FileUploadConfig(
                    max_file_size_mb=self.config.max_file_size_mb,
                    scan_for_malware=True,
                    validate_file_headers=True,
                    quarantine_suspicious_files=False,  # Handle quarantine separately
                )
            )

            # Convert content to base64 for validation
            import base64

            file_data_b64 = base64.b64encode(content).decode()

            # Validate using existing security framework
            validation_result = file_validator.validate_file_upload(
                file_data=file_data_b64,
                content_type=content_type,
                filename=filename,
                user_id="url_download",
            )

            return validation_result

        except Exception as e:
            from dataclasses import dataclass

            @dataclass
            class ValidationResult:
                is_valid: bool
                error_message: str

            return ValidationResult(
                is_valid=False, error_message=f"Content validation error: {str(e)}"
            )

    def _is_valid_content_type(self, content_type: str) -> bool:
        """Check if content type is valid for manual documents."""
        valid_types = {
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "text/markdown",
            "text/html",
            "application/octet-stream",  # Allow generic binary for PDF detection
        }

        # Check direct match or starts with valid type
        return any(content_type.startswith(valid_type) for valid_type in valid_types)

    def _extract_filename(self, url: str, content_type: str) -> str:
        """Extract filename from URL or generate based on content type."""
        try:
            # Try to get filename from URL path
            parsed = urllib.parse.urlparse(url)
            path = parsed.path

            if path and "/" in path:
                filename = path.split("/")[-1]
                if filename and "." in filename:
                    return filename

            # Generate filename based on content type
            timestamp = int(time.time())

            if "pdf" in content_type.lower():
                return f"manual_{timestamp}.pdf"
            elif "word" in content_type.lower() or "doc" in content_type.lower():
                return f"manual_{timestamp}.docx"
            elif "text" in content_type.lower():
                return f"manual_{timestamp}.txt"
            else:
                return f"manual_{timestamp}.pdf"  # Default to PDF

        except Exception:
            return f"manual_{int(time.time())}.pdf"

    def cleanup(self):
        """Cleanup resources."""
        if hasattr(self, "session"):
            self.session.close()


def get_secure_url_downloader(
    config: Optional[DownloadConfig] = None,
) -> SecureUrlDownloader:
    """Factory function to get secure URL downloader instance."""
    return SecureUrlDownloader(config)
