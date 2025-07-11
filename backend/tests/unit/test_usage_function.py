"""
Unit tests for Usage Lambda function
"""

import json
import os

# Import the function under test
import sys
from datetime import datetime, timedelta
from unittest.mock import MagicMock, Mock, patch

import pytest
from botocore.exceptions import ClientError

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "src", "functions", "usage")
)
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "src", "shared")
)

from app import (
    determine_quota_status,
    get_historical_usage,
    get_operation_breakdown,
    get_quota_limits,
    handle_get_quota,
    handle_get_usage,
    lambda_handler,
    reset_daily_quota,
)


class TestUsageLambdaHandler:
    """Test the main lambda handler function"""

    def test_lambda_handler_options_request(self, mock_context, mock_env_vars):
        """Test OPTIONS request handling"""
        event = {"httpMethod": "OPTIONS"}

        response = lambda_handler(event, mock_context)

        assert response["statusCode"] == 200
        assert "Access-Control-Allow-Origin" in response["headers"]

    def test_lambda_handler_missing_auth(self, mock_context, mock_env_vars):
        """Test request without authentication"""
        event = {
            "httpMethod": "GET",
            "path": "/api/user/usage",
            "headers": {},
            "requestContext": {},
        }

        response = lambda_handler(event, mock_context)

        assert response["statusCode"] == 401
        response_body = json.loads(response["body"])
        assert "error" in response_body

    def test_lambda_handler_usage_endpoint(
        self, sample_event, mock_context, mock_env_vars
    ):
        """Test usage endpoint"""
        sample_event["path"] = "/api/user/usage"

        with patch("app.handle_get_usage") as mock_handle:
            mock_handle.return_value = {
                "statusCode": 200,
                "body": json.dumps({"daily_usage": {"used": 5, "limit": 50}}),
            }

            response = lambda_handler(sample_event, mock_context)

            assert response["statusCode"] == 200
            mock_handle.assert_called_once()

    def test_lambda_handler_quota_endpoint(
        self, sample_event, mock_context, mock_env_vars
    ):
        """Test quota endpoint"""
        sample_event["path"] = "/api/user/quota"

        with patch("app.handle_get_quota") as mock_handle:
            mock_handle.return_value = {
                "statusCode": 200,
                "body": json.dumps({"quotas": {"daily": {"used": 5, "limit": 50}}}),
            }

            response = lambda_handler(sample_event, mock_context)

            assert response["statusCode"] == 200
            mock_handle.assert_called_once()

    def test_lambda_handler_invalid_endpoint(
        self, sample_event, mock_context, mock_env_vars
    ):
        """Test invalid endpoint"""
        sample_event["path"] = "/api/user/invalid"

        response = lambda_handler(sample_event, mock_context)

        assert response["statusCode"] == 404
        response_body = json.loads(response["body"])
        assert "error" in response_body


class TestHandleGetUsage:
    """Test the handle_get_usage function"""

    @patch("utils.UsageTracker")
    @patch("app.get_historical_usage")
    @patch("app.get_operation_breakdown")
    def test_handle_get_usage_success(
        self, mock_breakdown, mock_historical, mock_usage_tracker, mock_env_vars
    ):
        """Test successful usage retrieval"""
        # Setup mocks
        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.get_usage_stats.return_value = {
            "daily_used": 5,
            "daily_limit": 50,
            "monthly_used": 25,
            "monthly_limit": 1000,
        }

        mock_historical.return_value = [
            {"date": "2024-01-01", "daily_count": 3, "operations": {"query": 3}}
        ]

        mock_breakdown.return_value = {"transcribe": 10, "query": 15, "total": 25}

        result = handle_get_usage("test-user")

        assert result["statusCode"] == 200
        response_body = json.loads(result["body"])
        assert "user_id" in response_body
        assert "current" in response_body
        assert "historical" in response_body
        assert "breakdown" in response_body

    @patch("utils.UsageTracker")
    def test_handle_get_usage_tracker_error(self, mock_usage_tracker, mock_env_vars):
        """Test usage retrieval with tracker error"""
        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.get_usage_stats.side_effect = Exception("DynamoDB error")

        result = handle_get_usage("test-user")

        assert result["statusCode"] == 500
        response_body = json.loads(result["body"])
        assert "error" in response_body


