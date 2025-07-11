# Manuel Backend - Cost Tracking & Management

## Overview
The Manuel backend includes a comprehensive real-time cost tracking system that provides both aggregate cost monitoring and detailed cost-per-request transparency. This enterprise-grade feature helps with cost optimization, budgeting, and user cost awareness.

## Key Features

### 🎯 Real-Time Cost Calculation
- **Per-Request Costs**: Calculated and returned with every API response
- **Service Breakdown**: Individual costs for each AWS service used
- **Token Tracking**: Bedrock token consumption and associated costs
- **Duration-Based Pricing**: Accurate Transcribe and Lambda cost calculation

### 📊 Cost Monitoring & Alerting
- **CloudWatch Metrics**: Custom metrics in `Manuel/Costs` namespace
- **Dashboard Widgets**: Real-time cost visualization
- **Smart Alerting**: Cost threshold alarms with SNS notifications
- **Historical Analysis**: Cost data stored in DynamoDB for analysis

### 💡 Cost Transparency
- **User-Facing Costs**: Detailed cost breakdowns returned to users
- **Service Attribution**: Costs attributed to specific AWS services
- **Operation Tracking**: Costs tracked by operation type (query, transcribe)

## API Response Examples

### Query Request with Cost Information
```json
POST /api/query
{
  "question": "How do I configure wireless settings?"
}

Response:
{
  "answer": "To configure wireless settings...",
  "context_used": 3,
  "usage": {
    "daily_used": 15,
    "daily_limit": 50,
    "monthly_used": 78,
    "monthly_limit": 1000
  },
  "cost": {
    "request_id": "abc123-def456",
    "operation": "query",
    "total_cost": 0.0234,
    "currency": "USD",
    "cost_breakdown": [
      {
        "service": "api_gateway",
        "operation": "requests",
        "cost": 0.0000035,
        "unit": "requests",
        "quantity": 1
      },
      {
        "service": "lambda",
        "operation": "execution",
        "cost": 0.0000012,
        "unit": "seconds",
        "quantity": 2.4
      },
      {
        "service": "dynamodb",
        "operation": "requests",
        "cost": 0.0000001,
        "unit": "request_units",
        "quantity": 2
      },
      {
        "service": "bedrock",
        "operation": "inference_claude",
        "cost": 0.0231,
        "unit": "tokens",
        "quantity": 1842
      }
    ],
    "timestamp": "2025-01-10T12:00:00.000Z"
  }
}
```

### Transcribe Request with Cost Information
```json
POST /api/transcribe
{
  "audio_data": "base64_encoded_audio",
  "content_type": "audio/mp4"
}

Response:
{
  "transcription": "How do I configure wireless settings?",
  "usage": { ... },
  "cost": {
    "request_id": "xyz789-abc123",
    "operation": "transcribe",
    "total_cost": 0.0087,
    "currency": "USD",
    "cost_breakdown": [
      {
        "service": "transcribe",
        "operation": "speech_to_text",
        "cost": 0.0072,
        "unit": "seconds",
        "quantity": 18.0
      },
      {
        "service": "s3",
        "operation": "storage_and_requests",
        "cost": 0.0000054,
        "unit": "mixed",
        "quantity": 1.0
      },
      {
        "service": "lambda",
        "operation": "execution",
        "cost": 0.0014,
        "unit": "seconds",
        "quantity": 22.5
      }
    ],
    "timestamp": "2025-01-10T12:00:00.000Z"
  }
}
```

## Cost Calculation Framework

### Service Pricing (EU-West-1)

#### AWS Bedrock
| Model | Input Tokens | Output Tokens |
|-------|--------------|---------------|
| Claude 3.5 Sonnet | $3.00 per 1M | $15.00 per 1M |
| Claude 4 Sonnet | $6.00 per 1M | $30.00 per 1M |
| Titan Embeddings v2 | $0.20 per 1M | N/A |

#### AWS Transcribe
| Service | Rate |
|---------|------|
| Standard Transcription | $0.0004 per second |

#### AWS Lambda
| Component | Rate |
|-----------|------|
| Requests | $0.20 per 1M requests |
| Compute | $0.0000166667 per GB-second |

#### Other Services
| Service | Component | Rate |
|---------|-----------|------|
| DynamoDB | Read Request Units | $0.0556 per 1M RRUs |
| DynamoDB | Write Request Units | $0.1111 per 1M WRUs |
| S3 | Standard Storage | $0.023 per GB/month |
| S3 | PUT Requests | $0.0054 per 1000 |
| API Gateway | Requests | $3.50 per 1M requests |

### Cost Calculation Logic

