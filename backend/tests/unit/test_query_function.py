"""
Unit tests for Query Lambda function
"""

import json
import os

# Import the function under test
import sys
from unittest.mock import MagicMock, Mock, patch

import pytest
from botocore.exceptions import ClientError

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "src", "functions", "query")
)

from app import (
    generate_response_with_bedrock,
    handle_query,
    lambda_handler,
    query_knowledge_base,
)


class TestQueryLambdaHandler:
    """Test the main lambda handler function"""

    def test_lambda_handler_options_request(self, mock_context, mock_env_vars):
        """Test OPTIONS request handling"""
        event = {"httpMethod": "OPTIONS"}

        response = lambda_handler(event, mock_context)

        assert response["statusCode"] == 200
        assert "Access-Control-Allow-Origin" in response["headers"]
        assert "Access-Control-Allow-Methods" in response["headers"]

    def test_lambda_handler_missing_user_id(self, mock_context, mock_env_vars):
        """Test request without user authentication"""
        event = {
            "httpMethod": "POST",
            "path": "/api/query",
            "headers": {},
            "body": json.dumps({"question": "test question"}),
        }

        response = lambda_handler(event, mock_context)

        assert response["statusCode"] == 401
        response_body = json.loads(response["body"])
        assert "error" in response_body

    def test_lambda_handler_missing_question(
        self, sample_event, mock_context, mock_env_vars
    ):
        """Test request without question"""
        sample_event["httpMethod"] = "POST"
        sample_event["body"] = json.dumps({})

        response = lambda_handler(sample_event, mock_context)

        assert response["statusCode"] == 400
        response_body = json.loads(response["body"])
        assert "error" in response_body

    def test_lambda_handler_empty_question(
        self, sample_event, mock_context, mock_env_vars
    ):
        """Test request with empty question"""
        sample_event["httpMethod"] = "POST"
        sample_event["body"] = json.dumps({"question": ""})

        response = lambda_handler(sample_event, mock_context)

        assert response["statusCode"] == 400
        response_body = json.loads(response["body"])
        assert "error" in response_body

    def test_lambda_handler_invalid_method(
        self, sample_event, mock_context, mock_env_vars
    ):
        """Test invalid HTTP method"""
        sample_event["httpMethod"] = "DELETE"

        response = lambda_handler(sample_event, mock_context)

        assert response["statusCode"] == 405
        response_body = json.loads(response["body"])
        assert "error" in response_body

    @patch("app.handle_query")
    def test_lambda_handler_successful_query(
        self, mock_handle_query, sample_event, mock_context, mock_env_vars
    ):
        """Test successful query processing"""
        sample_event["httpMethod"] = "POST"
        sample_event["body"] = json.dumps({"question": "How do I configure WiFi?"})

        mock_handle_query.return_value = {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "answer": "To configure WiFi, go to settings...",
                    "usage": {"tokens": 25},
                    "cost": {"total": 0.001},
                }
            ),
        }

        response = lambda_handler(sample_event, mock_context)

        assert response["statusCode"] == 200
        response_body = json.loads(response["body"])
        assert "answer" in response_body
        assert "usage" in response_body
        assert "cost" in response_body

    def test_lambda_handler_exception_handling(
        self, sample_event, mock_context, mock_env_vars
    ):
        """Test exception handling in lambda handler"""
        sample_event["httpMethod"] = "POST"
        sample_event["body"] = json.dumps({"question": "test question"})

        with patch("app.handle_query", side_effect=Exception("Test error")):
            response = lambda_handler(sample_event, mock_context)

            assert response["statusCode"] == 500
            response_body = json.loads(response["body"])
            assert "error" in response_body