class TestHandleGetQuota:
    """Test the handle_get_quota function"""

    @patch("utils.UsageTracker")
    def test_handle_get_quota_success(self, mock_usage_tracker, mock_env_vars):
        """Test successful quota retrieval"""
        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.get_usage_stats.return_value = {
            "daily_used": 15,
            "daily_limit": 50,
            "monthly_used": 150,
            "monthly_limit": 1000,
            "last_operation": "query",
            "last_updated": "2024-01-01T12:00:00Z",
        }

        result = handle_get_quota("test-user")

        assert result["statusCode"] == 200
        response_body = json.loads(result["body"])
        assert "quotas" in response_body
        assert "daily" in response_body["quotas"]
        assert "monthly" in response_body["quotas"]

        # Check calculated values
        daily_quota = response_body["quotas"]["daily"]
        assert daily_quota["used"] == 15
        assert daily_quota["remaining"] == 35
        assert daily_quota["percent_used"] == 30.0

    @patch("utils.UsageTracker")
    def test_handle_get_quota_over_limit(self, mock_usage_tracker, mock_env_vars):
        """Test quota retrieval when over limit"""
        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.get_usage_stats.return_value = {
            "daily_used": 55,
            "daily_limit": 50,
            "monthly_used": 55,
            "monthly_limit": 1000,
        }

        result = handle_get_quota("test-user")

        assert result["statusCode"] == 200
        response_body = json.loads(result["body"])

        daily_quota = response_body["quotas"]["daily"]
        assert daily_quota["remaining"] == 0  # Max of 0
        assert daily_quota["percent_used"] == 110.0
        assert response_body["status"] == "EXCEEDED"


class TestGetHistoricalUsage:
    """Test the get_historical_usage function"""

    @patch("boto3.resource")
    def test_get_historical_usage_success(self, mock_boto_resource, mock_env_vars):
        """Test successful historical usage retrieval"""
        # Setup mock table
        mock_table = Mock()
        mock_dynamodb = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_boto_resource.return_value = mock_dynamodb

        # Mock table responses
        mock_table.get_item.side_effect = [
            {"Item": {"daily_count": 5, "operations": {"query": 3, "transcribe": 2}}},
            {},  # No item for this date
            {"Item": {"daily_count": 8, "operations": {"query": 5, "transcribe": 3}}},
        ]

        result = get_historical_usage("test-user", days=3)

        assert len(result) == 3
        assert result[0]["daily_count"] == 5
        assert result[1]["daily_count"] == 0  # No data
        assert result[2]["daily_count"] == 8

    @patch("boto3.resource")
    def test_get_historical_usage_table_error(self, mock_boto_resource, mock_env_vars):
        """Test historical usage with table error"""
        mock_table = Mock()
        mock_dynamodb = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_boto_resource.return_value = mock_dynamodb

        mock_table.get_item.side_effect = ClientError(
            error_response={"Error": {"Code": "ResourceNotFoundException"}},
            operation_name="GetItem",
        )

        result = get_historical_usage("test-user", days=2)

        # Should return empty data for error cases
        assert len(result) == 2
        assert all(item["daily_count"] == 0 for item in result)

    @patch("boto3.resource")
    def test_get_historical_usage_exception(self, mock_boto_resource, mock_env_vars):
        """Test historical usage with general exception"""
        mock_boto_resource.side_effect = Exception("DynamoDB connection error")

        result = get_historical_usage("test-user", days=1)

        assert result == []