#### Real-Time Estimation
```python
# Example: Query operation cost calculation
cost_params = {
    "lambda_duration_ms": 2400,
    "lambda_memory_mb": 256,
    "text_input_tokens": 1200,
    "text_output_tokens": 642,
    "embedding_tokens": 45,
    "dynamodb_reads": 1,
    "dynamodb_writes": 1
}

request_cost = cost_calculator.calculate_request_cost(
    request_id="abc123",
    user_id="user456", 
    operation="query",
    **cost_params
)
```

#### Token Estimation
- **Text Tokens**: Approximately 4 characters per token for English
- **Audio Duration**: Roughly 1MB per minute of audio
- **Embedding Tokens**: Based on query text length

## CloudWatch Metrics

### Custom Metrics (Manuel/Costs namespace)

#### Cost Metrics
- **`RequestCost`**: Total cost per request (by operation)
- **`ServiceCost`**: Cost by AWS service and operation
- **`DailyCostAccumulation`**: Running daily cost total

#### Dimensions
- **Operation**: query, transcribe, manuals, usage
- **Service**: bedrock, transcribe, lambda, dynamodb, s3, api_gateway

### Dashboard Widgets

#### Cost Overview (Row 4)
1. **Request Costs**: Total costs by operation over time
2. **Service Breakdown**: Stacked costs by AWS service

#### Key Metrics to Monitor
- **Daily Cost Trend**: Total spending per day
- **Cost per Request**: Average cost by operation type
- **Service Distribution**: Which services drive the most cost
- **Token Consumption**: Bedrock usage patterns

## Cost Alerting

### Configured Alarms

#### Daily Cost Threshold
- **Threshold**: Configurable (dev: $10, prod: $50, claude4: $25)
- **Period**: 24 hours
- **Action**: SNS notification when daily costs exceed threshold

#### Expensive Request Detection
- **Threshold**: Configurable (dev: $0.50, prod: $1.00, claude4: $2.00)
- **Period**: 5 minutes
- **Action**: Alert when individual requests are unusually expensive

#### Bedrock Cost Monitoring
- **Threshold**: $1.00 in 5 minutes
- **Purpose**: Detect runaway AI costs
- **Action**: Immediate notification for cost spikes

### Setting Cost Thresholds
```bash
# Deploy with custom cost thresholds
sam deploy --parameter-overrides \
  DailyCostThreshold=25.0 \
  RequestCostThreshold=0.75
```

## Cost Data Storage

### DynamoDB Schema
```json
{
  "user_id": "cost#user123",
  "date": "2025-01-10T12:00:00.000Z",
  "request_id": "abc123-def456",
  "operation": "query",
  "total_cost": "0.0234",
  "service_costs": "[{...}]",
  "currency": "USD",
  "ttl": 1736510400
}
```

### Data Retention
- **Cost Data**: 90 days (configurable TTL)
- **CloudWatch Metrics**: Based on log retention settings
- **Aggregate Reports**: Can be generated from stored data

## Cost Analysis Queries

### CloudWatch Insights Queries

#### Daily Cost Analysis
```sql
fields @timestamp, total_cost, operation, user_id
| filter ispresent(total_cost)
| stats sum(total_cost) as daily_cost by bin(1d)
| sort @timestamp desc
```

#### Most Expensive Users
```sql
fields user_id, total_cost
| filter ispresent(total_cost) and ispresent(user_id)
| stats sum(total_cost) as user_total_cost by user_id
| sort user_total_cost desc
| limit 10
```

#### Cost by Operation Type
```sql
fields operation, total_cost
| filter ispresent(total_cost)
| stats sum(total_cost) as operation_cost, count() as requests by operation
| eval avg_cost_per_request = operation_cost / requests
| sort operation_cost desc
```

#### Token Usage Analysis
```sql
fields @timestamp, text_input_tokens, text_output_tokens, model_id
| filter ispresent(text_input_tokens)
| stats sum(text_input_tokens) as total_input, sum(text_output_tokens) as total_output by model_id
| eval total_tokens = total_input + total_output
```

### API for Cost Analysis

#### Get User Daily Costs
```bash
# Get cost for specific user and date
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "https://api-url/api/user/costs?date=2025-01-10"
```

#### Cost Summary Report
```python
# Example usage of cost calculator for reporting
cost_calculator = get_cost_calculator()
daily_cost = cost_calculator.get_user_daily_cost("user123", "2025-01-10")
print(f"User daily cost: ${daily_cost:.4f}")
```

## Cost Optimization Strategies

