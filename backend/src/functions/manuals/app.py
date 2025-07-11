"""
Manuel - Manuals Management Function
Handles manual listing and upload operations
"""

import base64
import json
import os
import sys
import uuid
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

sys.path.append("/opt/python")
sys.path.append("../../shared")

from utils import (
    create_response,
    get_user_id_from_event,
    handle_options_request,
    validate_json_body,
)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle manual management requests

    GET /api/manuals - List available manuals
    POST /api/manuals/upload - Upload new manual
    """

    # Handle CORS preflight
    if event["httpMethod"] == "OPTIONS":
        return handle_options_request()

    # Get user ID from JWT token
    user_id = get_user_id_from_event(event)
    if not user_id:
        return create_response(401, {"error": "Unauthorized"})

    # Route based on HTTP method
    if event["httpMethod"] == "GET":
        return handle_list_manuals()
    elif event["httpMethod"] == "POST":
        return handle_upload_manual(event, user_id)
    else:
        return create_response(405, {"error": "Method not allowed"})


def handle_list_manuals() -> Dict[str, Any]:
    """List all available manuals"""
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


def handle_upload_manual(event: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """Handle manual upload"""

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
                "error": "Invalid file type. Supported formats: PDF, DOC, DOCX, TXT, MD, HTML"
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
        print(f"Error uploading manual: {str(e)}")
        return create_response(500, {"error": "Failed to upload manual"})


def is_valid_manual_type(content_type: str, file_name: str) -> bool:
    """Check if file type is supported for manuals"""
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


def upload_manual_to_s3(
    file_name: str, file_data: str, content_type: str, user_id: str
) -> str:
    """Upload manual file to S3"""
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
    """Get metadata for a manual"""
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
    """Delete a manual from S3"""
    try:
        s3_client = boto3.client("s3")
        bucket_name = os.environ["MANUALS_BUCKET"]

        s3_client.delete_object(Bucket=bucket_name, Key=s3_key)

        return True

    except Exception as e:
        print(f"Error deleting manual: {str(e)}")
        return False