class TestHandleQuery:
    """Test the handle_query function"""

    @patch("app.UsageTracker")
    @patch("app.query_knowledge_base")
    @patch("app.generate_response_with_bedrock")
    @patch("app.calculate_request_cost")
    def test_handle_query_success(
        self,
        mock_calc_cost,
        mock_bedrock,
        mock_kb_query,
        mock_usage_tracker,
        mock_env_vars,
    ):
        """Test successful query handling"""
        # Setup mocks
        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.check_and_update_quota.return_value = (
            True,
            {"daily_used": 5, "daily_limit": 50},
        )

        mock_kb_query.return_value = ["Relevant context from manual"]
        mock_bedrock.return_value = {
            "answer": "This is the AI response",
            "usage": {"inputTokens": 10, "outputTokens": 15},
        }
        mock_calc_cost.return_value = {"total": 0.001, "breakdown": {}}

        result = handle_query("test-user", "How do I reset the device?")

        assert result["statusCode"] == 200
        response_body = json.loads(result["body"])
        assert "answer" in response_body
        assert "usage" in response_body
        assert "cost" in response_body

    @patch("app.UsageTracker")
    def test_handle_query_quota_exceeded(self, mock_usage_tracker, mock_env_vars):
        """Test quota exceeded scenario"""
        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.check_and_update_quota.return_value = (
            False,
            {"daily_used": 50, "daily_limit": 50},
        )

        result = handle_query("test-user", "test question")

        assert result["statusCode"] == 429
        response_body = json.loads(result["body"])
        assert "quota" in response_body["error"].lower()

    @patch("app.UsageTracker")
    @patch("app.query_knowledge_base")
    def test_handle_query_knowledge_base_error(
        self, mock_kb_query, mock_usage_tracker, mock_env_vars
    ):
        """Test knowledge base query error"""
        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.check_and_update_quota.return_value = (
            True,
            {"daily_used": 5, "daily_limit": 50},
        )

        mock_kb_query.side_effect = Exception("Knowledge base error")

        result = handle_query("test-user", "test question")

        assert result["statusCode"] == 500
        response_body = json.loads(result["body"])
        assert "error" in response_body

    @patch("app.UsageTracker")
    @patch("app.query_knowledge_base")
    @patch("app.generate_response_with_bedrock")
    def test_handle_query_bedrock_error(
        self, mock_bedrock, mock_kb_query, mock_usage_tracker, mock_env_vars
    ):
        """Test Bedrock generation error"""
        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.check_and_update_quota.return_value = (
            True,
            {"daily_used": 5, "daily_limit": 50},
        )

        mock_kb_query.return_value = ["context"]
        mock_bedrock.side_effect = ClientError(
            error_response={
                "Error": {"Code": "ThrottlingException", "Message": "Rate exceeded"}
            },
            operation_name="InvokeModel",
        )

        result = handle_query("test-user", "test question")

        assert result["statusCode"] == 429
        response_body = json.loads(result["body"])
        assert "throttl" in response_body["error"].lower()


class TestQueryKnowledgeBase:
    """Test the query_knowledge_base function"""

    @patch("boto3.client")
    def test_query_knowledge_base_success(
        self, mock_boto_client, mock_knowledge_base_response, mock_env_vars
    ):
        """Test successful knowledge base query"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        mock_client.retrieve.return_value = mock_knowledge_base_response

        result = query_knowledge_base("How do I configure WiFi?")

        assert isinstance(result, list)
        assert len(result) > 0
        assert "This is relevant information" in result[0]

        mock_client.retrieve.assert_called_once()

    @patch("boto3.client")
    def test_query_knowledge_base_no_results(self, mock_boto_client, mock_env_vars):
        """Test knowledge base query with no results"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        mock_client.retrieve.return_value = {"retrievalResults": []}

        result = query_knowledge_base("unknown question")

        assert isinstance(result, list)
        assert len(result) == 0

    @patch("boto3.client")
    def test_query_knowledge_base_client_error(self, mock_boto_client, mock_env_vars):
        """Test knowledge base query with client error"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        mock_client.retrieve.side_effect = ClientError(
            error_response={
                "Error": {"Code": "ValidationException", "Message": "Invalid input"}
            },
            operation_name="Retrieve",
        )

        with pytest.raises(Exception):
            query_knowledge_base("test question")

    @patch("boto3.client")
    def test_query_knowledge_base_filters_low_scores(
        self, mock_boto_client, mock_env_vars
    ):
        """Test knowledge base query filters low confidence results"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        # Mock response with mixed scores
        mock_response = {
            "retrievalResults": [
                {
                    "content": {"text": "High confidence result"},
                    "score": 0.85,
                    "metadata": {"source": "manual1.pdf"},
                },
                {
                    "content": {"text": "Low confidence result"},
                    "score": 0.30,
                    "metadata": {"source": "manual2.pdf"},
                },
            ]
        }
        mock_client.retrieve.return_value = mock_response

        result = query_knowledge_base("test question")

        assert len(result) == 1  # Only high confidence result
        assert "High confidence result" in result[0]


