"""
Performance Metrics and Monitoring
Provides comprehensive performance tracking for Lambda functions
"""

import os
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

import boto3

from logger import get_logger


class PerformanceMetrics:
    """Comprehensive performance metrics collection and reporting."""
    
    def __init__(self, function_name: str):
        self.function_name = function_name
        self.logger = get_logger(f"metrics-{function_name}")
        self.cloudwatch = boto3.client("cloudwatch")
        self.metrics_buffer = []
        self.start_times = {}
        self.counters = {}
        
        # Configuration
        self.namespace = f"Manuel/{function_name.title()}"
        self.buffer_size = int(os.environ.get("METRICS_BUFFER_SIZE", "20"))
        self.auto_flush = os.environ.get("AUTO_FLUSH_METRICS", "true").lower() == "true"
    
    def start_timer(self, operation: str) -> str:
        """Start timing an operation."""
        timer_id = f"{operation}_{int(time.time() * 1000)}"
        self.start_times[timer_id] = time.time()
        return timer_id
    
    def end_timer(self, timer_id: str, operation: str, **dimensions):
        """End timing an operation and record the duration."""
        if timer_id in self.start_times:
            duration = (time.time() - self.start_times[timer_id]) * 1000  # Convert to milliseconds
            del self.start_times[timer_id]
            
            self.record_metric(
                metric_name=f"{operation}Duration",
                value=duration,
                unit="Milliseconds",
                dimensions=dimensions
            )
            
            return duration
        return None
    
    @contextmanager
    def timer(self, operation: str, **dimensions):
        """Context manager for timing operations."""
        timer_id = self.start_timer(operation)
        try:
            yield
        finally:
            self.end_timer(timer_id, operation, **dimensions)
    
    def increment_counter(self, counter_name: str, increment: int = 1, **dimensions):
        """Increment a counter metric."""
        self.record_metric(
            metric_name=counter_name,
            value=increment,
            unit="Count",
            dimensions=dimensions
        )
    
    def record_metric(
        self, 
        metric_name: str, 
        value: float, 
        unit: str = "None", 
        dimensions: Optional[Dict[str, str]] = None
    ):
        """Record a custom metric."""
        if dimensions is None:
            dimensions = {}
        
        # Add default dimensions
        default_dimensions = {
            "Function": self.function_name,
            "Stage": os.environ.get("STAGE", "dev"),
            "Region": os.environ.get("AWS_REGION", "unknown")
        }
        
        all_dimensions = {**default_dimensions, **dimensions}
        
        metric_data = {
            "MetricName": metric_name,
            "Value": value,
            "Unit": unit,
            "Timestamp": datetime.utcnow(),
            "Dimensions": [
                {"Name": key, "Value": str(value)} 
                for key, value in all_dimensions.items()
            ]
        }
        
        self.metrics_buffer.append(metric_data)
        
        # Auto-flush if buffer is full
        if len(self.metrics_buffer) >= self.buffer_size and self.auto_flush:
            self.flush_metrics()
    
    def record_business_metric(
        self, 
        metric_name: str, 
        value: float, 
        operation_type: str = "unknown",
        user_type: str = "user"
    ):
        """Record business-specific metrics."""
        self.record_metric(
            metric_name=metric_name,
            value=value,
            unit="Count",
            dimensions={
                "OperationType": operation_type,
                "UserType": user_type
            }
        )
    
    def record_cost_metric(self, operation: str, cost: float, currency: str = "USD"):
        """Record cost-related metrics."""
        self.record_metric(
            metric_name="OperationCost",
            value=cost,
            unit="None",  # Custom unit for cost
            dimensions={
                "Operation": operation,
                "Currency": currency
            }
        )
    
    def record_performance_score(self, score: float, category: str = "overall"):
        """Record performance score (0-100)."""
        self.record_metric(
            metric_name="PerformanceScore",
            value=score,
            unit="Percent",
            dimensions={
                "Category": category
            }
        )
    
    def record_cache_metrics(self, operation: str, cache_hit: bool, response_time_ms: float):
        """Record cache performance metrics."""
        self.record_metric(
            metric_name="CacheHit" if cache_hit else "CacheMiss",
            value=1,
            unit="Count",
            dimensions={
                "Operation": operation,
                "CacheType": "redis" if cache_hit else "dynamodb"
            }
        )
        
        self.record_metric(
            metric_name="CacheResponseTime",
            value=response_time_ms,
            unit="Milliseconds",
            dimensions={
                "Operation": operation,
                "CacheResult": "hit" if cache_hit else "miss"
            }
        )
    
    def record_quota_metrics(self, user_id: str, daily_usage: int, monthly_usage: int, daily_limit: int, monthly_limit: int):
        """Record quota usage metrics."""
        daily_percentage = (daily_usage / daily_limit) * 100 if daily_limit > 0 else 0
        monthly_percentage = (monthly_usage / monthly_limit) * 100 if monthly_limit > 0 else 0
        
        self.record_metric(
            metric_name="QuotaUsageDaily",
            value=daily_percentage,
            unit="Percent",
            dimensions={
                "UserType": "regular" if daily_limit <= 50 else "premium"
            }
        )
        
        self.record_metric(
            metric_name="QuotaUsageMonthly", 
            value=monthly_percentage,
            unit="Percent",
            dimensions={
                "UserType": "regular" if monthly_limit <= 1000 else "premium"
            }
        )
    
    def record_bedrock_metrics(
        self, 
        model_id: str, 
        input_tokens: int, 
        output_tokens: int, 
        response_time_ms: float,
        operation_type: str = "generation"
    ):
        """Record Bedrock-specific metrics."""
        self.record_metric(
            metric_name="BedrockInputTokens",
            value=input_tokens,
            unit="Count",
            dimensions={
                "ModelId": model_id,
                "OperationType": operation_type
            }
        )
        
        self.record_metric(
            metric_name="BedrockOutputTokens",
            value=output_tokens,
            unit="Count",
            dimensions={
                "ModelId": model_id,
                "OperationType": operation_type
            }
        )
        
        self.record_metric(
            metric_name="BedrockResponseTime",
            value=response_time_ms,
            unit="Milliseconds",
            dimensions={
                "ModelId": model_id,
                "OperationType": operation_type
            }
        )
        
        # Calculate tokens per second
        if response_time_ms > 0:
            tokens_per_second = (output_tokens / response_time_ms) * 1000
            self.record_metric(
                metric_name="BedrockTokensPerSecond",
                value=tokens_per_second,
                unit="Count/Second",
                dimensions={
                    "ModelId": model_id,
                    "OperationType": operation_type
                }
            )
    
    def record_error_metrics(
        self, 
        error_type: str, 
        error_code: str = "unknown",
        severity: str = "error"
    ):
        """Record error metrics."""
        self.record_metric(
            metric_name="ErrorCount",
            value=1,
            unit="Count",
            dimensions={
                "ErrorType": error_type,
                "ErrorCode": error_code,
                "Severity": severity
            }
        )
    
    def flush_metrics(self):
        """Flush all buffered metrics to CloudWatch."""
        if not self.metrics_buffer:
            return
        
        try:
            # Split into batches of 20 (CloudWatch limit)
            batch_size = 20
            for i in range(0, len(self.metrics_buffer), batch_size):
                batch = self.metrics_buffer[i:i + batch_size]
                
                self.cloudwatch.put_metric_data(
                    Namespace=self.namespace,
                    MetricData=batch
                )
            
            self.logger.info(f"Flushed {len(self.metrics_buffer)} metrics to CloudWatch")
            self.metrics_buffer.clear()
            
        except Exception as e:
            self.logger.error(f"Failed to flush metrics: {str(e)}")
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get a summary of current performance metrics."""
        return {
            "function_name": self.function_name,
            "buffered_metrics": len(self.metrics_buffer),
            "active_timers": len(self.start_times),
            "namespace": self.namespace,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def create_dashboard_data(self) -> Dict[str, Any]:
        """Create data structure for CloudWatch dashboard."""
        return {
            "widgets": [
                {
                    "type": "metric",
                    "properties": {
                        "metrics": [
                            [self.namespace, "RequestDuration", "Function", self.function_name],
                            [self.namespace, "ColdStartDuration", "Function", self.function_name],
                            [self.namespace, "BedrockResponseTime", "Function", self.function_name]
                        ],
                        "period": 300,
                        "stat": "Average",
                        "region": os.environ.get("AWS_REGION", "us-east-1"),
                        "title": f"{self.function_name} - Response Times"
                    }
                },
                {
                    "type": "metric",
                    "properties": {
                        "metrics": [
                            [self.namespace, "RequestCount", "Function", self.function_name],
                            [self.namespace, "ErrorCount", "Function", self.function_name],
                            [self.namespace, "CacheHit", "Function", self.function_name],
                            [self.namespace, "CacheMiss", "Function", self.function_name]
                        ],
                        "period": 300,
                        "stat": "Sum",
                        "region": os.environ.get("AWS_REGION", "us-east-1"),
                        "title": f"{self.function_name} - Request Metrics"
                    }
                },
                {
                    "type": "metric",
                    "properties": {
                        "metrics": [
                            [self.namespace, "QuotaUsageDaily", "Function", self.function_name],
                            [self.namespace, "QuotaUsageMonthly", "Function", self.function_name]
                        ],
                        "period": 300,
                        "stat": "Average",
                        "region": os.environ.get("AWS_REGION", "us-east-1"),
                        "title": f"{self.function_name} - Quota Usage"
                    }
                }
            ]
        }


class LambdaPerformanceTracker:
    """Lambda-specific performance tracking with cold start detection."""
    
    def __init__(self, function_name: str):
        self.function_name = function_name
        self.metrics = PerformanceMetrics(function_name)
        self.is_cold_start = True  # Assume cold start initially
        self.request_count = 0
    
    def start_request(self, event: Dict[str, Any], context: Any) -> str:
        """Start tracking a Lambda request."""
        self.request_count += 1
        request_id = context.aws_request_id if context else f"req_{int(time.time())}"
        
        # Record cold start if this is the first request
        if self.is_cold_start:
            self.metrics.record_metric(
                metric_name="ColdStart",
                value=1,
                unit="Count"
            )
            self.is_cold_start = False
        
        # Start request timer
        timer_id = self.metrics.start_timer("Request")
        
        # Record request start
        self.metrics.increment_counter("RequestCount")
        
        return timer_id
    
    def end_request(
        self, 
        timer_id: str, 
        success: bool = True, 
        error_type: Optional[str] = None,
        response_size: Optional[int] = None
    ):
        """End tracking a Lambda request."""
        # End request timer
        duration = self.metrics.end_timer(timer_id, "Request")
        
        if not success and error_type:
            self.metrics.record_error_metrics(error_type)
        
        if response_size:
            self.metrics.record_metric(
                metric_name="ResponseSize",
                value=response_size,
                unit="Bytes"
            )
        
        # Flush metrics if this is the end of the request
        self.metrics.flush_metrics()
    
    @contextmanager
    def track_request(self, event: Dict[str, Any], context: Any):
        """Context manager for tracking entire Lambda request."""
        timer_id = self.start_request(event, context)
        success = True
        error_type = None
        
        try:
            yield self.metrics
        except Exception as e:
            success = False
            error_type = type(e).__name__
            raise
        finally:
            self.end_request(timer_id, success, error_type)


def get_performance_metrics(function_name: str) -> PerformanceMetrics:
    """Factory function to get performance metrics instance."""
    return PerformanceMetrics(function_name)


def get_lambda_performance_tracker(function_name: str) -> LambdaPerformanceTracker:
    """Factory function to get Lambda performance tracker."""
    return LambdaPerformanceTracker(function_name)