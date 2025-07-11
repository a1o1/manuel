"""
Unit tests for Backup Lambda function
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
    0, os.path.join(os.path.dirname(__file__), "..", "..", "src", "functions", "backup")
)

from app import (
    check_dynamodb_backup_status,
    check_s3_backup_status,
    get_backup_metrics,
    get_backup_status,
    handle_backup_metrics,
    handle_backup_status,
    handle_backup_verify,
    handle_disaster_recovery,
    initiate_disaster_recovery,
    lambda_handler,
    verify_backup_integrity,
    verify_dynamodb_backup,
    verify_s3_backup,
)


class TestBackupLambdaHandler:
    """Test the main lambda handler function"""

    def test_lambda_handler_options_request(self, mock_context, mock_env_vars):
        """Test OPTIONS request handling"""
        event = {"httpMethod": "OPTIONS"}

        response = lambda_handler(event, mock_context)

        assert response["statusCode"] == 200
        assert "Access-Control-Allow-Origin" in response["headers"]

    def test_lambda_handler_backup_status(self, mock_context, mock_env_vars):
        """Test backup status endpoint"""
        event = {"httpMethod": "GET", "path": "/backup/status"}

        with patch("app.handle_backup_status") as mock_handle:
            mock_handle.return_value = {
                "statusCode": 200,
                "body": json.dumps({"status": "healthy"}),
            }

            response = lambda_handler(event, mock_context)

            assert response["statusCode"] == 200
            mock_handle.assert_called_once()

    def test_lambda_handler_backup_metrics(self, mock_context, mock_env_vars):
        """Test backup metrics endpoint"""
        event = {"httpMethod": "GET", "path": "/backup/metrics"}

        with patch("app.handle_backup_metrics") as mock_handle:
            mock_handle.return_value = {
                "statusCode": 200,
                "body": json.dumps({"metrics": {}}),
            }

            response = lambda_handler(event, mock_context)

            assert response["statusCode"] == 200

    def test_lambda_handler_backup_verify(self, mock_context, mock_env_vars):
        """Test backup verification endpoint"""
        event = {
            "httpMethod": "POST",
            "path": "/backup/verify",
            "body": json.dumps({"services": ["dynamodb", "s3"]}),
        }

        with patch("app.handle_backup_verify") as mock_handle:
            mock_handle.return_value = {
                "statusCode": 200,
                "body": json.dumps({"overall_status": "healthy"}),
            }

            response = lambda_handler(event, mock_context)

            assert response["statusCode"] == 200

    def test_lambda_handler_disaster_recovery(self, mock_context, mock_env_vars):
        """Test disaster recovery endpoint"""
        event = {
            "httpMethod": "POST",
            "path": "/backup/restore",
            "body": json.dumps({"type": "point_in_time", "services": ["dynamodb"]}),
        }

        with patch("app.handle_disaster_recovery") as mock_handle:
            mock_handle.return_value = {
                "statusCode": 202,
                "body": json.dumps({"status": "initiated"}),
            }

            response = lambda_handler(event, mock_context)

            assert response["statusCode"] == 202

    def test_lambda_handler_invalid_endpoint(self, mock_context, mock_env_vars):
        """Test invalid endpoint"""
        event = {"httpMethod": "GET", "path": "/backup/invalid"}

        response = lambda_handler(event, mock_context)

        assert response["statusCode"] == 404

    def test_lambda_handler_invalid_method(self, mock_context, mock_env_vars):
        """Test invalid HTTP method"""
        event = {"httpMethod": "PUT", "path": "/backup/status"}

        response = lambda_handler(event, mock_context)

        assert response["statusCode"] == 405

    def test_lambda_handler_exception(self, mock_context, mock_env_vars):
        """Test exception handling"""
        event = {"httpMethod": "GET", "path": "/backup/status"}

        with patch("app.handle_backup_status", side_effect=Exception("Test error")):
            response = lambda_handler(event, mock_context)

            assert response["statusCode"] == 500
            response_body = json.loads(response["body"])
            assert "error" in response_body


class TestGetBackupStatus:
    """Test the get_backup_status function"""

    @patch("app.check_dynamodb_backup_status")
    @patch("app.check_s3_backup_status")
    @patch("app.check_opensearch_backup_status")
    def test_get_backup_status_all_healthy(
        self, mock_opensearch, mock_s3, mock_dynamodb
    ):
        """Test backup status when all services are healthy"""
        mock_dynamodb.return_value = {"status": "healthy"}
        mock_s3.return_value = {"status": "healthy"}
        mock_opensearch.return_value = {"status": "healthy"}

        result = get_backup_status()

        assert result["overall_status"] == "healthy"
        assert "timestamp" in result
        assert len(result["services"]) == 3
        assert "unhealthy_services" not in result

    @patch("app.check_dynamodb_backup_status")
    @patch("app.check_s3_backup_status")
    @patch("app.check_opensearch_backup_status")
    def test_get_backup_status_some_unhealthy(
        self, mock_opensearch, mock_s3, mock_dynamodb
    ):
        """Test backup status when some services are unhealthy"""
        mock_dynamodb.return_value = {"status": "unhealthy"}
        mock_s3.return_value = {"status": "healthy"}
        mock_opensearch.return_value = {"status": "degraded"}

        result = get_backup_status()

        assert result["overall_status"] == "degraded"
        assert "unhealthy_services" in result
        assert "dynamodb" in result["unhealthy_services"]
        assert "opensearch" in result["unhealthy_services"]
        assert "s3" not in result["unhealthy_services"]


class TestCheckDynamoDBBackupStatus:
    """Test DynamoDB backup status checking"""

    @patch("boto3.client")
    def test_check_dynamodb_backup_status_success(
        self, mock_boto_client, mock_env_vars
    ):
        """Test successful DynamoDB backup status check"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        # Mock PITR response
        mock_client.describe_continuous_backups.return_value = {
            "ContinuousBackupsDescription": {
                "PointInTimeRecoveryDescription": {
                    "PointInTimeRecoveryStatus": "ENABLED",
                    "EarliestRestorableDateTime": datetime.utcnow()
                    - timedelta(days=30),
                    "LatestRestorableDateTime": datetime.utcnow(),
                }
            }
        }

        # Mock backups response
        mock_client.list_backups.return_value = {
            "BackupSummaries": [
                {"BackupCreationDateTime": datetime.utcnow() - timedelta(hours=12)},
                {"BackupCreationDateTime": datetime.utcnow() - timedelta(days=1)},
            ]
        }

        result = check_dynamodb_backup_status()

        assert result["status"] == "healthy"
        assert result["point_in_time_recovery"]["enabled"] is True
        assert result["recent_backups"] == 2
        assert "last_backup_time" in result

    @patch("boto3.client")
    def test_check_dynamodb_backup_status_pitr_disabled(
        self, mock_boto_client, mock_env_vars
    ):
        """Test DynamoDB backup status with PITR disabled"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        mock_client.describe_continuous_backups.return_value = {
            "ContinuousBackupsDescription": {
                "PointInTimeRecoveryDescription": {
                    "PointInTimeRecoveryStatus": "DISABLED"
                }
            }
        }

        mock_client.list_backups.return_value = {"BackupSummaries": []}

        result = check_dynamodb_backup_status()

        assert result["status"] == "unhealthy"
        assert result["point_in_time_recovery"]["enabled"] is False

    @patch("boto3.client")
    def test_check_dynamodb_backup_status_no_table(
        self, mock_boto_client, mock_env_vars
    ):
        """Test DynamoDB backup status with no table configured"""
        with patch.dict(os.environ, {"USAGE_TABLE_NAME": ""}):
            result = check_dynamodb_backup_status()

            assert result["status"] == "unknown"
            assert "error" in result

    @patch("boto3.client")
    def test_check_dynamodb_backup_status_error(self, mock_boto_client, mock_env_vars):
        """Test DynamoDB backup status with error"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        mock_client.describe_continuous_backups.side_effect = ClientError(
            error_response={"Error": {"Code": "ResourceNotFoundException"}},
            operation_name="DescribeContinuousBackups",
        )

        result = check_dynamodb_backup_status()

        assert result["status"] == "error"
        assert "error" in result