### 1. Model Selection
- **Claude 3.5 Sonnet**: Best balance of performance and cost
- **Claude 3 Haiku**: Lower cost for simple queries
- **Claude 4**: Use only when advanced reasoning is required

### 2. Token Optimization
- **Prompt Engineering**: Reduce input token count with concise prompts
- **Response Limits**: Set appropriate max_tokens limits
- **Context Management**: Only include relevant manual excerpts

### 3. Caching Strategies
- **Repeated Queries**: Consider caching frequent questions
- **Embeddings**: Cache Knowledge Base results for popular queries
- **Static Content**: Cache manual processing results

### 4. Quota Management
- **Conservative Limits**: Set appropriate daily/monthly quotas
- **User Tiers**: Different quotas for different user types
- **Cost-Based Quotas**: Implement cost-based limits in addition to count-based

### 5. Operational Efficiency
- **Right-Sizing**: Optimize Lambda memory allocation
- **Lifecycle Policies**: Aggressive cleanup of temporary files
- **Monitoring**: Regular cost review and optimization

## Cost Budgeting

### Environment-Specific Budgets

#### Development
- **Daily Budget**: $10
- **Monthly Budget**: $200
- **Purpose**: Testing and development

#### Production
- **Daily Budget**: $50
- **Monthly Budget**: $1000
- **Purpose**: Normal business operations

#### Claude 4 Testing
- **Daily Budget**: $25
- **Monthly Budget**: $500
- **Purpose**: Conservative testing of expensive models

### AWS Budgets Integration
```bash
# Create AWS Budget for Manuel application
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "Manuel-Production-Monthly",
    "BudgetLimit": {
      "Amount": "1000",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }'
```

## Troubleshooting Cost Issues

### High Cost Alerts

#### 1. Identify Cost Drivers
- Check CloudWatch dashboard for cost breakdown
- Review service-specific costs in metrics
- Analyze expensive requests in logs

#### 2. Investigate Usage Patterns
- Check for unusual user activity
- Review token consumption patterns
- Analyze request frequency and complexity

#### 3. Optimization Actions
- Adjust quotas if needed
- Review model selection
- Optimize prompts and responses
- Check for inefficient operations

### Cost Anomaly Detection
```bash
# Check for cost spikes in last hour
aws logs filter-log-events \
  --log-group-name /aws/lambda/manuel-query-prod \
  --filter-pattern '{ $.total_cost > 1.0 }' \
  --start-time $(date -d '1 hour ago' +%s)000
```

## Best Practices

### 1. Cost Monitoring
- **Daily Reviews**: Check cost dashboard daily
- **Weekly Analysis**: Review cost trends and patterns
- **Monthly Reports**: Generate comprehensive cost reports
- **Threshold Tuning**: Adjust alert thresholds based on usage

### 2. User Communication
- **Cost Transparency**: Show costs to users in responses
- **Usage Guidance**: Educate users on cost-effective usage
- **Quota Notifications**: Warn users before limits are reached

### 3. Development Practices
- **Cost-Aware Development**: Consider costs in feature design
- **Testing**: Include cost testing in development process
- **Documentation**: Keep cost documentation updated

### 4. Operational Excellence
- **Regular Optimization**: Continuous cost optimization efforts
- **Pricing Updates**: Monitor AWS pricing changes
- **Tool Updates**: Keep cost calculation framework updated

## Integration with Business Logic

### Cost-Based Decision Making
```python
# Example: Choose model based on cost constraints
def select_model_for_query(query_complexity, user_tier, cost_budget):
    if cost_budget < 0.01:
        return "anthropic.claude-3-haiku-20240307-v1:0"
    elif query_complexity == "high" and cost_budget > 0.05:
        return "us.anthropic.claude-sonnet-4-20250514-v1:0"
    else:
        return "anthropic.claude-3-5-sonnet-20241022-v2:0"
```

### User Tier Pricing
```python
# Example: Different cost thresholds by user tier
cost_limits = {
    "free": {"daily": 0.50, "monthly": 5.00},
    "premium": {"daily": 5.00, "monthly": 50.00},
    "enterprise": {"daily": 50.00, "monthly": 500.00}
}
```

## Future Enhancements

### Planned Features
- **Cost Prediction**: ML-based cost forecasting
- **Usage Optimization**: Automatic optimization suggestions
- **Custom Reporting**: Advanced cost analytics and reporting
- **Multi-Currency**: Support for different currencies
- **Cost Allocation**: Cost attribution to different business units

### Integration Opportunities
- **Billing Systems**: Integration with external billing platforms
- **Business Intelligence**: Cost data integration with BI tools
- **Automated Optimization**: Automatic cost optimization based on patterns