class TestGenerateResponseWithBedrock:
    """Test the generate_response_with_bedrock function"""

    @patch("boto3.client")
    def test_generate_response_success(
        self, mock_boto_client, mock_bedrock_response, mock_env_vars
    ):
        """Test successful response generation"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        mock_client.invoke_model.return_value = {
            "body": Mock(read=lambda: json.dumps(mock_bedrock_response))
        }

        context = ["Relevant manual information"]
        question = "How do I configure WiFi?"

        result = generate_response_with_bedrock(question, context)

        assert "answer" in result
        assert "usage" in result
        assert result["answer"] == "This is a test response from the AI model."

        mock_client.invoke_model.assert_called_once()

    @patch("boto3.client")
    def test_generate_response_throttling(self, mock_boto_client, mock_env_vars):
        """Test Bedrock throttling error handling"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        mock_client.invoke_model.side_effect = ClientError(
            error_response={
                "Error": {"Code": "ThrottlingException", "Message": "Rate exceeded"}
            },
            operation_name="InvokeModel",
        )

        context = ["test context"]
        question = "test question"

        with pytest.raises(ClientError):
            generate_response_with_bedrock(question, context)

    @patch("boto3.client")
    def test_generate_response_invalid_model_response(
        self, mock_boto_client, mock_env_vars
    ):
        """Test handling of invalid model response"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        mock_client.invoke_model.return_value = {
            "body": Mock(read=lambda: json.dumps({"invalid": "response"}))
        }

        context = ["test context"]
        question = "test question"

        with pytest.raises(KeyError):
            generate_response_with_bedrock(question, context)

    @patch("boto3.client")
    def test_generate_response_with_context_length_limit(
        self, mock_boto_client, mock_bedrock_response, mock_env_vars
    ):
        """Test response generation with very long context"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        mock_client.invoke_model.return_value = {
            "body": Mock(read=lambda: json.dumps(mock_bedrock_response))
        }

        # Create very long context
        long_context = ["Very long context " * 1000] * 10
        question = "test question"

        result = generate_response_with_bedrock(question, long_context)

        assert "answer" in result
        # Verify that the context was truncated in the actual call
        call_args = mock_client.invoke_model.call_args
        body = json.loads(call_args[1]["body"])
        # The context should be truncated to fit model limits
        assert len(json.dumps(body)) < 100000  # Reasonable limit


class TestQueryValidation:
    """Test query input validation"""

    def test_validate_question_length(self):
        """Test question length validation"""
        from app import lambda_handler

        # Very long question
        long_question = "x" * 10000
        event = {
            "httpMethod": "POST",
            "body": json.dumps({"question": long_question}),
            "requestContext": {"authorizer": {"claims": {"sub": "test-user"}}},
        }

        with patch.dict(os.environ, {"USAGE_TABLE_NAME": "test"}):
            response = lambda_handler(event, Mock())

            assert response["statusCode"] == 400
            response_body = json.loads(response["body"])
            assert "too long" in response_body["error"].lower()

    def test_validate_question_content(self):
        """Test question content validation"""
        from app import lambda_handler

        # Question with potentially malicious content
        malicious_question = "<script>alert('xss')</script>"
        event = {
            "httpMethod": "POST",
            "body": json.dumps({"question": malicious_question}),
            "requestContext": {"authorizer": {"claims": {"sub": "test-user"}}},
        }

        with patch.dict(os.environ, {"USAGE_TABLE_NAME": "test"}):
            response = lambda_handler(event, Mock())

            # Should either sanitize or reject
            assert response["statusCode"] in [200, 400]


class TestPerformanceMetrics:
    """Test performance and timing metrics"""

    @patch("app.handle_query")
    def test_response_timing_metrics(
        self, mock_handle_query, sample_event, mock_context, mock_env_vars
    ):
        """Test that response includes timing metrics"""
        sample_event["httpMethod"] = "POST"
        sample_event["body"] = json.dumps({"question": "test question"})

        mock_handle_query.return_value = {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "answer": "test answer",
                    "usage": {"tokens": 25},
                    "cost": {"total": 0.001},
                    "performance": {"duration_ms": 1500},
                }
            ),
        }

        response = lambda_handler(sample_event, mock_context)

        assert response["statusCode"] == 200
        response_body = json.loads(response["body"])
        assert "performance" in response_body


class TestErrorScenarios:
    """Test various error scenarios"""

    def test_malformed_json_body(self, sample_event, mock_context, mock_env_vars):
        """Test handling of malformed JSON in request body"""
        sample_event["httpMethod"] = "POST"
        sample_event["body"] = "invalid json {"

        response = lambda_handler(sample_event, mock_context)

        assert response["statusCode"] == 400
        response_body = json.loads(response["body"])
        assert "error" in response_body

    def test_missing_environment_variables(self, sample_event, mock_context):
        """Test handling of missing environment variables"""
        sample_event["httpMethod"] = "POST"
        sample_event["body"] = json.dumps({"question": "test question"})

        # Clear environment variables
        with patch.dict(os.environ, {}, clear=True):
            response = lambda_handler(sample_event, mock_context)

            assert response["statusCode"] == 500
            response_body = json.loads(response["body"])
            assert "error" in response_body

    def test_aws_service_unavailable(self, sample_event, mock_context, mock_env_vars):
        """Test handling when AWS services are unavailable"""
        sample_event["httpMethod"] = "POST"
        sample_event["body"] = json.dumps({"question": "test question"})

        with patch("boto3.client", side_effect=Exception("AWS service unavailable")):
            response = lambda_handler(sample_event, mock_context)

            assert response["statusCode"] == 500
            response_body = json.loads(response["body"])
            assert "error" in response_body
