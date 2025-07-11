"""
Manuel - Process Manual Function
Handles automatic processing of uploaded manuals and Knowledge Base sync
Triggered by S3 events when manuals are uploaded
"""

import json
import os
import sys
import urllib.parse
from typing import Any, Dict, Optional

import boto3

sys.path.append("/opt/python")
sys.path.append("../../shared")


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle S3 event for manual processing

    This function is triggered when a new manual is uploaded to S3.
    It initiates the Knowledge Base ingestion process.
    """

    try:
        # Process each S3 record
        for record in event.get("Records", []):
            if record.get("eventSource") == "aws:s3":
                process_s3_event(record)

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Manual processing completed"}),
        }

    except Exception as e:
        print(f"Error processing manual: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Manual processing failed"}),
        }


def process_s3_event(record: Dict[str, Any]) -> None:
    """Process individual S3 event record"""

    # Extract S3 information
    s3_info = record.get("s3", {})
    bucket_name = s3_info.get("bucket", {}).get("name")
    s3_key = urllib.parse.unquote_plus(s3_info.get("object", {}).get("key", ""))

    if not bucket_name or not s3_key:
        print("Missing S3 bucket or key information")
        return

    # Only process files in the manuals/ prefix
    if not s3_key.startswith("manuals/"):
        print(f"Skipping non-manual file: {s3_key}")
        return

    print(f"Processing manual: {s3_key} from bucket: {bucket_name}")

    # Start Knowledge Base ingestion
    start_knowledge_base_ingestion(bucket_name, s3_key)


def start_knowledge_base_ingestion(bucket_name: str, s3_key: str) -> None:
    """Start Knowledge Base ingestion job for the uploaded manual"""

    bedrock_client = boto3.client("bedrock-agent")
    knowledge_base_id = os.environ["KNOWLEDGE_BASE_ID"]

    try:
        # Get data source ID
        data_source_id = get_data_source_id(knowledge_base_id)

        if not data_source_id:
            print("Could not find data source ID")
            return

        # Start ingestion job
        import uuid

        job_id = str(uuid.uuid4())

        response = bedrock_client.start_ingestion_job(
            knowledgeBaseId=knowledge_base_id,
            dataSourceId=data_source_id,
            clientToken=job_id,
            description=f"Ingestion job for manual: {s3_key}",
        )

        ingestion_job_id = response["ingestionJob"]["ingestionJobId"]
        print(f"Started ingestion job: {ingestion_job_id} for manual: {s3_key}")

        # Store job information for tracking
        store_ingestion_job_info(ingestion_job_id, s3_key, bucket_name)

    except Exception as e:
        print(f"Error starting ingestion job: {str(e)}")
        raise


def get_data_source_id(knowledge_base_id: str) -> Optional[str]:
    """Get the data source ID for the Knowledge Base"""

    bedrock_client = boto3.client("bedrock-agent")

    try:
        response = bedrock_client.list_data_sources(knowledgeBaseId=knowledge_base_id)

        data_sources = response.get("dataSourceSummaries", [])

        if data_sources:
            return data_sources[0]["dataSourceId"]
        else:
            print("No data sources found for Knowledge Base")
            return None

    except Exception as e:
        print(f"Error getting data source ID: {str(e)}")
        return None


def store_ingestion_job_info(job_id: str, s3_key: str, bucket_name: str) -> None:
    """Store ingestion job information in DynamoDB for tracking"""

    try:
        dynamodb = boto3.resource("dynamodb")

        # Use the same table as usage tracking, but with different partition key
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        from datetime import datetime

        from utils import calculate_ttl

        # Store job info with TTL (cleanup after 7 days)
        table.put_item(
            Item={
                "user_id": f"ingestion_job#{job_id}",
                "date": datetime.utcnow().isoformat(),
                "job_id": job_id,
                "s3_key": s3_key,
                "bucket_name": bucket_name,
                "status": "STARTED",
                "created_at": datetime.utcnow().isoformat(),
                "ttl": calculate_ttl(7),  # Cleanup after 7 days
            }
        )

        print(f"Stored ingestion job info: {job_id}")

    except Exception as e:
        print(f"Error storing ingestion job info: {str(e)}")
        # Non-critical error, don't fail the entire process


def check_ingestion_job_status(
    job_id: str, knowledge_base_id: str, data_source_id: str
) -> str:
    """Check the status of an ingestion job"""

    bedrock_client = boto3.client("bedrock-agent")

    try:
        response = bedrock_client.get_ingestion_job(
            knowledgeBaseId=knowledge_base_id,
            dataSourceId=data_source_id,
            ingestionJobId=job_id,
        )

        return response["ingestionJob"]["status"]

    except Exception as e:
        print(f"Error checking ingestion job status: {str(e)}")
        return "UNKNOWN"


def update_ingestion_job_status(job_id: str, status: str) -> None:
    """Update ingestion job status in DynamoDB"""

    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        from datetime import datetime

        table.update_item(
            Key={
                "user_id": f"ingestion_job#{job_id}",
                "date": datetime.utcnow().isoformat(),
            },
            UpdateExpression="SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": status,
                ":updated_at": datetime.utcnow().isoformat(),
            },
        )

        print(f"Updated ingestion job {job_id} status to: {status}")

    except Exception as e:
        print(f"Error updating ingestion job status: {str(e)}")


def cleanup_failed_ingestion(job_id: str, s3_key: str) -> None:
    """Handle cleanup for failed ingestion jobs"""

    try:
        print(f"Cleaning up failed ingestion job: {job_id} for file: {s3_key}")

        # Update status to failed
        update_ingestion_job_status(job_id, "FAILED")

        # Could add additional cleanup logic here
        # For example, move failed files to a different S3 prefix
        # or send notifications

    except Exception as e:
        print(f"Error during cleanup: {str(e)}")


def get_manual_processing_status(s3_key: str) -> Dict[str, Any]:
    """Get processing status for a manual"""

    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        # Query for ingestion jobs for this S3 key
        response = table.scan(
            FilterExpression="contains(s3_key, :s3_key)",
            ExpressionAttributeValues={":s3_key": s3_key},
        )

        jobs = response.get("Items", [])

        if jobs:
            # Return the most recent job
            latest_job = max(jobs, key=lambda x: x.get("created_at", ""))
            return {
                "status": latest_job.get("status", "UNKNOWN"),
                "job_id": latest_job.get("job_id"),
                "created_at": latest_job.get("created_at"),
                "updated_at": latest_job.get("updated_at"),
            }
        else:
            return {
                "status": "NOT_PROCESSED",
                "job_id": None,
                "created_at": None,
                "updated_at": None,
            }

    except Exception as e:
        print(f"Error getting manual processing status: {str(e)}")
        return {"status": "ERROR", "error": str(e)}