class TestCheckS3BackupStatus:
    """Test S3 backup status checking"""

    @patch("boto3.client")
    def test_check_s3_backup_status_success(self, mock_boto_client, mock_env_vars):
        """Test successful S3 backup status check"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        # Mock versioning response
        mock_client.get_bucket_versioning.return_value = {"Status": "Enabled"}

        # Mock replication response
        mock_client.get_bucket_replication.return_value = {
            "ReplicationConfiguration": {"Rules": [{"Status": "Enabled"}]}
        }

        # Mock backup bucket check
        mock_client.head_bucket.return_value = {}

        result = check_s3_backup_status()

        assert result["status"] == "healthy"
        assert result["primary_bucket"]["versioning"] == "Enabled"
        assert result["primary_bucket"]["replication"] == "enabled"
        assert result["backup_bucket"]["accessible"] is True

    @patch("boto3.client")
    def test_check_s3_backup_status_no_replication(
        self, mock_boto_client, mock_env_vars
    ):
        """Test S3 backup status with no replication"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        mock_client.get_bucket_versioning.return_value = {"Status": "Enabled"}
        mock_client.get_bucket_replication.side_effect = ClientError(
            error_response={"Error": {"Code": "ReplicationConfigurationNotFoundError"}},
            operation_name="GetBucketReplication",
        )

        result = check_s3_backup_status()

        assert result["primary_bucket"]["replication"] == "disabled"

    @patch("boto3.client")
    def test_check_s3_backup_status_no_bucket(self, mock_boto_client, mock_env_vars):
        """Test S3 backup status with no bucket configured"""
        with patch.dict(os.environ, {"MANUALS_BUCKET": ""}):
            result = check_s3_backup_status()

            assert result["status"] == "unknown"
            assert "error" in result