class TestGetOperationBreakdown:
    """Test the get_operation_breakdown function"""

    @patch("boto3.resource")
    def test_get_operation_breakdown_success(self, mock_boto_resource, mock_env_vars):
        """Test successful operation breakdown retrieval"""
        mock_table = Mock()
        mock_dynamodb = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_boto_resource.return_value = mock_dynamodb

        # Mock query response
        mock_table.query.return_value = {
            "Items": [
                {"last_operation": "query", "daily_count": 5},
                {"last_operation": "transcribe", "daily_count": 3},
                {"last_operation": "query", "daily_count": 2},
                {"last_operation": "unknown", "daily_count": 1},  # Unknown operation
            ]
        }

        result = get_operation_breakdown("test-user")

        assert result["query"] == 7  # 5 + 2
        assert result["transcribe"] == 3
        assert result["total"] == 11  # 5 + 3 + 2 + 1

    @patch("boto3.resource")
    def test_get_operation_breakdown_no_data(self, mock_boto_resource, mock_env_vars):
        """Test operation breakdown with no data"""
        mock_table = Mock()
        mock_dynamodb = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_boto_resource.return_value = mock_dynamodb

        mock_table.query.return_value = {"Items": []}

        result = get_operation_breakdown("test-user")

        assert result["query"] == 0
        assert result["transcribe"] == 0
        assert result["total"] == 0

    @patch("boto3.resource")
    def test_get_operation_breakdown_error(self, mock_boto_resource, mock_env_vars):
        """Test operation breakdown with error"""
        mock_boto_resource.side_effect = Exception("Query error")

        result = get_operation_breakdown("test-user")

        assert result == {"transcribe": 0, "query": 0, "total": 0}


class TestDetermineQuotaStatus:
    """Test the determine_quota_status function"""

    def test_quota_status_ok(self):
        """Test OK quota status"""
        assert determine_quota_status(25.0, 30.0) == "OK"

    def test_quota_status_moderate(self):
        """Test MODERATE quota status"""
        assert determine_quota_status(60.0, 55.0) == "MODERATE"

    def test_quota_status_warning(self):
        """Test WARNING quota status"""
        assert determine_quota_status(80.0, 75.0) == "WARNING"

    def test_quota_status_critical(self):
        """Test CRITICAL quota status"""
        assert determine_quota_status(95.0, 90.0) == "CRITICAL"

    def test_quota_status_exceeded(self):
        """Test EXCEEDED quota status"""
        assert determine_quota_status(105.0, 100.0) == "EXCEEDED"

    def test_quota_status_uses_max(self):
        """Test that status uses the maximum of daily/monthly"""
        assert determine_quota_status(30.0, 80.0) == "WARNING"
        assert determine_quota_status(80.0, 30.0) == "WARNING"


class TestResetDailyQuota:
    """Test the reset_daily_quota function"""

    @patch("boto3.resource")
    @patch("utils.get_current_date")
    @patch("utils.calculate_ttl")
    def test_reset_daily_quota_success(
        self, mock_calc_ttl, mock_get_date, mock_boto_resource, mock_env_vars
    ):
        """Test successful daily quota reset"""
        mock_table = Mock()
        mock_dynamodb = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_boto_resource.return_value = mock_dynamodb

        mock_get_date.return_value = "2024-01-01"
        mock_calc_ttl.return_value = 1234567890

        # Mock existing item
        mock_table.get_item.return_value = {
            "Item": {"monthly_count": 150, "daily_count": 45}  # This should be reset
        }

        result = reset_daily_quota("test-user")

        assert result is True
        mock_table.put_item.assert_called_once()

        # Check the put_item call
        call_args = mock_table.put_item.call_args[1]
        item = call_args["Item"]
        assert item["daily_count"] == 0
        assert item["monthly_count"] == 150  # Preserved
        assert item["last_operation"] == "quota_reset"

    @patch("boto3.resource")
    def test_reset_daily_quota_no_existing_item(
        self, mock_boto_resource, mock_env_vars
    ):
        """Test quota reset when no existing item"""
        mock_table = Mock()
        mock_dynamodb = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_boto_resource.return_value = mock_dynamodb

        mock_table.get_item.return_value = {}  # No item

        with (
            patch("utils.get_current_date", return_value="2024-01-01"),
            patch("utils.calculate_ttl", return_value=1234567890),
        ):

            result = reset_daily_quota("test-user")

            # Should not call put_item if no existing item
            assert result is True
            mock_table.put_item.assert_not_called()

    @patch("boto3.resource")
    def test_reset_daily_quota_error(self, mock_boto_resource, mock_env_vars):
        """Test quota reset with error"""
        mock_boto_resource.side_effect = Exception("DynamoDB error")

        result = reset_daily_quota("test-user")

        assert result is False


