"""
Manuel - Bootstrap Function
Populates the system with sample manuals for demonstration and testing
"""

import json
import os
import sys
import time
import urllib.request
import uuid
from typing import Any, Dict, List

import boto3

# Import local file_tracker module
from file_tracker import should_ingest_file, store_file_tracking_record

# Sample manual URLs for bootstrap
SAMPLE_MANUALS = [
    {
        "url": "https://www.apple.com/support/manuals/iphone/",
        "name": "iPhone User Guide",
        "description": "Official iPhone user guide from Apple",
    },
    # Add more sample manuals here - need to find actual PDF URLs
]


# For now, let's use a simple test approach
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Bootstrap the system with sample manuals"""

    try:
        # Get environment variables
        manuals_bucket = os.environ.get("MANUALS_BUCKET")

        if not manuals_bucket:
            return {
                "statusCode": 400,
                "body": json.dumps(
                    {"error": "MANUALS_BUCKET environment variable not set"}
                ),
            }

        # Simple CORS handling
        method = event.get("httpMethod", "POST")

        if method == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                },
                "body": "",
            }

        # Extract user ID from Cognito JWT
        user_id = "bootstrap-user"  # Special bootstrap user
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        if claims and "sub" in claims:
            user_id = claims["sub"]

        # Parse request body for specific action
        body = event.get("body", "{}")
        if isinstance(body, str):
            body_data = json.loads(body) if body else {}
        else:
            body_data = body

        action = body_data.get("action", "populate")

        if action == "populate":
            return reprocess_existing_manuals(manuals_bucket, user_id)
        elif action == "clear":
            return clear_sample_manuals(manuals_bucket, user_id)
        elif action == "status":
            return get_bootstrap_status(manuals_bucket, user_id)
        else:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps(
                    {"error": "Invalid action. Use 'populate', 'clear', or 'status'"}
                ),
            }

    except Exception as e:
        print(f"Bootstrap error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "error": "Bootstrap failed",
                    "details": str(e),
                    "timestamp": int(time.time()),
                }
            ),
        }


def reprocess_existing_manuals(bucket_name: str, user_id: str) -> Dict[str, Any]:
    """Trigger Knowledge Base ingestion for existing manuals in S3 (with deduplication)"""

    s3_client = boto3.client("s3")
    table_name = os.environ.get("USAGE_TABLE_NAME")

    try:
        # Scan ALL users' manuals in the bucket, not just current user
        print(f"Scanning for existing manuals in bucket: {bucket_name}")

        response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix="manuals/")

        found_manuals = []
        ingestion_jobs = []
        skipped_files = []

        for obj in response.get("Contents", []):
            s3_key = obj["Key"]

            # Skip directories and non-PDF files
            if s3_key.endswith("/") or not s3_key.lower().endswith(".pdf"):
                continue

            file_size = obj["Size"]
            last_modified = obj["LastModified"].isoformat()

            # Get detailed metadata including ETag for deduplication
            try:
                head_response = s3_client.head_object(Bucket=bucket_name, Key=s3_key)
                s3_etag = head_response["ETag"]
                s3_last_modified = head_response["LastModified"].isoformat()

                found_manuals.append(
                    {
                        "s3_key": s3_key,
                        "size": file_size,
                        "last_modified": last_modified,
                        "etag": s3_etag,
                    }
                )

                print(
                    f"Found existing manual: {s3_key} ({file_size} bytes, ETag: {s3_etag})"
                )

                # Check if file needs ingestion (deduplication logic)
                if should_ingest_file(
                    s3_key, s3_etag, s3_last_modified, file_size, table_name
                ):
                    # Trigger Knowledge Base ingestion for this manual
                    try:
                        job_id = trigger_knowledge_base_ingestion(bucket_name, s3_key)
                        if job_id:
                            ingestion_jobs.append(
                                {
                                    "s3_key": s3_key,
                                    "job_id": job_id,
                                }
                            )
                            # Store job info for tracking
                            store_ingestion_job_info(job_id, s3_key, bucket_name)
                            # Store file tracking record
                            store_file_tracking_record(
                                s3_key,
                                s3_etag,
                                s3_last_modified,
                                file_size,
                                job_id,
                                table_name,
                            )
                    except Exception as e:
                        print(
                            f"Warning: Failed to trigger ingestion for {s3_key}: {str(e)}"
                        )
                else:
                    skipped_files.append(
                        {"s3_key": s3_key, "reason": "Already ingested successfully"}
                    )

            except Exception as e:
                print(f"Warning: Failed to get metadata for {s3_key}: {str(e)}")
                continue

        if not found_manuals:
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps(
                    {
                        "message": "No existing manuals found in S3",
                        "found_manuals": 0,
                        "bucket": bucket_name,
                    }
                ),
            }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "message": "Processed existing manuals with deduplication",
                    "found_manuals": len(found_manuals),
                    "ingestion_jobs": len(ingestion_jobs),
                    "skipped_files": len(skipped_files),
                    "manuals": found_manuals,
                    "jobs": ingestion_jobs,
                    "skipped": skipped_files,
                    "bucket": bucket_name,
                    "note": "Knowledge Base ingestion may take 5-10 minutes to complete",
                    "deduplication": "Files already ingested successfully were skipped",
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
                {
                    "error": "Failed to reprocess existing manuals",
                    "details": str(e),
                }
            ),
        }


def clear_sample_manuals(bucket_name: str, user_id: str) -> Dict[str, Any]:
    """Clear bootstrap manuals for a user"""

    s3_client = boto3.client("s3")

    try:
        # List all objects in user's manual folder
        prefix = f"manuals/{user_id}/"
        response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)

        deleted_count = 0

        for obj in response.get("Contents", []):
            key = obj["Key"]

            # Check if it's a bootstrap manual by checking metadata
            try:
                head_response = s3_client.head_object(Bucket=bucket_name, Key=key)
                metadata = head_response.get("Metadata", {})

                if metadata.get("bootstrap") == "true":
                    s3_client.delete_object(Bucket=bucket_name, Key=key)
                    deleted_count += 1
                    print(f"Deleted bootstrap manual: {key}")

            except Exception as e:
                print(f"Error checking/deleting {key}: {str(e)}")
                continue

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "message": "Bootstrap manuals cleared",
                    "deleted_count": deleted_count,
                    "user_id": user_id,
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
                {
                    "error": "Failed to clear bootstrap manuals",
                    "details": str(e),
                }
            ),
        }


def get_bootstrap_status(bucket_name: str, user_id: str) -> Dict[str, Any]:
    """Get status of bootstrap manuals"""

    s3_client = boto3.client("s3")

    try:
        # List all manuals in user folder
        prefix = f"manuals/{user_id}/"
        response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)

        total_manuals = 0
        bootstrap_manuals = 0

        for obj in response.get("Contents", []):
            key = obj["Key"]
            total_manuals += 1

            # Check if it's a bootstrap manual
            try:
                head_response = s3_client.head_object(Bucket=bucket_name, Key=key)
                metadata = head_response.get("Metadata", {})

                if metadata.get("bootstrap") == "true":
                    bootstrap_manuals += 1

            except Exception as e:
                print(f"Error checking {key}: {str(e)}")
                continue

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "user_id": user_id,
                    "total_manuals": total_manuals,
                    "bootstrap_manuals": bootstrap_manuals,
                    "has_bootstrap_data": bootstrap_manuals > 0,
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
                {
                    "error": "Failed to get bootstrap status",
                    "details": str(e),
                }
            ),
        }


def trigger_knowledge_base_ingestion(bucket_name: str, s3_key: str) -> str:
    """Trigger Knowledge Base ingestion for uploaded manual"""

    try:
        knowledge_base_id = os.environ.get("KNOWLEDGE_BASE_ID")
        if not knowledge_base_id:
            print("KNOWLEDGE_BASE_ID environment variable not set")
            return None

        bedrock_client = boto3.client("bedrock-agent")

        # Get data source ID
        response = bedrock_client.list_data_sources(knowledgeBaseId=knowledge_base_id)
        data_sources = response.get("dataSourceSummaries", [])

        if not data_sources:
            print("No data sources found for Knowledge Base")
            return None

        data_source_id = data_sources[0]["dataSourceId"]

        # Start ingestion job
        job_id = str(uuid.uuid4())

        response = bedrock_client.start_ingestion_job(
            knowledgeBaseId=knowledge_base_id,
            dataSourceId=data_source_id,
            clientToken=job_id,
            description=f"Reprocess existing manual: {s3_key}",
        )

        ingestion_job_id = response["ingestionJob"]["ingestionJobId"]
        print(f"Started Knowledge Base ingestion job: {ingestion_job_id} for {s3_key}")

        return ingestion_job_id

    except Exception as e:
        print(f"Error triggering Knowledge Base ingestion: {str(e)}")
        raise


def store_ingestion_job_info(job_id: str, s3_key: str, bucket_name: str) -> None:
    """Store ingestion job information in DynamoDB for tracking"""

    try:
        dynamodb = boto3.resource("dynamodb")

        # Use the same table as usage tracking, but with different partition key
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        # Store job info with TTL (cleanup after 7 days)
        ttl = int(time.time()) + (7 * 24 * 60 * 60)  # 7 days from now

        table.put_item(
            Item={
                "user_id": f"ingestion_job#{job_id}",
                "date": str(int(time.time())),
                "job_id": job_id,
                "s3_key": s3_key,
                "bucket_name": bucket_name,
                "status": "STARTED",
                "created_at": int(time.time()),
                "ttl": ttl,
            }
        )

        print(f"Stored ingestion job info: {job_id}")

    except Exception as e:
        print(f"Error storing ingestion job info: {str(e)}")
        # Non-critical error, don't fail the entire process
