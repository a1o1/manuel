"""
Manuel - Ingestion Status Function
Check the status of Knowledge Base ingestion jobs
"""

import json
import os
import sys
import time
from decimal import Decimal
from typing import Any, Dict, List

import boto3

# Import local file_tracker module
from file_tracker import get_file_tracking_stats, update_file_ingestion_status


def decimal_default(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    # Handle datetime objects
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    # Convert other non-serializable objects to string
    return str(obj)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Check status of Knowledge Base ingestion jobs"""

    try:
        # Handle CORS preflight
        if event.get("httpMethod") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                },
                "body": "",
            }

        # Extract user ID from Cognito JWT
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        user_id = claims.get("sub", "unknown-user")

        # Get query parameters
        query_params = event.get("queryStringParameters") or {}
        job_id = query_params.get("job_id")

        if job_id:
            # Get specific job status
            result = get_job_status(job_id, user_id)
        else:
            # Get all recent jobs for user
            result = get_recent_jobs(user_id)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(result, default=decimal_default),
        }

    except Exception as e:
        import traceback

        error_details = traceback.format_exc()
        print(f"Error getting ingestion status: {str(e)}")
        print(f"Error traceback: {error_details}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "error": "Failed to get ingestion status",
                    "details": str(e),
                    "traceback": error_details,
                },
                default=decimal_default,
            ),
        }


def get_job_status(job_id: str, user_id: str) -> Dict[str, Any]:
    """Get status of a specific ingestion job"""

    knowledge_base_id = os.environ["KNOWLEDGE_BASE_ID"]
    bedrock_client = boto3.client("bedrock-agent")
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

    try:
        # Get job info from DynamoDB using scan (since we don't know the exact date)
        response = table.scan(
            FilterExpression="user_id = :user_id_val",
            ExpressionAttributeValues={":user_id_val": f"ingestion_job#{job_id}"},
        )

        items = response.get("Items", [])

        if not items:
            return {"error": "Job not found", "job_id": job_id}

        job_info = items[0]  # Should only be one item with this job_id

        # Get live status from Bedrock
        try:
            # Get data source ID
            data_sources_response = bedrock_client.list_data_sources(
                knowledgeBaseId=knowledge_base_id
            )
            data_sources = data_sources_response.get("dataSourceSummaries", [])

            if not data_sources:
                return {
                    "job_id": job_id,
                    "status": "ERROR",
                    "error": "No data sources found",
                }

            data_source_id = data_sources[0]["dataSourceId"]

            # Get ingestion job status
            bedrock_response = bedrock_client.get_ingestion_job(
                knowledgeBaseId=knowledge_base_id,
                dataSourceId=data_source_id,
                ingestionJobId=job_id,
            )

            ingestion_job = bedrock_response["ingestionJob"]
            live_status = ingestion_job["status"]

            # Update DynamoDB if status changed
            if live_status != job_info.get("status"):
                table.update_item(
                    Key={"user_id": job_info["user_id"], "date": job_info["date"]},
                    UpdateExpression="SET #status = :status, updated_at = :updated_at",
                    ExpressionAttributeNames={"#status": "status"},
                    ExpressionAttributeValues={
                        ":status": live_status,
                        ":updated_at": int(time.time()),
                    },
                )

                # Update file tracking status if we have the S3 key
                s3_key = job_info.get("s3_key")
                if s3_key:
                    try:
                        update_file_ingestion_status(
                            s3_key, live_status, os.environ["USAGE_TABLE_NAME"]
                        )
                    except Exception as file_update_error:
                        print(
                            f"Warning: Failed to update file tracking status: {str(file_update_error)}"
                        )

            return {
                "job_id": job_id,
                "status": live_status,
                "s3_key": job_info.get("s3_key"),
                "created_at": job_info.get("created_at"),
                "updated_at": ingestion_job.get("updatedAt"),
                "statistics": ingestion_job.get("statistics", {}),
                "failure_reasons": ingestion_job.get("failureReasons", []),
            }

        except Exception as bedrock_error:
            print(f"Error getting live status from Bedrock: {str(bedrock_error)}")
            return {
                "job_id": job_id,
                "status": job_info.get("status", "UNKNOWN"),
                "s3_key": job_info.get("s3_key"),
                "created_at": job_info.get("created_at"),
                "error": "Could not get live status",
                "details": str(bedrock_error),
            }

    except Exception as e:
        import traceback

        error_details = traceback.format_exc()
        print(f"Error getting job status: {str(e)}")
        print(f"Error traceback: {error_details}")
        return {
            "error": "Failed to get job status",
            "details": str(e),
            "traceback": error_details,
        }


def get_recent_jobs(user_id: str) -> Dict[str, Any]:
    """Get recent ingestion jobs for all users (bootstrap context)"""

    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

    try:
        # Scan for ingestion jobs (they use "ingestion_job#" prefix)
        response = table.scan(
            FilterExpression="begins_with(user_id, :prefix)",
            ExpressionAttributeValues={":prefix": "ingestion_job#"},
        )

        jobs = []
        for item in response.get("Items", []):
            job_id = item["user_id"].replace("ingestion_job#", "")
            jobs.append(
                {
                    "job_id": job_id,
                    "status": item.get("status", "UNKNOWN"),
                    "s3_key": item.get("s3_key"),
                    "created_at": item.get("created_at"),
                    "updated_at": item.get("updated_at"),
                }
            )

        # Sort by creation time (newest first)
        jobs.sort(key=lambda x: x.get("created_at", 0), reverse=True)

        return {
            "total_jobs": len(jobs),
            "jobs": jobs[:10],  # Return most recent 10 jobs
            "note": "Showing most recent 10 ingestion jobs",
        }

    except Exception as e:
        print(f"Error getting recent jobs: {str(e)}")
        return {"error": "Failed to get recent jobs", "details": str(e)}