class TestVerifyBackupIntegrity:
    """Test backup integrity verification"""

    @patch("app.verify_dynamodb_backup")
    @patch("app.verify_s3_backup")
    def test_verify_backup_integrity_success(
        self, mock_s3_verify, mock_dynamodb_verify
    ):
        """Test successful backup integrity verification"""
        mock_dynamodb_verify.return_value = {"status": "passed"}
        mock_s3_verify.return_value = {"status": "passed"}

        with patch("app.get_logger") as mock_logger:
            mock_logger.return_value = Mock()

            result = verify_backup_integrity(
                ["dynamodb", "s3"], mock_logger.return_value
            )

            assert result["overall_status"] == "healthy"
            assert len(result["services"]) == 2
            assert "failed_services" not in result

    @patch("app.verify_dynamodb_backup")
    @patch("app.verify_s3_backup")
    def test_verify_backup_integrity_failures(
        self, mock_s3_verify, mock_dynamodb_verify
    ):
        """Test backup integrity verification with failures"""
        mock_dynamodb_verify.return_value = {"status": "failed"}
        mock_s3_verify.return_value = {"status": "passed"}

        with patch("app.get_logger") as mock_logger:
            mock_logger.return_value = Mock()

            result = verify_backup_integrity(
                ["dynamodb", "s3"], mock_logger.return_value
            )

            assert result["overall_status"] == "failed"
            assert "failed_services" in result
            assert "dynamodb" in result["failed_services"]

    def test_verify_backup_integrity_unsupported_service(self):
        """Test backup integrity verification with unsupported service"""
        with patch("app.get_logger") as mock_logger:
            mock_logger.return_value = Mock()

            result = verify_backup_integrity(["unsupported"], mock_logger.return_value)

            assert result["services"]["unsupported"]["status"] == "skipped"


class TestVerifyDynamoDBBackup:
    """Test DynamoDB backup verification"""

    @patch("boto3.client")
    def test_verify_dynamodb_backup_success(self, mock_boto_client, mock_env_vars):
        """Test successful DynamoDB backup verification"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        mock_client.describe_table.return_value = {"Table": {"TableStatus": "ACTIVE"}}
        mock_client.list_backups.return_value = {
            "BackupSummaries": [{"BackupArn": "arn:aws:dynamodb:..."}]
        }

        with patch("app.get_logger") as mock_logger:
            result = verify_dynamodb_backup(mock_logger.return_value)

            assert result["status"] == "passed"
            assert result["table_status"] == "ACTIVE"
            assert result["backup_count"] == 1

    @patch("boto3.client")
    def test_verify_dynamodb_backup_no_table(self, mock_boto_client, mock_env_vars):
        """Test DynamoDB backup verification with no table"""
        with patch.dict(os.environ, {"USAGE_TABLE_NAME": ""}):
            with patch("app.get_logger") as mock_logger:
                result = verify_dynamodb_backup(mock_logger.return_value)

                assert result["status"] == "failed"
                assert "Table name not configured" in result["error"]

    @patch("boto3.client")
    def test_verify_dynamodb_backup_error(self, mock_boto_client, mock_env_vars):
        """Test DynamoDB backup verification with error"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client
        mock_client.describe_table.side_effect = ClientError(
            error_response={"Error": {"Code": "ResourceNotFoundException"}},
            operation_name="DescribeTable",
        )

        with patch("app.get_logger") as mock_logger:
            result = verify_dynamodb_backup(mock_logger.return_value)

            assert result["status"] == "failed"
            assert "error" in result


