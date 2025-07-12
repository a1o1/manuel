"""Manuel - Manuals Management Function.

Handles manual listing and upload operations.
"""

import base64
import os
import sys
import uuid
from typing import Any, Dict

import boto3

sys.path.append("/opt/python")
sys.path.append("../../shared")

from logger import get_logger
from quota_cache import get_cached_quota_manager
from s3_optimizer import get_s3_optimizer
from url_downloader import DownloadConfig, get_secure_url_downloader
from utils import (
    create_response,
    get_user_id_from_event,
    handle_options_request,
    validate_json_body,
)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle manual management requests.

    GET /api/manuals - List available manuals
    POST /api/manuals/upload - Upload new manual
    POST /api/manuals/download - Download manual from URL
    """

    logger = get_logger("manuel-manuals", context)

    # Handle CORS preflight
    if event["httpMethod"] == "OPTIONS":
        return handle_options_request()

    # Get user ID from JWT token
    user_id = get_user_id_from_event(event)
    if not user_id:
        return create_response(401, {"error": "Unauthorized"})

    # Route based on HTTP method and path
    path = event.get("path", "")

    if event["httpMethod"] == "GET":
        return handle_list_manuals(logger)
    elif event["httpMethod"] == "POST":
        if path.endswith("/download"):
            return handle_download_manual(event, user_id, logger, context)
        else:
            return handle_upload_manual(event, user_id, logger)
    else:
        return create_response(405, {"error": "Method not allowed"})


def handle_list_manuals(logger) -> Dict[str, Any]:
    """List all available manuals."""
    try:
        s3_client = boto3.client("s3")
        bucket_name = os.environ["MANUALS_BUCKET"]

        # List objects in the manuals/ prefix
        response = s3_client.list_objects_v2(
            Bucket=bucket_name, Prefix="manuals/", Delimiter="/"
        )

        manuals = []
        for obj in response.get("Contents", []):
            if obj["Key"] != "manuals/":  # Skip the prefix itself
                manual_info = {
                    "key": obj["Key"],
                    "name": obj["Key"].split("/")[-1],  # Get filename
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat(),
                    "etag": obj["ETag"].strip('"'),
                }
                manuals.append(manual_info)

        return create_response(200, {"manuals": manuals, "count": len(manuals)})

    except Exception as e:
        print(f"Error listing manuals: {str(e)}")
        return create_response(500, {"error": "Failed to list manuals"})


def handle_upload_manual(event: Dict[str, Any], user_id: str, logger) -> Dict[str, Any]:
    """Handle manual upload."""

    # Validate request body
    is_valid, body = validate_json_body(
        event, ["file_name", "file_data", "content_type"]
    )
    if not is_valid:
        return create_response(400, body)

    file_name = body["file_name"].strip()
    file_data = body["file_data"]
    content_type = body["content_type"]

    # Validate file type
    if not is_valid_manual_type(content_type, file_name):
        return create_response(
            400,
            {
                "error": (
                    "Invalid file type. Supported formats: "
                    "PDF, DOC, DOCX, TXT, MD, HTML"
                )
            },
        )

    try:
        # Upload manual to S3
        s3_key = upload_manual_to_s3(file_name, file_data, content_type, user_id)

        return create_response(
            200,
            {
                "message": "Manual uploaded successfully",
                "key": s3_key,
                "file_name": file_name,
                "status": "processing",
            },
        )

    except Exception as e:
        logger.error(f"Error uploading manual: {str(e)}")
        return create_response(500, {"error": "Failed to upload manual"})


def handle_download_manual(
    event: Dict[str, Any], user_id: str, logger, context: Any
) -> Dict[str, Any]:
    """Handle manual download from URL."""

    # Validate request body
    is_valid, body = validate_json_body(event, ["url"])
    if not is_valid:
        return create_response(400, body)

    url = body["url"].strip()
    suggested_filename = body.get("filename", "").strip()

    try:
        # Check user quota first
        quota_manager = get_cached_quota_manager()
        can_proceed, quota_info = quota_manager.check_quota_fast(user_id)

        if not can_proceed:
            logger.warning(
                "Quota exceeded for URL download",
                user_id=user_id,
                quota_info=quota_info,
            )
            return create_response(
                429, {"error": "Quota exceeded", "quota_info": quota_info}
            )

        logger.info("Starting manual download from URL", url=url, user_id=user_id)

        # Configure secure downloader
        download_config = DownloadConfig(
            max_file_size_mb=int(os.environ.get("MAX_MANUAL_SIZE_MB", "50")),
            timeout_seconds=30,
            max_redirects=5,
            allowed_schemes={"https"},  # Only HTTPS for security
            verify_ssl=True,
        )

        # Download file securely
        downloader = get_secure_url_downloader(download_config)
        download_result = downloader.download_file(url, suggested_filename)

        if not download_result.success:
            logger.warning(
                "URL download failed", url=url, error=download_result.error_message
            )
            return create_response(
                400,
                {
                    "error": "Download failed",
                    "details": download_result.error_message,
                    "security_warnings": download_result.security_warnings,
                },
            )

        # Upload to S3 using optimized uploader
        s3_key = upload_downloaded_manual_to_s3(
            download_result.content,
            download_result.filename or "downloaded_manual.pdf",
            download_result.content_type or "application/pdf",
            user_id,
            url,
            logger,
        )

        # Increment quota after successful operation
        quota_manager.increment_usage_atomic(user_id, "manual_download")

        logger.info(
            "Manual downloaded and uploaded successfully",
            url=url,
            s3_key=s3_key,
            size=download_result.size_bytes,
            download_time_ms=download_result.download_time_ms,
        )

        return create_response(
            200,
            {
                "message": "Manual downloaded and uploaded successfully",
                "key": s3_key,
                "filename": download_result.filename,
                "size_bytes": download_result.size_bytes,
                "content_type": download_result.content_type,
                "download_time_ms": download_result.download_time_ms,
                "status": "processing",
                "security_warnings": download_result.security_warnings,
            },
        )

    except Exception as e:
        logger.error(
            f"Error downloading manual from URL: {str(e)}", url=url, user_id=user_id
        )
        return create_response(
            500, {"error": "Failed to download manual", "details": str(e)}
        )

    finally:
        # Cleanup downloader resources
        if "downloader" in locals():
            downloader.cleanup()


def is_valid_manual_type(content_type: str, file_name: str) -> bool:
    """Check if file type is supported for manuals."""
    valid_types = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown",
        "text/html",
        "application/vnd.ms-word",
    ]

    valid_extensions = [".pdf", ".doc", ".docx", ".txt", ".md", ".html", ".htm"]

    # Check content type
    if content_type in valid_types:
        return True

    # Check file extension as backup
    file_extension = os.path.splitext(file_name.lower())[1]
    return file_extension in valid_extensions


def upload_downloaded_manual_to_s3(
    file_content: bytes,
    filename: str,
    content_type: str,
    user_id: str,
    source_url: str,
    logger,
) -> str:
    """Upload downloaded manual content to S3 using optimized uploader."""

    # Get S3 optimizer for better performance
    s3_optimizer = get_s3_optimizer()
    bucket_name = os.environ["MANUALS_BUCKET"]

    # Generate S3 key
    from datetime import datetime

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]

    # Clean filename
    clean_name = "".join(
        c for c in filename if c.isalnum() or c in (" ", "-", "_", ".")
    ).rstrip()
    s3_key = f"manuals/{timestamp}_{unique_id}_{clean_name}"

    # Prepare metadata
    metadata = {
        "uploaded_by": user_id,
        "original_filename": filename,
        "source_url": source_url,
        "upload_timestamp": datetime.utcnow().isoformat(),
        "upload_method": "url_download",
    }

    # Upload using optimized S3 uploader
    upload_result = s3_optimizer.upload_file_optimized(
        file_data=file_content,
        bucket=bucket_name,
        key=s3_key,
        content_type=content_type,
        metadata=metadata,
    )

    if not upload_result.success:
        raise Exception(f"S3 upload failed: {upload_result.error_message}")

    logger.info(
        "Manual uploaded to S3 successfully",
        s3_key=s3_key,
        size=upload_result.size_bytes,
        upload_time_ms=upload_result.upload_time_ms,
        etag=upload_result.etag,
    )

    return s3_key


def upload_manual_to_s3(
    file_name: str, file_data: str, content_type: str, user_id: str
) -> str:
    """Upload manual file to S3."""
    s3_client = boto3.client("s3")
    bucket_name = os.environ["MANUALS_BUCKET"]

    # Generate S3 key
    # Use timestamp and UUID to avoid conflicts
    from datetime import datetime

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]

    # Clean filename
    clean_name = "".join(
        c for c in file_name if c.isalnum() or c in (" ", "-", "_", ".")
    ).rstrip()
    s3_key = f"manuals/{timestamp}_{unique_id}_{clean_name}"

    try:
        # Decode base64 file data
        file_bytes = base64.b64decode(file_data)

        # Upload to S3 with metadata
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            Metadata={
                "uploaded_by": user_id,
                "original_filename": file_name,
                "upload_timestamp": datetime.utcnow().isoformat(),
            },
            ServerSideEncryption="AES256",
        )

        return s3_key

    except Exception as e:
        print(f"Error uploading to S3: {str(e)}")
        raise


def get_manual_metadata(s3_key: str) -> Dict[str, Any]:
    """Get metadata for a manual."""
    try:
        s3_client = boto3.client("s3")
        bucket_name = os.environ["MANUALS_BUCKET"]

        response = s3_client.head_object(Bucket=bucket_name, Key=s3_key)

        return {
            "size": response["ContentLength"],
            "content_type": response["ContentType"],
            "last_modified": response["LastModified"].isoformat(),
            "etag": response["ETag"].strip('"'),
            "metadata": response.get("Metadata", {}),
        }

    except Exception as e:
        print(f"Error getting manual metadata: {str(e)}")
        return {}


def delete_manual(s3_key: str) -> bool:
    """Delete a manual from S3."""
    try:
        s3_client = boto3.client("s3")
        bucket_name = os.environ["MANUALS_BUCKET"]

        s3_client.delete_object(Bucket=bucket_name, Key=s3_key)

        return True

    except Exception as e:
        print(f"Error deleting manual: {str(e)}")
        return False
