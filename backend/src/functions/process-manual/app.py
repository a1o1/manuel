"""
Manuel - Process Manual Function
Handles automatic processing of uploaded manuals and Knowledge Base sync
Triggered by S3 events when manuals are uploaded
"""

import json
import os
import sys
import time
import urllib.parse
from typing import Any, Dict, Optional

import boto3

sys.path.append("/opt/python")
sys.path.append("../../shared")

from file_security import FileUploadConfig, get_file_security_validator
from logger import get_logger


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
    logger = get_logger("manual-processor")

    # Extract S3 information
    s3_info = record.get("s3", {})
    bucket_name = s3_info.get("bucket", {}).get("name")
    s3_key = urllib.parse.unquote_plus(s3_info.get("object", {}).get("key", ""))

    if not bucket_name or not s3_key:
        logger.warning("Missing S3 bucket or key information")
        return

    # Only process files in the manuals/ prefix
    if not s3_key.startswith("manuals/"):
        logger.info(f"Skipping non-manual file: {s3_key}")
        return

    logger.info(f"Processing manual: {s3_key} from bucket: {bucket_name}")

    # Perform security validation on uploaded file
    try:
        if not validate_uploaded_manual_security(bucket_name, s3_key, logger):
            logger.error(f"Security validation failed for manual: {s3_key}")
            quarantine_unsafe_manual(bucket_name, s3_key, logger)
            return
    except Exception as e:
        logger.error(f"Security validation error for {s3_key}: {str(e)}")
        return

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


def validate_uploaded_manual_security(bucket_name: str, s3_key: str, logger) -> bool:
    """Validate uploaded manual file for security threats"""

    try:
        # Download file from S3 for validation
        s3_client = boto3.client("s3")

        # Get file metadata first
        try:
            response = s3_client.head_object(Bucket=bucket_name, Key=s3_key)
            file_size = response["ContentLength"]
            content_type = response.get("ContentType", "application/octet-stream")
        except Exception as e:
            logger.error(f"Failed to get file metadata for {s3_key}: {str(e)}")
            return False

        # Check file size limit (50MB for documents)
        max_size = int(os.environ.get("MAX_MANUAL_SIZE_MB", "50")) * 1024 * 1024
        if file_size > max_size:
            logger.warning(
                f"Manual file too large: {file_size} bytes > {max_size} bytes",
                s3_key=s3_key,
            )
            return False

        # Download file content for validation
        response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
        file_content = response["Body"].read()

        # Convert to base64 for validation
        import base64

        file_data_b64 = base64.b64encode(file_content).decode()

        # Create file validator for documents
        file_validator = get_file_security_validator(
            FileUploadConfig(
                max_file_size_mb=int(os.environ.get("MAX_MANUAL_SIZE_MB", "50")),
                scan_for_malware=True,
                validate_file_headers=True,
                quarantine_suspicious_files=False,  # We'll handle quarantine manually
            )
        )

        # Extract filename from S3 key
        filename = s3_key.split("/")[-1] if "/" in s3_key else s3_key

        # Validate file
        validation_result = file_validator.validate_file_upload(
            file_data=file_data_b64,
            content_type=content_type,
            filename=filename,
            user_id="system_upload",
        )

        if not validation_result.is_valid:
            logger.warning(
                "Manual security validation failed",
                s3_key=s3_key,
                threats=len(validation_result.threats_detected),
                error=validation_result.error_message,
            )
            return False

        # Log any detected threats (even if not blocking)
        if validation_result.threats_detected:
            logger.warning(
                "Manual has security concerns but is allowed",
                s3_key=s3_key,
                threats=[t.value for t in validation_result.threats_detected],
            )

        logger.info(
            "Manual security validation passed",
            s3_key=s3_key,
            file_size=validation_result.size_bytes,
            content_hash=validation_result.content_hash,
        )

        return True

    except Exception as e:
        logger.error(f"Security validation error for {s3_key}: {str(e)}")
        return False


def quarantine_unsafe_manual(bucket_name: str, s3_key: str, logger) -> None:
    """Move unsafe manual to quarantine location"""

    try:
        s3_client = boto3.client("s3")
        quarantine_bucket = os.environ.get("QUARANTINE_BUCKET", bucket_name)
        quarantine_key = f"quarantine/manuals/{s3_key.replace('/', '_')}"

        # Copy to quarantine location
        copy_source = {"Bucket": bucket_name, "Key": s3_key}
        s3_client.copy_object(
            CopySource=copy_source,
            Bucket=quarantine_bucket,
            Key=quarantine_key,
            MetadataDirective="REPLACE",
            Metadata={
                "quarantine_reason": "Security validation failed",
                "original_bucket": bucket_name,
                "original_key": s3_key,
                "quarantine_timestamp": str(int(time.time())),
            },
            ServerSideEncryption="AES256",
        )

        # Delete original file
        s3_client.delete_object(Bucket=bucket_name, Key=s3_key)

        logger.warning(
            "Manual quarantined due to security threats",
            original_location=f"{bucket_name}/{s3_key}",
            quarantine_location=f"{quarantine_bucket}/{quarantine_key}",
        )

        # Record quarantine event
        record_quarantine_event(s3_key, quarantine_key, "Security validation failed")

    except Exception as e:
        logger.error(f"Failed to quarantine manual {s3_key}: {str(e)}")


def record_quarantine_event(
    original_key: str, quarantine_key: str, reason: str
) -> None:
    """Record file quarantine event in DynamoDB"""

    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

        from datetime import datetime

        from utils import calculate_ttl

        # Store quarantine record
        table.put_item(
            Item={
                "user_id": f"quarantine_event#{quarantine_key}",
                "date": datetime.utcnow().isoformat(),
                "event_type": "file_quarantined",
                "original_key": original_key,
                "quarantine_key": quarantine_key,
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat(),
                "ttl": calculate_ttl(90),  # Keep quarantine records for 90 days
            }
        )

    except Exception as e:
        print(f"Failed to record quarantine event: {str(e)}")


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
            latest_job = max(jobs, key=lambda x: str(x.get("created_at", "")))
            return {
                "status": str(latest_job.get("status", "UNKNOWN")),
                "job_id": str(latest_job.get("job_id", "")),
                "created_at": str(latest_job.get("created_at", "")),
                "updated_at": str(latest_job.get("updated_at", "")),
            }
        else:
            return {
                "status": "NOT_PROCESSED",
                "job_id": "",
                "created_at": "",
                "updated_at": "",
            }

    except Exception as e:
        print(f"Error getting manual processing status: {str(e)}")
        return {"status": "ERROR", "error": str(e)}
