"""
Health check and circuit breaker implementation for Manuel backend
Provides comprehensive service health monitoring and fault tolerance
"""

import json
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError


class HealthStatus(Enum):
    """Health status enumeration"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class CircuitState(Enum):
    """Circuit breaker state enumeration"""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, requests blocked
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class HealthCheckResult:
    """Individual health check result"""

    service: str
    status: HealthStatus
    response_time_ms: float
    details: str
    timestamp: str
    metadata: Dict[str, Any] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "service": self.service,
            "status": self.status.value,
            "response_time_ms": round(self.response_time_ms, 2),
            "details": self.details,
            "timestamp": self.timestamp,
            "metadata": self.metadata or {},
        }


@dataclass
class SystemHealthReport:
    """Overall system health report"""

    overall_status: HealthStatus
    timestamp: str
    checks: List[HealthCheckResult]
    summary: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_status": self.overall_status.value,
            "timestamp": self.timestamp,
            "summary": self.summary,
            "checks": [check.to_dict() for check in self.checks],
        }


class CircuitBreaker:
    """Circuit breaker pattern implementation for external service calls"""

    def __init__(
        self,
        service_name: str,
        failure_threshold: int = 5,
        timeout_seconds: int = 60,
        success_threshold: int = 2,
    ):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.success_threshold = success_threshold

        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
        self._lock = threading.Lock()

    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        with self._lock:
            if self.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                else:
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker open for {self.service_name}"
                    )

            try:
                result = func(*args, **kwargs)
                self._on_success()
                return result
            except Exception as e:
                self._on_failure()
                raise

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return True
        return time.time() - self.last_failure_time >= self.timeout_seconds

    def _on_success(self):
        """Handle successful call"""
        self.failure_count = 0

        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitState.CLOSED

    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

    def get_state(self) -> Dict[str, Any]:
        """Get current circuit breaker state"""
        return {
            "service": self.service_name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure_time": self.last_failure_time,
            "is_healthy": self.state == CircuitState.CLOSED,
        }


class CircuitBreakerOpenError(Exception):
    """Exception raised when circuit breaker is open"""

    pass


class ManuelHealthChecker:
    """Comprehensive health checker for Manuel backend services"""

    def __init__(self):
        self.circuit_breakers = {
            "bedrock": CircuitBreaker(
                "bedrock", failure_threshold=3, timeout_seconds=30
            ),
            "transcribe": CircuitBreaker(
                "transcribe", failure_threshold=3, timeout_seconds=30
            ),
            "dynamodb": CircuitBreaker(
                "dynamodb", failure_threshold=5, timeout_seconds=60
            ),
            "s3": CircuitBreaker("s3", failure_threshold=5, timeout_seconds=60),
            "knowledge_base": CircuitBreaker(
                "knowledge_base", failure_threshold=3, timeout_seconds=45
            ),
        }

    def perform_health_check(
        self, include_deep_checks: bool = True
    ) -> SystemHealthReport:
        """Perform comprehensive health check of all services"""
        checks = []
        start_time = datetime.utcnow()

        # Basic connectivity checks
        checks.append(self._check_dynamodb())
        checks.append(self._check_s3())

        if include_deep_checks:
            # Deep service checks (more expensive)
            checks.append(self._check_bedrock())
            checks.append(self._check_transcribe())
            checks.append(self._check_knowledge_base())

        # Calculate overall status
        overall_status = self._calculate_overall_status(checks)

        # Generate summary
        summary = self._generate_summary(checks)

        return SystemHealthReport(
            overall_status=overall_status,
            timestamp=start_time.isoformat(),
            checks=checks,
            summary=summary,
        )

    def _check_dynamodb(self) -> HealthCheckResult:
        """Check DynamoDB connectivity and performance"""
        start_time = time.time()

        try:

            def check_dynamo():
                import os

                dynamodb = boto3.resource("dynamodb")
                table_name = os.environ.get("USAGE_TABLE_NAME")
                if not table_name:
                    raise Exception("USAGE_TABLE_NAME not configured")

                table = dynamodb.Table(table_name)
                # Perform a lightweight operation
                response = table.scan(Limit=1, Select="COUNT")
                return response["Count"]

            result = self.circuit_breakers["dynamodb"].call(check_dynamo)
            response_time = (time.time() - start_time) * 1000

            if response_time > 1000:  # > 1 second
                status = HealthStatus.DEGRADED
                details = f"DynamoDB responding slowly ({response_time:.0f}ms)"
            else:
                status = HealthStatus.HEALTHY
                details = f"DynamoDB operational ({response_time:.0f}ms)"

            return HealthCheckResult(
                service="dynamodb",
                status=status,
                response_time_ms=response_time,
                details=details,
                timestamp=datetime.utcnow().isoformat(),
                metadata={"record_count_sample": result},
            )

        except CircuitBreakerOpenError as e:
            return HealthCheckResult(
                service="dynamodb",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"Circuit breaker open: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )
        except Exception as e:
            return HealthCheckResult(
                service="dynamodb",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"DynamoDB check failed: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )

    def _check_s3(self) -> HealthCheckResult:
        """Check S3 connectivity and performance"""
        start_time = time.time()

        try:

            def check_s3():
                import os

                s3_client = boto3.client("s3")

                # Check both buckets if they exist
                buckets_to_check = []
                if os.environ.get("MANUALS_BUCKET"):
                    buckets_to_check.append(os.environ["MANUALS_BUCKET"])
                if os.environ.get("AUDIO_BUCKET"):
                    buckets_to_check.append(os.environ["AUDIO_BUCKET"])

                if not buckets_to_check:
                    raise Exception("No S3 buckets configured")

                results = {}
                for bucket in buckets_to_check:
                    response = s3_client.head_bucket(Bucket=bucket)
                    results[bucket] = "accessible"

                return results

            result = self.circuit_breakers["s3"].call(check_s3)
            response_time = (time.time() - start_time) * 1000

            if response_time > 2000:  # > 2 seconds
                status = HealthStatus.DEGRADED
                details = f"S3 responding slowly ({response_time:.0f}ms)"
            else:
                status = HealthStatus.HEALTHY
                details = f"S3 operational ({response_time:.0f}ms)"

            return HealthCheckResult(
                service="s3",
                status=status,
                response_time_ms=response_time,
                details=details,
                timestamp=datetime.utcnow().isoformat(),
                metadata={"buckets_checked": list(result.keys())},
            )

        except CircuitBreakerOpenError as e:
            return HealthCheckResult(
                service="s3",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"Circuit breaker open: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )
        except Exception as e:
            return HealthCheckResult(
                service="s3",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"S3 check failed: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )

    def _check_bedrock(self) -> HealthCheckResult:
        """Check Bedrock connectivity and model availability"""
        start_time = time.time()

        try:

            def check_bedrock():
                import os

                bedrock_client = boto3.client("bedrock-runtime")
                model_id = os.environ.get(
                    "TEXT_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0"
                )

                # Minimal test request
                response = bedrock_client.invoke_model(
                    modelId=model_id,
                    body=json.dumps(
                        {
                            "anthropic_version": "bedrock-2023-05-31",
                            "max_tokens": 10,
                            "messages": [{"role": "user", "content": "Hi"}],
                            "temperature": 0.1,
                        }
                    ),
                )

                result = json.loads(response["body"].read())
                return {
                    "model_id": model_id,
                    "response_length": len(result["content"][0]["text"]),
                }

            result = self.circuit_breakers["bedrock"].call(check_bedrock)
            response_time = (time.time() - start_time) * 1000

            if response_time > 5000:  # > 5 seconds
                status = HealthStatus.DEGRADED
                details = f"Bedrock responding slowly ({response_time:.0f}ms)"
            else:
                status = HealthStatus.HEALTHY
                details = f"Bedrock operational ({response_time:.0f}ms)"

            return HealthCheckResult(
                service="bedrock",
                status=status,
                response_time_ms=response_time,
                details=details,
                timestamp=datetime.utcnow().isoformat(),
                metadata=result,
            )

        except CircuitBreakerOpenError as e:
            return HealthCheckResult(
                service="bedrock",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"Circuit breaker open: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )
        except Exception as e:
            return HealthCheckResult(
                service="bedrock",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"Bedrock check failed: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )

    def _check_transcribe(self) -> HealthCheckResult:
        """Check AWS Transcribe service availability"""
        start_time = time.time()

        try:

            def check_transcribe():
                transcribe_client = boto3.client("transcribe")

                # List transcription jobs to test connectivity
                response = transcribe_client.list_transcription_jobs(MaxResults=1)
                return {
                    "service_available": True,
                    "jobs_found": len(response.get("TranscriptionJobSummaries", [])),
                }

            result = self.circuit_breakers["transcribe"].call(check_transcribe)
            response_time = (time.time() - start_time) * 1000

            if response_time > 3000:  # > 3 seconds
                status = HealthStatus.DEGRADED
                details = f"Transcribe responding slowly ({response_time:.0f}ms)"
            else:
                status = HealthStatus.HEALTHY
                details = f"Transcribe operational ({response_time:.0f}ms)"

            return HealthCheckResult(
                service="transcribe",
                status=status,
                response_time_ms=response_time,
                details=details,
                timestamp=datetime.utcnow().isoformat(),
                metadata=result,
            )

        except CircuitBreakerOpenError as e:
            return HealthCheckResult(
                service="transcribe",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"Circuit breaker open: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )
        except Exception as e:
            return HealthCheckResult(
                service="transcribe",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"Transcribe check failed: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )

    def _check_knowledge_base(self) -> HealthCheckResult:
        """Check Bedrock Knowledge Base availability"""
        start_time = time.time()

        try:

            def check_kb():
                import os

                bedrock_agent_client = boto3.client("bedrock-agent-runtime")
                knowledge_base_id = os.environ.get("KNOWLEDGE_BASE_ID")

                if not knowledge_base_id:
                    raise Exception("KNOWLEDGE_BASE_ID not configured")

                # Test query to knowledge base
                response = bedrock_agent_client.retrieve(
                    knowledgeBaseId=knowledge_base_id,
                    retrievalQuery={"text": "test"},
                    retrievalConfiguration={
                        "vectorSearchConfiguration": {"numberOfResults": 1}
                    },
                )

                return {
                    "knowledge_base_id": knowledge_base_id,
                    "results_returned": len(response.get("retrievalResults", [])),
                }

            result = self.circuit_breakers["knowledge_base"].call(check_kb)
            response_time = (time.time() - start_time) * 1000

            if response_time > 3000:  # > 3 seconds
                status = HealthStatus.DEGRADED
                details = f"Knowledge Base responding slowly ({response_time:.0f}ms)"
            else:
                status = HealthStatus.HEALTHY
                details = f"Knowledge Base operational ({response_time:.0f}ms)"

            return HealthCheckResult(
                service="knowledge_base",
                status=status,
                response_time_ms=response_time,
                details=details,
                timestamp=datetime.utcnow().isoformat(),
                metadata=result,
            )

        except CircuitBreakerOpenError as e:
            return HealthCheckResult(
                service="knowledge_base",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"Circuit breaker open: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )
        except Exception as e:
            return HealthCheckResult(
                service="knowledge_base",
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                details=f"Knowledge Base check failed: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
            )

    def _calculate_overall_status(
        self, checks: List[HealthCheckResult]
    ) -> HealthStatus:
        """Calculate overall system health from individual checks"""
        if not checks:
            return HealthStatus.UNKNOWN

        unhealthy_count = sum(
            1 for check in checks if check.status == HealthStatus.UNHEALTHY
        )
        degraded_count = sum(
            1 for check in checks if check.status == HealthStatus.DEGRADED
        )

        # If any core service is unhealthy, overall is unhealthy
        if unhealthy_count > 0:
            return HealthStatus.UNHEALTHY

        # If more than half are degraded, overall is degraded
        if degraded_count > len(checks) // 2:
            return HealthStatus.DEGRADED

        # If any are degraded, overall is degraded
        if degraded_count > 0:
            return HealthStatus.DEGRADED

        return HealthStatus.HEALTHY

    def _generate_summary(self, checks: List[HealthCheckResult]) -> Dict[str, Any]:
        """Generate health check summary"""
        status_counts = {}
        total_response_time = 0
        service_count = len(checks)

        for check in checks:
            status = check.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
            total_response_time += check.response_time_ms

        avg_response_time = (
            total_response_time / service_count if service_count > 0 else 0
        )

        return {
            "total_services": service_count,
            "status_breakdown": status_counts,
            "average_response_time_ms": round(avg_response_time, 2),
            "circuit_breaker_states": {
                name: cb.get_state() for name, cb in self.circuit_breakers.items()
            },
        }

    def get_circuit_breaker_status(self) -> Dict[str, Any]:
        """Get status of all circuit breakers"""
        return {
            "circuit_breakers": {
                name: cb.get_state() for name, cb in self.circuit_breakers.items()
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    def reset_circuit_breaker(self, service_name: str) -> bool:
        """Manually reset a circuit breaker"""
        if service_name in self.circuit_breakers:
            cb = self.circuit_breakers[service_name]
            cb.state = CircuitState.CLOSED
            cb.failure_count = 0
            cb.success_count = 0
            cb.last_failure_time = None
            return True
        return False


def get_health_checker() -> ManuelHealthChecker:
    """Factory function to create health checker instance"""
    return ManuelHealthChecker()
