"""
Cost calculation framework for Manuel backend
Provides real-time cost estimation and tracking for AWS services
"""

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Dict, Optional

import boto3


@dataclass
class ServiceCost:
    """Individual service cost breakdown"""

    service: str
    operation: str
    quantity: float
    unit: str
    unit_cost: float
    total_cost: float
    currency: str = "USD"


@dataclass
class RequestCost:
    """Complete cost breakdown for a request"""

    request_id: str
    user_id: str
    timestamp: str
    operation: str
    service_costs: list
    total_cost: float
    currency: str = "USD"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "request_id": self.request_id,
            "operation": self.operation,
            "total_cost": round(self.total_cost, 6),
            "currency": self.currency,
            "cost_breakdown": [
                {
                    "service": cost.service,
                    "operation": cost.operation,
                    "cost": round(cost.total_cost, 6),
                    "unit": cost.unit,
                    "quantity": cost.quantity,
                }
                for cost in self.service_costs
            ],
            "timestamp": self.timestamp,
        }


class ManuelCostCalculator:
    """
    Real-time cost calculator for Manuel backend services

    Uses current AWS pricing to estimate costs for operations.
    Prices are configured per region and updated periodically.
    """

    def __init__(self, region: str = "eu-west-1"):
        self.region = region
        self.cloudwatch = boto3.client("cloudwatch")

        # AWS Pricing (EU-West-1) - Updated Jan 2025
        # These should be updated periodically or fetched from AWS Pricing API
        self.pricing = {
            "bedrock": {
                # Claude 3.5 Sonnet pricing
                "anthropic.claude-3-5-sonnet-20241022-v2:0": {
                    "input_tokens": 0.000003,  # $3 per 1M input tokens
                    "output_tokens": 0.000015,  # $15 per 1M output tokens
                },
                # Claude 4 Sonnet pricing (estimated)
                "us.anthropic.claude-sonnet-4-20250514-v1:0": {
                    "input_tokens": 0.000006,  # $6 per 1M input tokens
                    "output_tokens": 0.000030,  # $30 per 1M output tokens
                },
                # Titan Embeddings pricing
                "amazon.titan-embed-text-v2:0": {
                    "input_tokens": 0.0000002  # $0.2 per 1M tokens
                },
            },
            "transcribe": {"standard": 0.0004},  # $0.0004 per second
            "lambda": {
                "requests": 0.0000002,  # $0.20 per 1M requests
                "compute_gb_second": 0.0000166667,  # $0.0000166667 per GB-second
            },
            "dynamodb": {
                "read_request_unit": 0.0000000556,  # $0.0556 per million RRUs
                "write_request_unit": 0.0000001111,  # $0.1111 per million WRUs
            },
            "s3": {
                "standard_storage": 0.023,  # $0.023 per GB per month
                "standard_requests_put": 0.0000054,  # $0.0054 per 1000 PUT requests
                "standard_requests_get": 0.0000004,  # $0.0004 per 1000 GET requests
            },
            "api_gateway": {"requests": 0.0000035},  # $3.50 per million requests
            "cloudwatch": {
                "logs_ingestion": 0.50,  # $0.50 per GB ingested
                "logs_storage": 0.03,  # $0.03 per GB per month
                "custom_metrics": 0.30,  # $0.30 per metric per month
            },
        }

    def calculate_bedrock_cost(
        self, model_id: str, input_tokens: int, output_tokens: int = 0
    ) -> ServiceCost:
        """Calculate cost for Bedrock model inference"""
        if model_id not in self.pricing["bedrock"]:
            # Default to Claude 3.5 Sonnet pricing
            model_pricing = self.pricing["bedrock"][
                "anthropic.claude-3-5-sonnet-20241022-v2:0"
            ]
        else:
            model_pricing = self.pricing["bedrock"][model_id]

        input_cost = input_tokens * model_pricing["input_tokens"]
        output_cost = output_tokens * model_pricing.get("output_tokens", 0)
        total_cost = input_cost + output_cost

        return ServiceCost(
            service="bedrock",
            operation=f"inference_{model_id.split('.')[-1]}",
            quantity=input_tokens + output_tokens,
            unit="tokens",
            unit_cost=(
                (input_cost + output_cost) / (input_tokens + output_tokens)
                if (input_tokens + output_tokens) > 0
                else 0
            ),
            total_cost=total_cost,
        )

    def calculate_transcribe_cost(self, duration_seconds: float) -> ServiceCost:
        """Calculate cost for AWS Transcribe"""
        cost = duration_seconds * self.pricing["transcribe"]["standard"]

        return ServiceCost(
            service="transcribe",
            operation="speech_to_text",
            quantity=duration_seconds,
            unit="seconds",
            unit_cost=self.pricing["transcribe"]["standard"],
            total_cost=cost,
        )

    def calculate_lambda_cost(self, duration_ms: float, memory_mb: int) -> ServiceCost:
        """Calculate cost for Lambda execution"""
        duration_seconds = duration_ms / 1000
        memory_gb = memory_mb / 1024

        # Request cost
        request_cost = self.pricing["lambda"]["requests"]

        # Compute cost (GB-seconds)
        compute_cost = (memory_gb * duration_seconds) * self.pricing["lambda"][
            "compute_gb_second"
        ]

        total_cost = request_cost + compute_cost

        return ServiceCost(
            service="lambda",
            operation="execution",
            quantity=duration_seconds,
            unit="seconds",
            unit_cost=total_cost / duration_seconds if duration_seconds > 0 else 0,
            total_cost=total_cost,
        )

    def calculate_dynamodb_cost(
        self, read_units: int = 0, write_units: int = 0
    ) -> ServiceCost:
        """Calculate cost for DynamoDB operations"""
        read_cost = read_units * self.pricing["dynamodb"]["read_request_unit"]
        write_cost = write_units * self.pricing["dynamodb"]["write_request_unit"]
        total_cost = read_cost + write_cost

        return ServiceCost(
            service="dynamodb",
            operation="requests",
            quantity=read_units + write_units,
            unit="request_units",
            unit_cost=(
                total_cost / (read_units + write_units)
                if (read_units + write_units) > 0
                else 0
            ),
            total_cost=total_cost,
        )

    def calculate_s3_cost(
        self, storage_gb: float = 0, put_requests: int = 0, get_requests: int = 0
    ) -> ServiceCost:
        """Calculate cost for S3 operations"""
        # Monthly storage cost (prorated)
        storage_cost = (
            storage_gb * self.pricing["s3"]["standard_storage"] / 30 / 24
        )  # Per hour

        # Request costs
        put_cost = (put_requests / 1000) * self.pricing["s3"]["standard_requests_put"]
        get_cost = (get_requests / 1000) * self.pricing["s3"]["standard_requests_get"]

        total_cost = storage_cost + put_cost + get_cost

        return ServiceCost(
            service="s3",
            operation="storage_and_requests",
            quantity=storage_gb + (put_requests + get_requests) / 1000,
            unit="mixed",
            unit_cost=0,  # Mixed units
            total_cost=total_cost,
        )

    def calculate_api_gateway_cost(self, requests: int = 1) -> ServiceCost:
        """Calculate cost for API Gateway requests"""
        cost = requests * self.pricing["api_gateway"]["requests"] / 1000000

        return ServiceCost(
            service="api_gateway",
            operation="requests",
            quantity=requests,
            unit="requests",
            unit_cost=self.pricing["api_gateway"]["requests"] / 1000000,
            total_cost=cost,
        )

    def calculate_request_cost(
        self, request_id: str, user_id: str, operation: str, **service_params
    ) -> RequestCost:
        """
        Calculate total cost for a complete request

        Args:
            request_id: Unique request identifier
            user_id: User making the request
            operation: Type of operation (transcribe, query, etc.)
            **service_params: Service-specific parameters for cost calculation
        """
        service_costs = []

        # API Gateway cost (always included)
        service_costs.append(self.calculate_api_gateway_cost(1))

        # Lambda cost (always included)
        if (
            "lambda_duration_ms" in service_params
            and "lambda_memory_mb" in service_params
        ):
            service_costs.append(
                self.calculate_lambda_cost(
                    service_params["lambda_duration_ms"],
                    service_params["lambda_memory_mb"],
                )
            )

        # DynamoDB cost (quota checking)
        if "dynamodb_reads" in service_params or "dynamodb_writes" in service_params:
            service_costs.append(
                self.calculate_dynamodb_cost(
                    service_params.get("dynamodb_reads", 0),
                    service_params.get(
                        "dynamodb_writes", 1
                    ),  # At least one write for quota
                )
            )

        # Operation-specific costs
        if operation == "transcribe":
            if "transcribe_duration_seconds" in service_params:
                service_costs.append(
                    self.calculate_transcribe_cost(
                        service_params["transcribe_duration_seconds"]
                    )
                )

            if "s3_put_requests" in service_params:
                service_costs.append(
                    self.calculate_s3_cost(
                        put_requests=service_params["s3_put_requests"],
                        get_requests=service_params.get("s3_get_requests", 1),
                    )
                )

        elif operation == "query":
            # Bedrock embedding cost (Knowledge Base)
            if "embedding_tokens" in service_params:
                embedding_model = service_params.get(
                    "embedding_model", "amazon.titan-embed-text-v2:0"
                )
                service_costs.append(
                    self.calculate_bedrock_cost(
                        embedding_model, service_params["embedding_tokens"]
                    )
                )

            # Bedrock text generation cost
            if (
                "text_input_tokens" in service_params
                and "text_output_tokens" in service_params
            ):
                text_model = service_params.get(
                    "text_model", "anthropic.claude-3-5-sonnet-20241022-v2:0"
                )
                service_costs.append(
                    self.calculate_bedrock_cost(
                        text_model,
                        service_params["text_input_tokens"],
                        service_params["text_output_tokens"],
                    )
                )

        # Calculate total cost
        total_cost = sum(cost.total_cost for cost in service_costs)

        return RequestCost(
            request_id=request_id,
            user_id=user_id,
            timestamp=datetime.utcnow().isoformat(),
            operation=operation,
            service_costs=service_costs,
            total_cost=total_cost,
        )

    def emit_cost_metrics(self, request_cost: RequestCost) -> None:
        """Emit cost metrics to CloudWatch"""
        try:
            # Total cost metric
            self.cloudwatch.put_metric_data(
                Namespace="Manuel/Costs",
                MetricData=[
                    {
                        "MetricName": "RequestCost",
                        "Value": request_cost.total_cost,
                        "Unit": "None",  # USD amount
                        "Dimensions": [
                            {"Name": "Operation", "Value": request_cost.operation}
                        ],
                        "Timestamp": datetime.utcnow(),
                    }
                ],
            )

            # Service-specific cost metrics
            for service_cost in request_cost.service_costs:
                self.cloudwatch.put_metric_data(
                    Namespace="Manuel/Costs",
                    MetricData=[
                        {
                            "MetricName": "ServiceCost",
                            "Value": service_cost.total_cost,
                            "Unit": "None",  # USD amount
                            "Dimensions": [
                                {"Name": "Service", "Value": service_cost.service},
                                {"Name": "Operation", "Value": request_cost.operation},
                            ],
                            "Timestamp": datetime.utcnow(),
                        }
                    ],
                )

            # Daily cost accumulation
            self.cloudwatch.put_metric_data(
                Namespace="Manuel/Costs",
                MetricData=[
                    {
                        "MetricName": "DailyCostAccumulation",
                        "Value": request_cost.total_cost,
                        "Unit": "None",
                        "Timestamp": datetime.utcnow(),
                    }
                ],
            )

        except Exception as e:
            print(f"Warning: Failed to emit cost metrics: {e}")

    def store_cost_data(self, request_cost: RequestCost) -> None:
        """Store cost data in DynamoDB for analysis"""
        try:
            dynamodb = boto3.resource("dynamodb")
            table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

            # Store cost data with the usage tracking data
            from datetime import datetime, timedelta

            # Create TTL for cost data (90 days)
            ttl = int((datetime.utcnow() + timedelta(days=90)).timestamp())

            table.put_item(
                Item={
                    "user_id": f"cost#{request_cost.user_id}",
                    "date": request_cost.timestamp,
                    "request_id": request_cost.request_id,
                    "operation": request_cost.operation,
                    "total_cost": str(
                        request_cost.total_cost
                    ),  # Store as string to avoid precision issues
                    "service_costs": json.dumps(
                        [asdict(cost) for cost in request_cost.service_costs]
                    ),
                    "currency": request_cost.currency,
                    "ttl": ttl,
                }
            )

        except Exception as e:
            print(f"Warning: Failed to store cost data: {e}")

    def get_user_daily_cost(self, user_id: str, date: str = None) -> float:
        """Get total cost for a user on a specific date"""
        if date is None:
            date = datetime.utcnow().strftime("%Y-%m-%d")

        try:
            dynamodb = boto3.resource("dynamodb")
            table = dynamodb.Table(os.environ["USAGE_TABLE_NAME"])

            response = table.query(
                KeyConditionExpression="user_id = :user_id AND begins_with(#date, :date)",
                ExpressionAttributeNames={"#date": "date"},
                ExpressionAttributeValues={
                    ":user_id": f"cost#{user_id}",
                    ":date": date,
                },
            )

            total_cost = 0.0
            for item in response.get("Items", []):
                total_cost += float(item.get("total_cost", 0))

            return total_cost

        except Exception as e:
            print(f"Warning: Failed to get user daily cost: {e}")
            return 0.0

    def estimate_audio_duration(self, audio_size_bytes: int) -> float:
        """Estimate audio duration from file size (rough approximation)"""
        # Rough estimate: 1 minute of audio ≈ 1MB (varies by quality)
        estimated_minutes = audio_size_bytes / (1024 * 1024)
        return estimated_minutes * 60  # Convert to seconds

    def estimate_tokens_from_text(self, text: str) -> int:
        """Estimate token count from text (rough approximation)"""
        # Rough estimate: 1 token ≈ 4 characters for English text
        return len(text) // 4

    def update_pricing(self, service: str, pricing_data: Dict[str, Any]) -> None:
        """Update pricing data (for maintenance)"""
        if service in self.pricing:
            self.pricing[service].update(pricing_data)
        else:
            self.pricing[service] = pricing_data


def get_cost_calculator(region: str = None) -> ManuelCostCalculator:
    """Factory function to create cost calculator instance"""
    if region is None:
        region = os.environ.get("REGION", "eu-west-1")
    return ManuelCostCalculator(region)
