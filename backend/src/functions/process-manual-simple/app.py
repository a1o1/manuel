"""
Manuel - Simple Process Manual Function (Minimal Version)
Handles automatic processing of uploaded manuals and Knowledge Base sync
Simplified version without complex dependencies
"""

import json
import os
import time
import urllib.parse
import uuid
from typing import Any, Dict, Optional

import boto3


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle S3 event for manual processing
    
    This function is triggered when a new manual is uploaded to S3.
    It initiates the Knowledge Base ingestion process.
    """
    
    try:
        print(f"Processing S3 event: {json.dumps(event)}")
        
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
            "body": json.dumps({"error": "Manual processing failed", "details": str(e)}),
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