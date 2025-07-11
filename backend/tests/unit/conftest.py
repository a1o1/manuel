"""
Pytest configuration for unit tests
"""

import os
import sys
from typing import Any, Dict
from unittest.mock import MagicMock, Mock, patch

import boto3
import pytest
from moto import mock_aws

# Add src directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


@pytest.fixture(autouse=True)
def mock_boto3():
    """Mock boto3.client and boto3.resource for all tests to prevent real AWS calls"""
    with patch("boto3.client") as mock_client, patch("boto3.resource") as mock_resource:
        # Return a mock client for any service
        mock_service_client = Mock()
        mock_client.return_value = mock_service_client
        
        # Return a mock resource for any service
        mock_service_resource = Mock()
        mock_resource.return_value = mock_service_resource
        
        yield {"client": mock_client, "resource": mock_resource}


@pytest.fixture
def mock_context():
    """Mock AWS Lambda context"""
    context = Mock()
    context.aws_request_id = "test-request-id-12345"
    context.function_name = "test-function"
    context.function_version = "$LATEST"
    context.invoked_function_arn = (
        "arn:aws:lambda:us-east-1:123456789012:function:test-function"
    )
    context.memory_limit_in_mb = 128
    context.remaining_time_in_millis = lambda: 300000
    return context


@pytest.fixture
def mock_env_vars():
    """Mock environment variables"""
    env_vars = {
        "USAGE_TABLE_NAME": "test-usage-table",
        "MANUALS_BUCKET": "test-manuals-bucket",
        "AUDIO_BUCKET": "test-audio-bucket",
        "KNOWLEDGE_BASE_ID": "test-kb-id",
        "TEXT_MODEL_ID": "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "EMBEDDING_MODEL_ID": "amazon.titan-embed-text-v2:0",
        "DAILY_QUOTA": "50",
        "MONTHLY_QUOTA": "1000",
        "KNOWLEDGE_BASE_RETRIEVAL_RESULTS": "5",
        "USAGE_DATA_RETENTION_DAYS": "90",
        "USE_INFERENCE_PROFILE": "false",
        "AWS_REGION": "eu-west-1",
        "STAGE": "test",
    }

    with patch.dict(os.environ, env_vars):
        yield env_vars


@pytest.fixture
def mock_boto3_clients():
    """Mock boto3 clients with proper mocking"""
    with mock_aws():
        # Create mock clients
        dynamodb = boto3.resource("dynamodb", region_name="eu-west-1")
        s3 = boto3.client("s3", region_name="eu-west-1")
        bedrock_agent = boto3.client("bedrock-agent", region_name="eu-west-1")
        bedrock_runtime = boto3.client("bedrock-runtime", region_name="eu-west-1")
        transcribe = boto3.client("transcribe", region_name="eu-west-1")

        # Create test table
        table = dynamodb.create_table(
            TableName="test-usage-table",
            KeySchema=[
                {"AttributeName": "user_id", "KeyType": "HASH"},
                {"AttributeName": "date", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "user_id", "AttributeType": "S"},
                {"AttributeName": "date", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        # Create test bucket
        s3.create_bucket(
            Bucket="test-manuals-bucket",
            CreateBucketConfiguration={"LocationConstraint": "eu-west-1"},
        )
        s3.create_bucket(
            Bucket="test-audio-bucket",
            CreateBucketConfiguration={"LocationConstraint": "eu-west-1"},
        )

        yield {
            "dynamodb": dynamodb,
            "s3": s3,
            "bedrock_agent": bedrock_agent,
            "bedrock_runtime": bedrock_runtime,
            "transcribe": transcribe,
            "table": table,
        }


@pytest.fixture
def sample_event():
    """Sample API Gateway event"""
    return {
        "httpMethod": "GET",
        "path": "/api/test",
        "headers": {
            "Authorization": "Bearer test-token",
            "Content-Type": "application/json",
            "User-Agent": "TestClient/1.0",
        },
        "queryStringParameters": {},
        "body": None,
        "requestContext": {
            "requestId": "test-request-id",
            "identity": {"sourceIp": "127.0.0.1", "userAgent": "TestClient/1.0"},
            "authorizer": {
                "claims": {"sub": "test-user-id", "email": "test@example.com"}
            },
        },
    }


@pytest.fixture
def sample_s3_event():
    """Sample S3 event for manual processing"""
    return {
        "Records": [
            {
                "eventSource": "aws:s3",
                "eventName": "ObjectCreated:Put",
                "s3": {
                    "bucket": {"name": "test-manuals-bucket"},
                    "object": {"key": "manuals/test-manual.pdf"},
                },
            }
        ]
    }


@pytest.fixture
def mock_jwt_token():
    """Mock JWT token for authentication testing"""
    return {
        "sub": "test-user-id",
        "email": "test@example.com",
        "aud": "test-client-id",
        "exp": 1234567890,
        "iat": 1234567890,
    }


@pytest.fixture
def mock_bedrock_response():
    """Mock Bedrock response"""
    return {
        "output": {
            "message": {
                "content": [{"text": "This is a test response from the AI model."}]
            }
        },
        "usage": {"inputTokens": 10, "outputTokens": 15, "totalTokens": 25},
    }


@pytest.fixture
def mock_knowledge_base_response():
    """Mock Knowledge Base query response"""
    return {
        "retrievalResults": [
            {
                "content": {"text": "This is relevant information from the manual."},
                "score": 0.85,
                "metadata": {"source": "test-manual.pdf"},
            }
        ]
    }


@pytest.fixture
def mock_transcribe_response():
    """Mock Transcribe response"""
    return {
        "TranscriptionJob": {
            "TranscriptionJobName": "test-job",
            "TranscriptionJobStatus": "COMPLETED",
            "Transcript": {
                "TranscriptFileUri": "s3://test-bucket/test-transcript.json"
            },
        }
    }
