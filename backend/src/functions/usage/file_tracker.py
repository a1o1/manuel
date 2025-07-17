"""
File Tracking Module for Deduplication
Tracks ingested files to prevent duplicate processing
"""

import time
from decimal import Decimal
from typing import Any, Dict, Optional

import boto3


def get_file_tracking_record(s3_key: str, table_name: str) -> Optional[Dict[str, Any]]:
    """Get file tracking record from DynamoDB"""

    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(table_name)

        response = table.get_item(
            Key={"user_id": f"file_tracker#{s3_key}", "date": "metadata"}
        )

        return response.get("Item")

    except Exception as e:
        print(f"Error getting file tracking record: {str(e)}")
        return None


def should_ingest_file(
    s3_key: str, s3_etag: str, s3_last_modified: str, s3_size: int, table_name: str
) -> bool:
    """
    Check if file should be ingested based on metadata
    Returns True if file is new or has changed, False if already processed
    """

    try:
        existing_record = get_file_tracking_record(s3_key, table_name)

        if not existing_record:
            print(f"File {s3_key} not previously tracked - will ingest")
            return True

        # Check if file content has changed (ETag is different)
        stored_etag = existing_record.get("s3_etag", "").strip('"')
        current_etag = s3_etag.strip('"')

        if stored_etag != current_etag:
            print(
                f"File {s3_key} has changed (ETag: {stored_etag} -> {current_etag}) - will ingest"
            )
            return True

        # Check ingestion status
        ingestion_status = existing_record.get("ingestion_status")
        if ingestion_status != "COMPLETE":
            print(
                f"File {s3_key} previous ingestion was {ingestion_status} - will retry"
            )
            return True

        print(
            f"File {s3_key} already ingested successfully (ETag: {current_etag}) - skipping"
        )
        return False

    except Exception as e:
        print(
            f"Error checking file ingestion status: {str(e)} - will ingest as fallback"
        )
        return True


def store_file_tracking_record(
    s3_key: str,
    s3_etag: str,
    s3_last_modified: str,
    s3_size: int,
    ingestion_job_id: str,
    table_name: str,
    ingestion_status: str = "STARTED",
) -> None:
    """Store file tracking record in DynamoDB"""

    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(table_name)

        # Store tracking record with TTL (30 days)
        ttl = int(time.time()) + (30 * 24 * 60 * 60)

        table.put_item(
            Item={
                "user_id": f"file_tracker#{s3_key}",
                "date": "metadata",
                "s3_key": s3_key,
                "s3_etag": s3_etag.strip('"'),  # Remove quotes from ETag
                "s3_last_modified": s3_last_modified,
                "s3_size": Decimal(str(s3_size)),
                "ingestion_job_id": ingestion_job_id,
                "ingestion_status": ingestion_status,
                "tracked_at": int(time.time()),
                "ttl": ttl,
            }
        )

        print(f"Stored file tracking record for {s3_key} with job {ingestion_job_id}")

    except Exception as e:
        print(f"Error storing file tracking record: {str(e)}")


def update_file_ingestion_status(
    s3_key: str, ingestion_status: str, table_name: str
) -> None:
    """Update ingestion status for a tracked file"""

    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(table_name)

        table.update_item(
            Key={"user_id": f"file_tracker#{s3_key}", "date": "metadata"},
            UpdateExpression="SET ingestion_status = :status, updated_at = :updated_at",
            ExpressionAttributeValues={
                ":status": ingestion_status,
                ":updated_at": int(time.time()),
            },
        )

        print(f"Updated ingestion status for {s3_key} to {ingestion_status}")

    except Exception as e:
        print(f"Error updating file ingestion status: {str(e)}")


def get_file_tracking_stats(table_name: str) -> Dict[str, Any]:
    """Get statistics about tracked files"""

    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(table_name)

        # Scan for file tracking records
        response = table.scan(
            FilterExpression="begins_with(user_id, :prefix)",
            ExpressionAttributeValues={":prefix": "file_tracker#"},
        )

        files = response.get("Items", [])

        stats = {
            "total_files": len(files),
            "by_status": {},
            "total_size_mb": 0,
            "files": [],
        }

        for file_record in files:
            status = file_record.get("ingestion_status", "UNKNOWN")
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1

            size_bytes = int(file_record.get("s3_size", 0))
            stats["total_size_mb"] += size_bytes / (1024 * 1024)

            stats["files"].append(
                {
                    "s3_key": file_record.get("s3_key"),
                    "status": status,
                    "size_mb": round(size_bytes / (1024 * 1024), 2),
                    "etag": file_record.get("s3_etag"),
                    "tracked_at": file_record.get("tracked_at"),
                    "job_id": file_record.get("ingestion_job_id"),
                }
            )

        stats["total_size_mb"] = round(stats["total_size_mb"], 2)
        return stats

    except Exception as e:
        print(f"Error getting file tracking stats: {str(e)}")
        return {"error": str(e)}