class TestVerifyS3Backup:
    """Test S3 backup verification"""

    @patch("boto3.client")
    def test_verify_s3_backup_success(self, mock_boto_client, mock_env_vars):
        """Test successful S3 backup verification"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        mock_client.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "file1.pdf"},
                {"Key": "file2.pdf"},
                {"Key": "file3.pdf"},
            ]
        }
        mock_client.head_object.return_value = {}  # Successful head_object calls

        with patch("app.get_logger") as mock_logger:
            result = verify_s3_backup(mock_logger.return_value)

            assert result["status"] == "passed"
            assert result["total_objects"] == 3
            assert result["verified_objects"] == 3

    @patch("boto3.client")
    def test_verify_s3_backup_partial_success(self, mock_boto_client, mock_env_vars):
        """Test S3 backup verification with partial success"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        mock_client.list_objects_v2.return_value = {
            "Contents": [{"Key": "file1.pdf"}, {"Key": "file2.pdf"}]
        }

        # First head_object succeeds, second fails
        mock_client.head_object.side_effect = [
            {},  # Success
            ClientError(
                error_response={"Error": {"Code": "NoSuchKey"}},
                operation_name="HeadObject",
            ),
        ]

        with patch("app.get_logger") as mock_logger:
            result = verify_s3_backup(mock_logger.return_value)

            assert result["status"] == "degraded"
            assert result["verified_objects"] == 1

    @patch("boto3.client")
    def test_verify_s3_backup_no_bucket(self, mock_boto_client, mock_env_vars):
        """Test S3 backup verification with no bucket"""
        with patch.dict(os.environ, {"MANUALS_BUCKET": ""}):
            with patch("app.get_logger") as mock_logger:
                result = verify_s3_backup(mock_logger.return_value)

                assert result["status"] == "failed"
                assert "Primary bucket name not configured" in result["error"]


class TestInitiateDisasterRecovery:
    """Test disaster recovery initiation"""

    @patch("app.initiate_dynamodb_recovery")
    def test_initiate_disaster_recovery_success(self, mock_dynamodb_recovery):
        """Test successful disaster recovery initiation"""
        mock_dynamodb_recovery.return_value = {
            "status": "simulated",
            "recovery_table": "test-table-recovery-123",
        }

        with patch("app.get_logger") as mock_logger:
            result = initiate_disaster_recovery(
                "point_in_time",
                "2024-01-01T12:00:00Z",
                ["dynamodb"],
                mock_logger.return_value,
            )

            assert result["status"] == "initiated"
            assert result["recovery_type"] == "point_in_time"
            assert "recovery_id" in result
            assert "dynamodb" in result["services"]

    def test_initiate_disaster_recovery_unsupported_service(self):
        """Test disaster recovery with unsupported service"""
        with patch("app.get_logger") as mock_logger:
            result = initiate_disaster_recovery(
                "point_in_time", None, ["unsupported"], mock_logger.return_value
            )

            assert result["services"]["unsupported"]["status"] == "skipped"


class TestGetBackupMetrics:
    """Test backup metrics retrieval"""

    def test_get_backup_metrics_success(self, mock_env_vars):
        """Test successful backup metrics retrieval"""
        result = get_backup_metrics()

        assert "timestamp" in result
        assert "retention_policies" in result
        assert "backup_costs" in result
        assert "recovery_estimates" in result

        # Check specific content
        assert "dynamodb_pitr" in result["retention_policies"]
        assert "s3_versioning" in result["retention_policies"]


class TestBackupErrorHandling:
    """Test error handling scenarios"""

    def test_handle_backup_status_exception(self):
        """Test backup status handling with exception"""
        with (
            patch("app.get_backup_status", side_effect=Exception("Service error")),
            patch("app.get_logger") as mock_logger,
        ):

            result = handle_backup_status(mock_logger.return_value)

            assert result["statusCode"] == 500
            response_body = json.loads(result["body"])
            assert "error" in response_body

    def test_handle_backup_verify_invalid_body(self):
        """Test backup verification with invalid request body"""
        event = {"body": "invalid json {"}

        with patch("app.get_logger") as mock_logger:
            result = handle_backup_verify(event, mock_logger.return_value)

            assert result["statusCode"] == 500
            response_body = json.loads(result["body"])
            assert "error" in response_body

    def test_handle_disaster_recovery_invalid_body(self):
        """Test disaster recovery with invalid request body"""
        event = {"body": "invalid json {"}

        with patch("app.get_logger") as mock_logger:
            result = handle_disaster_recovery(event, mock_logger.return_value)

            assert result["statusCode"] == 500
            response_body = json.loads(result["body"])
            assert "error" in response_body


class TestBackupStatusHealthChecks:
    """Test comprehensive health check scenarios"""

    @patch("app.check_dynamodb_backup_status")
    @patch("app.check_s3_backup_status")
    @patch("app.check_opensearch_backup_status")
    def test_backup_health_check_comprehensive(
        self, mock_opensearch, mock_s3, mock_dynamodb
    ):
        """Test comprehensive backup health check"""
        # Setup realistic backup status
        mock_dynamodb.return_value = {
            "status": "healthy",
            "point_in_time_recovery": {"enabled": True},
            "recent_backups": 5,
        }

        mock_s3.return_value = {
            "status": "healthy",
            "primary_bucket": {"versioning": "Enabled", "replication": "enabled"},
        }

        mock_opensearch.return_value = {"status": "not_implemented"}

        result = get_backup_status()

        assert (
            result["overall_status"] == "degraded"
        )  # Due to opensearch not implemented
        assert "services" in result
        assert len(result["services"]) == 3
