"""
Structured logging utility for Manuel backend functions
"""

import json
import time
from datetime import datetime
from typing import Any, Dict, Optional

import boto3


class ManuelLogger:
    """Structured logger for Manuel application"""

    def __init__(self, function_name: str, request_id: str = None):
        self.function_name = function_name
        self.request_id = request_id or "unknown"
        self.cloudwatch = boto3.client("cloudwatch")

    def _log(self, level: str, message: str, **kwargs) -> None:
        """Internal logging method with structured format"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "function": self.function_name,
            "request_id": self.request_id,
            "message": message,
            **kwargs,
        }
        print(json.dumps(log_entry))

    def info(self, message: str, **kwargs) -> None:
        """Log info level message"""
        self._log("INFO", message, **kwargs)

    def warning(self, message: str, **kwargs) -> None:
        """Log warning level message"""
        self._log("WARNING", message, **kwargs)

    def error(self, message: str, **kwargs) -> None:
        """Log error level message"""
        self._log("ERROR", message, **kwargs)

    def debug(self, message: str, **kwargs) -> None:
        """Log debug level message"""
        self._log("DEBUG", message, **kwargs)

    def metric(
        self, metric_name: str, value: float, unit: str = "Count", **dimensions
    ) -> None:
        """Log custom CloudWatch metric"""
        try:
            metric_data = {
                "MetricName": metric_name,
                "Value": value,
                "Unit": unit,
                "Timestamp": datetime.utcnow(),
            }

            if dimensions:
                metric_data["Dimensions"] = [
                    {"Name": key, "Value": str(value)}
                    for key, value in dimensions.items()
                ]

            self.cloudwatch.put_metric_data(
                Namespace="Manuel/Application", MetricData=[metric_data]
            )

            # Also log the metric
            self.info(
                "Custom metric emitted",
                metric_name=metric_name,
                value=value,
                unit=unit,
                **dimensions,
            )

        except Exception as e:
            self.error(
                "Failed to emit custom metric", metric_name=metric_name, error=str(e)
            )

    def log_request_start(self, event: Dict[str, Any]) -> None:
        """Log the start of a request"""
        self.info(
            "Request started",
            http_method=event.get("httpMethod"),
            path=event.get("path"),
            user_agent=event.get("headers", {}).get("User-Agent"),
            source_ip=event.get("requestContext", {})
            .get("identity", {})
            .get("sourceIp"),
        )

    def log_request_end(self, status_code: int, duration_ms: float, **kwargs) -> None:
        """Log the end of a request"""
        self.info(
            "Request completed",
            status_code=status_code,
            duration_ms=duration_ms,
            **kwargs,
        )

        # Emit custom metrics
        self.metric(
            "RequestDuration", duration_ms, "Milliseconds", Function=self.function_name
        )
        self.metric(
            "RequestCount",
            1,
            "Count",
            Function=self.function_name,
            StatusCode=str(status_code),
        )

    def log_quota_check(
        self,
        user_id: str,
        operation: str,
        can_proceed: bool,
        usage_info: Dict[str, Any],
    ) -> None:
        """Log quota check results"""
        self.info(
            "Quota check performed",
            user_id=user_id,
            operation=operation,
            can_proceed=can_proceed,
            daily_used=usage_info.get("daily_used"),
            daily_limit=usage_info.get("daily_limit"),
            monthly_used=usage_info.get("monthly_used"),
            monthly_limit=usage_info.get("monthly_limit"),
        )

        # Emit quota usage metrics
        if "daily_used" in usage_info and "daily_limit" in usage_info:
            quota_percentage = (
                usage_info["daily_used"] / usage_info["daily_limit"]
            ) * 100
            self.metric(
                "QuotaUsagePercentage",
                quota_percentage,
                "Percent",
                QuotaType="Daily",
                Operation=operation,
            )

        if not can_proceed:
            self.metric(
                "QuotaExceeded", 1, "Count", Operation=operation, QuotaType="Daily"
            )

    def log_bedrock_call(
        self,
        model_id: str,
        operation: str,
        duration_ms: float,
        tokens_used: Optional[int] = None,
        success: bool = True,
    ) -> None:
        """Log Bedrock API calls"""
        log_data = {
            "model_id": model_id,
            "operation": operation,
            "duration_ms": duration_ms,
            "success": success,
        }

        if tokens_used:
            log_data["tokens_used"] = tokens_used

        if success:
            self.info("Bedrock call completed", **log_data)
        else:
            self.error("Bedrock call failed", **log_data)

        # Emit metrics
        self.metric(
            "BedrockCallDuration",
            duration_ms,
            "Milliseconds",
            Model=model_id,
            Operation=operation,
        )
        self.metric(
            "BedrockCallCount",
            1,
            "Count",
            Model=model_id,
            Operation=operation,
            Status="Success" if success else "Failure",
        )

        if tokens_used:
            self.metric(
                "BedrockTokens",
                tokens_used,
                "Count",
                Model=model_id,
                Operation=operation,
            )

    def log_transcription(
        self,
        audio_size_bytes: int,
        transcription_length: int,
        duration_ms: float,
        success: bool = True,
    ) -> None:
        """Log transcription operation"""
        log_data = {
            "audio_size_bytes": audio_size_bytes,
            "transcription_length": transcription_length,
            "duration_ms": duration_ms,
            "success": success,
        }

        if success:
            self.info("Transcription completed", **log_data)
        else:
            self.error("Transcription failed", **log_data)

        # Emit metrics
        self.metric("TranscriptionDuration", duration_ms, "Milliseconds")
        self.metric(
            "TranscriptionCount", 1, "Count", Status="Success" if success else "Failure"
        )
        self.metric("AudioSizeBytes", audio_size_bytes, "Bytes")
        self.metric("TranscriptionLength", transcription_length, "Count")

    def log_knowledge_base_query(
        self, query: str, results_count: int, duration_ms: float, success: bool = True
    ) -> None:
        """Log knowledge base query"""
        log_data = {
            "query_length": len(query),
            "results_count": results_count,
            "duration_ms": duration_ms,
            "success": success,
        }

        if success:
            self.info("Knowledge base query completed", **log_data)
        else:
            self.error("Knowledge base query failed", **log_data)

        # Emit metrics
        self.metric("KnowledgeBaseQueryDuration", duration_ms, "Milliseconds")
        self.metric(
            "KnowledgeBaseQueryCount",
            1,
            "Count",
            Status="Success" if success else "Failure",
        )
        self.metric("KnowledgeBaseResults", results_count, "Count")


def get_logger(function_name: str, context=None) -> ManuelLogger:
    """Factory function to create a logger instance"""
    request_id = context.aws_request_id if context else None
    return ManuelLogger(function_name, request_id)


class LoggingContext:
    """Context manager for logging request duration"""

    def __init__(self, logger: ManuelLogger, operation: str):
        self.logger = logger
        self.operation = operation
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        self.logger.debug(f"{self.operation} started")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.time() - self.start_time) * 1000

        if exc_type is None:
            self.logger.debug(f"{self.operation} completed", duration_ms=duration_ms)
        else:
            self.logger.error(
                f"{self.operation} failed",
                duration_ms=duration_ms,
                error_type=exc_type.__name__,
                error_message=str(exc_val),
            )

        # Emit duration metric
        self.logger.metric(f"{self.operation}Duration", duration_ms, "Milliseconds")
