"""
Manuel - Manuals Management Function (Minimal Version)
Simple manual management without complex dependencies
"""

import json
import os
import time
import urllib.request
import uuid
from typing import Any, Dict

import boto3


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle manual management requests"""

    try:
        # Get environment variables
        manuals_bucket = os.environ["MANUALS_BUCKET"]

        # Simple CORS handling
        method = event.get("httpMethod", "GET")
        path = event.get("path", "")

        if method == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                    "Access-Control-Allow-Headers": (
                        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,"
                        "X-Amz-Security-Token"
                    ),
                },
                "body": "",
            }

        # Extract user ID from Cognito JWT
        user_id = "default-user"  # Fallback for testing
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        if claims and "sub" in claims:
            user_id = claims["sub"]

        s3_client = boto3.client("s3")

        if method == "GET" and path.endswith("/api/manuals"):
            return handle_list_manuals(s3_client, manuals_bucket, user_id)

        elif method == "POST" and path.endswith("/api/manuals/download"):
            return handle_download_manual(event, s3_client, manuals_bucket, user_id)

        else:
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Endpoint not found"}),
            }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "error": "Internal server error",
                    "details": str(e),
                    "timestamp": int(time.time()),
                }
            ),
        }


def handle_list_manuals(s3_client, bucket_name: str, user_id: str) -> Dict[str, Any]:
    """List manuals for the user"""

    try:
        # List objects in the user's folder
        prefix = f"manuals/{user_id}/"
        response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)

        manuals = []
        for obj in response.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".pdf"):
                # Get object metadata to retrieve display name
                try:
                    metadata_response = s3_client.head_object(
                        Bucket=bucket_name, Key=key
                    )
                    display_name = metadata_response.get("Metadata", {}).get(
                        "display_name"
                    )

                    # Fallback to filename from key if no display name in metadata
                    if not display_name:
                        display_name = key.split("/")[-1]

                except Exception as e:
                    print(f"Error getting metadata for {key}: {e}")
                    display_name = key.split("/")[-1]

                manuals.append(
                    {
                        "id": key,
                        "name": display_name,
                        "upload_date": obj["LastModified"].isoformat(),
                        "size": obj["Size"],
                    }
                )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {"manuals": manuals, "user_id": user_id, "count": len(manuals)}
            ),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "Failed to list manuals", "details": str(e)}),
        }


def handle_download_manual(
    event: Dict[str, Any], s3_client, bucket_name: str, user_id: str
) -> Dict[str, Any]:
    """Download a manual from URL and store in S3"""

    try:
        # Parse request body
        body = event.get("body", "{}")
        if isinstance(body, str):
            body_data = json.loads(body)
        else:
            body_data = body

        url = body_data.get("url")
        if not url:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "URL is required"}),
            }

        # Get display name from request or extract from URL
        custom_filename = body_data.get("filename")
        if custom_filename:
            display_name = custom_filename
        else:
            # Extract filename from URL
            url_path = url.split("/")[-1]
            if url_path and "." in url_path:
                display_name = url_path.split("?")[0]  # Remove query parameters
            else:
                display_name = f"Manual-{int(time.time())}.pdf"

        # Generate unique filename for S3 storage
        manual_id = str(uuid.uuid4())
        file_extension = ".pdf"  # Assume PDF for now
        s3_key = f"manuals/{user_id}/{manual_id}{file_extension}"

        # Download the file from URL with browser-like headers
        print(f"Downloading from URL: {url}")

        # Create a request with headers to bypass bot detection
        request = urllib.request.Request(url)
        request.add_header(
            "User-Agent",
            (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/91.0.4472.124 Safari/537.36"
            ),
        )
        request.add_header("Accept", "application/pdf,application/octet-stream,*/*")
        request.add_header("Accept-Language", "en-US,en;q=0.9")
        request.add_header("Accept-Encoding", "gzip, deflate, br")
        request.add_header("Connection", "keep-alive")
        request.add_header("Upgrade-Insecure-Requests", "1")

        with urllib.request.urlopen(request) as response:
            file_data = response.read()

        # Upload to S3
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=file_data,
            ContentType="application/pdf",
            Metadata={
                "user_id": user_id,
                "original_url": url,
                "display_name": display_name,
                "upload_timestamp": str(int(time.time())),
            },
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "message": "Manual uploaded successfully",
                    "manual_id": manual_id,
                    "s3_key": s3_key,
                    "user_id": user_id,
                    "url": url,
                    "file_name": display_name,
                }
            ),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {"error": "Failed to download manual", "details": str(e)}
            ),
        }