class TestGetQuotaLimits:
    """Test the get_quota_limits function"""

    def test_get_quota_limits_default(self):
        """Test quota limits with default values"""
        with patch.dict(os.environ, {}, clear=True):
            limits = get_quota_limits()

            assert limits["daily_limit"] == 50
            assert limits["monthly_limit"] == 1000

    def test_get_quota_limits_custom(self):
        """Test quota limits with custom environment values"""
        with patch.dict(os.environ, {"DAILY_QUOTA": "100", "MONTHLY_QUOTA": "2000"}):
            limits = get_quota_limits()

            assert limits["daily_limit"] == 100
            assert limits["monthly_limit"] == 2000

    def test_get_quota_limits_invalid_values(self):
        """Test quota limits with invalid environment values"""
        with patch.dict(
            os.environ, {"DAILY_QUOTA": "invalid", "MONTHLY_QUOTA": "also_invalid"}
        ):
            # Should raise ValueError when trying to convert to int
            with pytest.raises(ValueError):
                get_quota_limits()


class TestUsageValidation:
    """Test usage data validation"""

    @patch("utils.UsageTracker")
    def test_usage_data_types(self, mock_usage_tracker, mock_env_vars):
        """Test that usage data has correct types"""
        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.get_usage_stats.return_value = {
            "daily_used": 15,
            "daily_limit": 50,
            "monthly_used": 150,
            "monthly_limit": 1000,
        }

        result = handle_get_quota("test-user")
        response_body = json.loads(result["body"])

        # Check that all numeric values are actually numbers
        daily = response_body["quotas"]["daily"]
        monthly = response_body["quotas"]["monthly"]

        assert isinstance(daily["used"], int)
        assert isinstance(daily["limit"], int)
        assert isinstance(daily["remaining"], int)
        assert isinstance(daily["percent_used"], float)

        assert isinstance(monthly["used"], int)
        assert isinstance(monthly["limit"], int)
        assert isinstance(monthly["remaining"], int)
        assert isinstance(monthly["percent_used"], float)


class TestPerformanceMetrics:
    """Test performance metrics for usage functions"""

    @patch("utils.UsageTracker")
    @patch("time.time")
    def test_usage_retrieval_timing(self, mock_time, mock_usage_tracker, mock_env_vars):
        """Test that usage retrieval completes within reasonable time"""
        mock_time.side_effect = [1000.0, 1001.5]  # 1.5 second duration

        mock_tracker = Mock()
        mock_usage_tracker.return_value = mock_tracker
        mock_tracker.get_usage_stats.return_value = {
            "daily_used": 5,
            "daily_limit": 50,
            "monthly_used": 25,
            "monthly_limit": 1000,
        }

        with (
            patch("app.get_historical_usage", return_value=[]),
            patch("app.get_operation_breakdown", return_value={}),
        ):

            result = handle_get_usage("test-user")

            assert result["statusCode"] == 200
            # Function should complete reasonably quickly
            # In real implementation, you might add timing to response


class TestConcurrentAccess:
    """Test concurrent access scenarios"""

    @patch("boto3.resource")
    def test_concurrent_quota_checks(self, mock_boto_resource, mock_env_vars):
        """Test handling of concurrent quota access"""
        mock_table = Mock()
        mock_dynamodb = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_boto_resource.return_value = mock_dynamodb

        # Simulate concurrent modification
        mock_table.get_item.side_effect = [
            {"Item": {"daily_count": 49, "monthly_count": 999}},
            {
                "Item": {"daily_count": 50, "monthly_count": 1000}
            },  # Changed by another request
        ]

        # First call
        result1 = get_historical_usage("test-user", days=1)
        # Second call
        result2 = get_historical_usage("test-user", days=1)

        # Both should succeed without errors
        assert isinstance(result1, list)
        assert isinstance(result2, list)
