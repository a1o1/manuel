"""
Comprehensive File Upload Security Validation
Provides secure file upload validation with content scanning and malware detection
"""

import base64
import hashlib
import json
import mimetypes
import os
import re
import tempfile
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

import boto3
# import magic  # Disabled for Lambda compatibility
from botocore.exceptions import ClientError
from logger import get_logger


class FileType(Enum):
    """Supported file types"""

    AUDIO = "audio"
    DOCUMENT = "document"
    IMAGE = "image"
    UNKNOWN = "unknown"


class SecurityThreat(Enum):
    """Security threat types"""

    MALWARE = "malware"
    SUSPICIOUS_CONTENT = "suspicious_content"
    INVALID_FORMAT = "invalid_format"
    SIZE_EXCEEDED = "size_exceeded"
    FORBIDDEN_EXTENSION = "forbidden_extension"
    CONTENT_MISMATCH = "content_mismatch"


@dataclass
class FileValidationResult:
    """File validation result"""

    is_valid: bool
    file_type: FileType
    mime_type: str
    size_bytes: int
    content_hash: str
    threats_detected: List[SecurityThreat]
    metadata: Dict[str, Any]
    error_message: Optional[str] = None


@dataclass
class FileUploadConfig:
    """File upload security configuration"""

    max_file_size_mb: int = 10
    allowed_audio_formats: Set[str] = None
    allowed_document_formats: Set[str] = None
    allowed_image_formats: Set[str] = None
    scan_for_malware: bool = True
    validate_file_headers: bool = True
    check_content_integrity: bool = True
    quarantine_suspicious_files: bool = True

    def __post_init__(self):
        if self.allowed_audio_formats is None:
            self.allowed_audio_formats = {
                "audio/mp4",
                "audio/wav",
                "audio/webm",
                "audio/mpeg",
                "audio/ogg",
                "audio/m4a",
            }
        if self.allowed_document_formats is None:
            self.allowed_document_formats = {
                "application/pdf",
                "application/octet-stream",  # Allow for PDF files that fallback detection can't identify
                "text/plain",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            }
        if self.allowed_image_formats is None:
            self.allowed_image_formats = {
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
            }


class FileSecurityValidator:
    """Comprehensive file security validator"""

    def __init__(self, config: Optional[FileUploadConfig] = None):
        self.logger = get_logger("file-security")
        self.config = config or FileUploadConfig()

        # AWS services for malware scanning
        self.s3 = boto3.client("s3")
        self.macie = None  # Initialize if available

        # Quarantine bucket for suspicious files
        self.quarantine_bucket = os.environ.get("QUARANTINE_BUCKET", "")

        # Known malicious file signatures (simplified)
        self.malicious_signatures = {
            # PE executable signatures
            b"\x4d\x5a": "Windows PE executable",
            b"\x7f\x45\x4c\x46": "Linux ELF executable",
            # Script signatures
            b"<?php": "PHP script",
            b"#!/bin/": "Shell script",
            b"<script": "JavaScript",
            # Archive with suspicious content
            b"PK\x03\x04": "ZIP archive (requires deeper inspection)",
        }

        # Suspicious patterns in file content
        self.suspicious_patterns = [
            re.compile(rb"eval\s*\(", re.IGNORECASE),
            re.compile(rb"exec\s*\(", re.IGNORECASE),
            re.compile(rb"system\s*\(", re.IGNORECASE),
            re.compile(rb"shell_exec", re.IGNORECASE),
            re.compile(rb"base64_decode", re.IGNORECASE),
            re.compile(rb"<iframe", re.IGNORECASE),
            re.compile(rb"javascript:", re.IGNORECASE),
            re.compile(rb"vbscript:", re.IGNORECASE),
        ]

    def validate_file_upload(
        self, file_data: str, content_type: str, filename: str = "", user_id: str = ""
    ) -> FileValidationResult:
        """
        Comprehensive file upload validation

        Args:
            file_data: Base64 encoded file data
            content_type: Declared MIME type
            filename: Original filename
            user_id: User uploading the file

        Returns:
            FileValidationResult with validation status and details
        """
        try:
            # Decode file data
            try:
                decoded_data = base64.b64decode(file_data)
            except Exception as e:
                return FileValidationResult(
                    is_valid=False,
                    file_type=FileType.UNKNOWN,
                    mime_type="",
                    size_bytes=0,
                    content_hash="",
                    threats_detected=[SecurityThreat.INVALID_FORMAT],
                    metadata={},
                    error_message=f"Invalid base64 encoding: {str(e)}",
                )

            # Calculate file metrics
            file_size = len(decoded_data)
            content_hash = hashlib.sha256(decoded_data).hexdigest()

            # Initialize result
            result = FileValidationResult(
                is_valid=True,
                file_type=FileType.UNKNOWN,
                mime_type=content_type,
                size_bytes=file_size,
                content_hash=content_hash,
                threats_detected=[],
                metadata={
                    "filename": filename,
                    "user_id": user_id,
                    "upload_timestamp": self._get_timestamp(),
                },
            )

            # 1. Size validation
            max_size = self.config.max_file_size_mb * 1024 * 1024
            if file_size > max_size:
                result.is_valid = False
                result.threats_detected.append(SecurityThreat.SIZE_EXCEEDED)
                result.error_message = (
                    f"File size {file_size} exceeds maximum {max_size} bytes"
                )
                return result

            # 2. File header and MIME type validation
            detected_mime = self._detect_file_type(decoded_data)
            result.file_type = self._classify_file_type(detected_mime)

            # Check for MIME type spoofing
            if not self._validate_mime_consistency(
                content_type, detected_mime, filename
            ):
                result.threats_detected.append(SecurityThreat.CONTENT_MISMATCH)
                result.error_message = f"MIME type mismatch: declared={content_type}, detected={detected_mime}"

            # 3. Validate against allowed formats
            if not self._is_allowed_format(detected_mime, result.file_type):
                result.is_valid = False
                result.threats_detected.append(SecurityThreat.FORBIDDEN_EXTENSION)
                result.error_message = f"File type {detected_mime} not allowed"
                return result

            # 4. Malware signature detection
            malware_threats = self._scan_for_malware_signatures(decoded_data)
            result.threats_detected.extend(malware_threats)

            # 5. Content analysis for suspicious patterns
            suspicious_threats = self._analyze_content_patterns(decoded_data)
            result.threats_detected.extend(suspicious_threats)

            # 6. File format integrity validation
            if self.config.validate_file_headers:
                integrity_threats = self._validate_file_integrity(
                    decoded_data, detected_mime
                )
                result.threats_detected.extend(integrity_threats)

            # 7. Enhanced audio file validation (for transcription uploads)
            if result.file_type == FileType.AUDIO:
                audio_threats = self._validate_audio_file(decoded_data, detected_mime)
                result.threats_detected.extend(audio_threats)

            # 8. Check against known malicious file hashes
            hash_threats = self._check_malicious_hashes(content_hash)
            result.threats_detected.extend(hash_threats)

            # Determine final validation status
            critical_threats = {
                SecurityThreat.MALWARE,
                SecurityThreat.INVALID_FORMAT,
                SecurityThreat.FORBIDDEN_EXTENSION,
            }

            if any(threat in critical_threats for threat in result.threats_detected):
                result.is_valid = False

            # Quarantine suspicious files
            if result.threats_detected and self.config.quarantine_suspicious_files:
                self._quarantine_file(decoded_data, result, user_id)

            # Log validation result
            self.logger.info(
                "File validation completed",
                filename=filename,
                user_id=user_id,
                file_size=file_size,
                file_type=result.file_type.value,
                mime_type=detected_mime,
                threats_count=len(result.threats_detected),
                is_valid=result.is_valid,
            )

            return result

        except Exception as e:
            self.logger.error("File validation error", error=str(e), filename=filename)
            return FileValidationResult(
                is_valid=False,
                file_type=FileType.UNKNOWN,
                mime_type="",
                size_bytes=0,
                content_hash="",
                threats_detected=[],
                metadata={},
                error_message=f"Validation error: {str(e)}",
            )

    def _detect_file_type(self, file_data: bytes) -> str:
        """Detect actual file type from content"""
        try:
            # TODO: Re-enable python-magic when Lambda layer is available
            # mime_type = magic.from_buffer(file_data, mime=True)
            # return mime_type
            # For now, use fallback detection
            return self._detect_file_type_fallback(file_data)
        except Exception:
            # Fallback to basic header detection
            return self._detect_file_type_fallback(file_data)

    def _detect_file_type_fallback(self, file_data: bytes) -> str:
        """Fallback file type detection using headers"""
        if len(file_data) < 16:
            return "application/octet-stream"

        header = file_data[:16]

        # Common file signatures
        signatures = {
            b"\xff\xfb": "audio/mpeg",  # MP3
            b"\x49\x44\x33": "audio/mpeg",  # MP3 with ID3
            b"RIFF": "audio/wav",  # WAV
            b"ftyp": "audio/mp4",  # M4A/MP4
            b"OggS": "audio/ogg",  # OGG
            b"\x1a\x45\xdf\xa3": "audio/webm",  # WebM
            b"%PDF": "application/pdf",  # PDF
            b"\x89PNG": "image/png",  # PNG
            b"\xff\xd8\xff": "image/jpeg",  # JPEG
            b"GIF8": "image/gif",  # GIF
        }

        for signature, mime_type in signatures.items():
            if header.startswith(signature):
                return mime_type

        return "application/octet-stream"

    def _classify_file_type(self, mime_type: str) -> FileType:
        """Classify file type from MIME type"""
        if mime_type.startswith("audio/"):
            return FileType.AUDIO
        elif mime_type.startswith("image/"):
            return FileType.IMAGE
        elif mime_type in {"application/pdf", "application/octet-stream", "text/plain", "application/msword"}:
            return FileType.DOCUMENT
        else:
            return FileType.UNKNOWN

    def _validate_mime_consistency(
        self, declared_mime: str, detected_mime: str, filename: str
    ) -> bool:
        """Validate MIME type consistency"""
        # Check if declared and detected MIME types are consistent
        if declared_mime == detected_mime:
            return True

        # Check file extension consistency
        if filename:
            _, ext = os.path.splitext(filename.lower())
            expected_mime = mimetypes.guess_type(filename)[0]

            # Allow if extension matches detected type
            if expected_mime == detected_mime:
                return True

        # Allow some common variations
        allowed_variations = {
            ("audio/mp4", "audio/m4a"),
            ("audio/mpeg", "audio/mp3"),
            ("image/jpeg", "image/jpg"),
        }

        for mime1, mime2 in allowed_variations:
            if (declared_mime == mime1 and detected_mime == mime2) or (
                declared_mime == mime2 and detected_mime == mime1
            ):
                return True

        return False

    def _is_allowed_format(self, mime_type: str, file_type: FileType) -> bool:
        """Check if file format is allowed"""
        if file_type == FileType.AUDIO:
            return mime_type in self.config.allowed_audio_formats
        elif file_type == FileType.IMAGE:
            return mime_type in self.config.allowed_image_formats
        elif file_type == FileType.DOCUMENT:
            return mime_type in self.config.allowed_document_formats
        else:
            return False

    def _scan_for_malware_signatures(self, file_data: bytes) -> List[SecurityThreat]:
        """Scan for known malware signatures"""
        threats = []

        # Check first 1KB for malicious signatures
        header_data = file_data[:1024]

        for signature, description in self.malicious_signatures.items():
            if signature in header_data:
                self.logger.warning(
                    "Malicious signature detected",
                    signature=signature.hex(),
                    description=description,
                )
                threats.append(SecurityThreat.MALWARE)
                break

        return threats

    def _analyze_content_patterns(self, file_data: bytes) -> List[SecurityThreat]:
        """Analyze file content for suspicious patterns"""
        threats = []

        # Only analyze first 64KB to avoid performance issues
        content_sample = file_data[:65536]

        for pattern in self.suspicious_patterns:
            if pattern.search(content_sample):
                self.logger.warning("Suspicious content pattern detected")
                threats.append(SecurityThreat.SUSPICIOUS_CONTENT)
                break

        return threats

    def _validate_file_integrity(
        self, file_data: bytes, mime_type: str
    ) -> List[SecurityThreat]:
        """Validate file format integrity"""
        threats = []

        try:
            if mime_type.startswith("audio/"):
                # Basic audio file validation
                if len(file_data) < 44:  # Minimum for WAV header
                    threats.append(SecurityThreat.INVALID_FORMAT)
            elif mime_type == "application/pdf":
                # Basic PDF validation
                if not file_data.startswith(b"%PDF"):
                    threats.append(SecurityThreat.INVALID_FORMAT)
            elif mime_type == "application/octet-stream":
                # For octet-stream, assume it's a PDF if it has PDF header
                if not file_data.startswith(b"%PDF"):
                    # If it's not a PDF, treat as potentially suspicious
                    threats.append(SecurityThreat.SUSPICIOUS_CONTENT)
            elif mime_type.startswith("image/"):
                # Basic image validation
                if mime_type == "image/jpeg" and not file_data.startswith(b"\xff\xd8"):
                    threats.append(SecurityThreat.INVALID_FORMAT)
                elif mime_type == "image/png" and not file_data.startswith(b"\x89PNG"):
                    threats.append(SecurityThreat.INVALID_FORMAT)
        except Exception as e:
            self.logger.warning("File integrity validation error", error=str(e))

        return threats

    def _validate_audio_file(
        self, file_data: bytes, mime_type: str
    ) -> List[SecurityThreat]:
        """Enhanced validation for audio files"""
        threats = []

        try:
            # Check audio file duration (prevent extremely long files)
            duration = self._estimate_audio_duration(file_data, mime_type)
            max_duration_seconds = int(
                os.environ.get("MAX_AUDIO_DURATION_SECONDS", "300")
            )

            if duration > max_duration_seconds:
                threats.append(SecurityThreat.SIZE_EXCEEDED)

            # Check for embedded metadata that could contain malicious content
            if self._contains_suspicious_metadata(file_data, mime_type):
                threats.append(SecurityThreat.SUSPICIOUS_CONTENT)

        except Exception as e:
            self.logger.warning("Audio file validation error", error=str(e))

        return threats

    def _estimate_audio_duration(self, file_data: bytes, mime_type: str) -> float:
        """Estimate audio file duration"""
        try:
            # This is a simplified estimation
            # In production, use proper audio analysis libraries
            file_size = len(file_data)

            # Rough estimates based on common bitrates
            bitrate_estimates = {
                "audio/mp3": 128000,  # 128 kbps
                "audio/mpeg": 128000,
                "audio/wav": 1411200,  # 44.1kHz 16-bit stereo
                "audio/m4a": 128000,
                "audio/mp4": 128000,
                "audio/ogg": 112000,
                "audio/webm": 128000,
            }

            bitrate = bitrate_estimates.get(mime_type, 128000)
            estimated_duration = (file_size * 8) / bitrate

            return estimated_duration

        except Exception:
            return 0.0

    def _contains_suspicious_metadata(self, file_data: bytes, mime_type: str) -> bool:
        """Check for suspicious metadata in audio files"""
        try:
            # Look for common metadata sections and check for suspicious content
            # This is simplified - in production, use proper metadata parsing
            metadata_section = file_data[:2048]  # Check first 2KB

            suspicious_keywords = [b"script", b"exec", b"eval", b"<", b">"]
            return any(keyword in metadata_section for keyword in suspicious_keywords)

        except Exception:
            return False

    def _check_malicious_hashes(self, file_hash: str) -> List[SecurityThreat]:
        """Check file hash against known malicious files"""
        threats = []

        try:
            # In production, check against threat intelligence feeds
            # This is a placeholder for hash-based detection
            known_malicious_hashes = set(
                os.environ.get("MALICIOUS_HASHES", "").split(",")
            )

            if file_hash in known_malicious_hashes:
                self.logger.warning(
                    "Known malicious file hash detected", hash=file_hash
                )
                threats.append(SecurityThreat.MALWARE)

        except Exception as e:
            self.logger.warning("Hash check error", error=str(e))

        return threats

    def _quarantine_file(
        self, file_data: bytes, result: FileValidationResult, user_id: str
    ) -> None:
        """Quarantine suspicious file"""
        try:
            if not self.quarantine_bucket:
                return

            # Generate quarantine filename
            timestamp = self._get_timestamp()
            quarantine_key = f"quarantine/{user_id}/{timestamp}_{result.content_hash}"

            # Store file in quarantine bucket
            self.s3.put_object(
                Bucket=self.quarantine_bucket,
                Key=quarantine_key,
                Body=file_data,
                Metadata={
                    "original_filename": result.metadata.get("filename", "unknown"),
                    "user_id": user_id,
                    "threat_types": ",".join(
                        [t.value for t in result.threats_detected]
                    ),
                    "quarantine_reason": "Security validation failed",
                },
                ServerSideEncryption="AES256",
            )

            self.logger.warning(
                "File quarantined",
                quarantine_key=quarantine_key,
                threats=len(result.threats_detected),
                user_id=user_id,
            )

        except Exception as e:
            self.logger.error("File quarantine error", error=str(e))

    def _get_timestamp(self) -> str:
        """Get current timestamp string"""
        from datetime import datetime

        return datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    def get_validation_summary(self, user_id: str, days: int = 7) -> Dict[str, Any]:
        """Get file validation summary for user"""
        try:
            # This would query validation logs from CloudWatch or DynamoDB
            # Placeholder implementation
            return {
                "user_id": user_id,
                "validation_period_days": days,
                "total_files_uploaded": 0,
                "files_blocked": 0,
                "threats_detected": [],
                "file_types_uploaded": {},
                "average_file_size": 0,
            }

        except Exception as e:
            self.logger.error("Validation summary error", error=str(e))
            return {"error": str(e)}


def get_file_security_validator(
    config: Optional[FileUploadConfig] = None,
) -> FileSecurityValidator:
    """Factory function to get file security validator instance"""
    return FileSecurityValidator(config)
