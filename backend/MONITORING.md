# Manuel Backend - Monitoring & Observability Guide

## Overview
This document provides comprehensive guidance for monitoring the Manuel voice assistant backend, including dashboards, alerts, metrics, and troubleshooting procedures.

## Quick Access

### Key Monitoring URLs
```bash
# Get dashboard URL from CloudFormation
aws cloudformation describe-stacks \
  --stack-name manuel-{stage} \
  --query 'Stacks[0].Outputs[?OutputKey==`DashboardURL`].OutputValue' \
  --output text

# Direct CloudWatch Console (replace {stage} and {region})
https://{region}.console.aws.amazon.com/cloudwatch/home?region={region}#dashboards:name=Manuel-{stage}
```

### Log Groups
- `/aws/lambda/manuel-transcribe-{stage}`
- `/aws/lambda/manuel-query-{stage}`
- `/aws/lambda/manuel-manuals-{stage}`
- `/aws/lambda/manuel-process-manual-{stage}`
- `/aws/lambda/manuel-usage-{stage}`

## CloudWatch Dashboard

### Dashboard Layout

#### Row 1: API Gateway Overview
- **Widget 1**: Request count, 4xx errors, 5xx errors (time series)
- **Widget 2**: API latency and integration latency (time series)

#### Row 2: Lambda Function Performance
- **Widget 3**: Transcribe function (invocations, errors, duration)
- **Widget 4**: Query function (invocations, errors, duration)
- **Widget 5**: Manuals function (invocations, errors)

#### Row 3: Infrastructure Metrics
- **Widget 6**: DynamoDB usage (read/write capacity, throttling)
- **Widget 7**: S3 storage metrics (bucket size, object count)

#### Row 4: Error Analysis
- **Widget 8**: Recent error logs from query function

### Key Metrics to Monitor

#### Health Indicators
| Metric | Healthy Range | Warning | Critical |
|--------|---------------|---------|----------|
| API 4xx Error Rate | <2% | 2-5% | >5% |
| API 5xx Error Rate | <0.1% | 0.1-1% | >1% |
| API Latency (p95) | <3s | 3-5s | >5s |
| Lambda Error Rate | <1% | 1-3% | >3% |
| DynamoDB Throttling | 0 | 1-5 | >5 |

#### Performance Indicators
| Metric | Good | Fair | Poor |
|--------|------|------|------|
| Query Response Time | <2s | 2-5s | >5s |
| Transcription Time | <10s | 10-30s | >30s |
| Knowledge Base Retrieval | <1s | 1-3s | >3s |
| Bedrock Generation | <3s | 3-8s | >8s |

## Custom Metrics

### Business Metrics (Manuel/Application namespace)

#### Request Metrics
- **RequestDuration**: Processing time per function
- **RequestCount**: Number of requests by function and status code
- **QuotaUsagePercentage**: User quota consumption

#### AI/ML Metrics
- **BedrockCallDuration**: Time for Bedrock API calls
- **BedrockCallCount**: Number of Bedrock calls by model and status
- **BedrockTokens**: Token consumption by model and operation
- **KnowledgeBaseQueryDuration**: Knowledge base search time
- **KnowledgeBaseResults**: Number of results returned
- **TranscriptionDuration**: Audio transcription time
- **TranscriptionCount**: Transcription attempts and success rate

### Useful CloudWatch Insights Queries

#### Error Analysis
```sql
-- Recent errors across all functions
fields @timestamp, @message, function, error, error_type
| filter level = "ERROR"
| sort @timestamp desc
| limit 50
```

#### Performance Analysis
```sql
-- Slow requests (>5 seconds)
fields @timestamp, function, duration_ms, user_id
| filter duration_ms > 5000
| sort duration_ms desc
| limit 20
```

#### User Activity
```sql
-- Top users by request count
fields user_id, count() as request_count
| filter ispresent(user_id)
| stats count() by user_id
| sort request_count desc
| limit 10
```

#### Quota Monitoring
```sql
-- Users approaching quota limits
fields @timestamp, user_id, daily_used, daily_limit
| filter daily_used / daily_limit > 0.8
| sort @timestamp desc
```

## Alerting

### Configured Alarms

#### API Gateway Alarms
1. **manuel-api-4xx-errors-{stage}**
   - Threshold: >10 errors in 5 minutes
   - Evaluation: 2 periods
   - Action: SNS notification

2. **manuel-api-5xx-errors-{stage}**
   - Threshold: >5 errors in 5 minutes
   - Evaluation: 1 period
   - Action: SNS notification

3. **manuel-api-latency-{stage}**
   - Threshold: Configurable (default 5000ms)
   - Evaluation: 2 periods
   - Action: SNS notification

#### Lambda Function Alarms
4. **manuel-transcribe-errors-{stage}**
   - Threshold: >5 errors in 5 minutes
   - Action: SNS notification

5. **manuel-query-errors-{stage}**
   - Threshold: >5 errors in 5 minutes
   - Action: SNS notification

6. **manuel-query-duration-{stage}**
   - Threshold: Function timeout value
   - Action: SNS notification

#### DynamoDB Alarms
7. **manuel-dynamodb-throttles-{stage}**
   - Threshold: ≥1 throttled request
   - Action: SNS notification

### Setting Up Email Alerts
```bash
# Deploy with email alerts enabled
sam deploy --parameter-overrides AlertEmail=admin@yourdomain.com

# Subscribe additional emails to SNS topic
aws sns subscribe \
  --topic-arn $(aws cloudformation describe-stacks \
    --stack-name manuel-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`AlertTopicArn`].OutputValue' \
    --output text) \
  --protocol email \
  --notification-endpoint additional-admin@yourdomain.com
```

## Structured Logging

### Log Format
All Lambda functions emit structured JSON logs:

```json
{
  "timestamp": "2025-01-10T12:00:00.000Z",
  "level": "INFO|WARNING|ERROR|DEBUG",
  "function": "manuel-query",
  "request_id": "abc123-def456-ghi789",
  "message": "Human readable message",
  "user_id": "user123",
  "duration_ms": 1234,
  "status_code": 200,
  // Additional context fields...
}
```

### Log Levels

#### INFO
- Request start/end
- Successful operations
- Quota checks
- Metric emissions

#### WARNING
- Quota approaching limits
- Non-critical errors
- Invalid requests
- Rate limiting

#### ERROR
- Function failures
- API call failures
- Unexpected exceptions
- Critical issues

#### DEBUG
- Detailed operation timing
- Internal state information
- Development debugging

### Searching Logs

#### Find Specific User Activity
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/manuel-query-dev \
  --filter-pattern '{ $.user_id = "user123" }' \
  --start-time $(date -d '1 hour ago' +%s)000
```

#### Find Quota Violations
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/manuel-query-dev \
  --filter-pattern '{ $.message = "Quota exceeded" }' \
  --start-time $(date -d '24 hours ago' +%s)000
```

#### Find Bedrock Errors
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/manuel-query-dev \
  --filter-pattern '{ $.error_type = "BedrockError" }' \
  --start-time $(date -d '1 hour ago' +%s)000
```

## Performance Monitoring

### Key Performance Indicators (KPIs)

#### User Experience
- **Average Response Time**: <3 seconds for queries
- **Transcription Accuracy**: >95% success rate
- **Query Success Rate**: >98% successful responses
- **Error Rate**: <1% of all requests

#### System Performance
- **Lambda Cold Starts**: <5% of invocations
- **Bedrock Latency**: <2 seconds average
- **Knowledge Base Retrieval**: <1 second average
- **DynamoDB Response Time**: <10ms average

#### Resource Utilization
- **Lambda Memory Usage**: <80% of allocated memory
- **DynamoDB Capacity**: <70% of provisioned capacity
- **S3 Request Rate**: Within service limits
- **Bedrock Token Usage**: Within quotas

### Performance Optimization Monitoring

#### Lambda Performance
```sql
-- Lambda memory utilization
fields @timestamp, @memorySize, @maxMemoryUsed, @memorySize - @maxMemoryUsed as memoryUnused
| filter @type = "REPORT"
| stats avg(@maxMemoryUsed/@memorySize) as avgMemoryUtilization by bin(5m)
```

#### Bedrock Performance
```sql
-- Bedrock call performance by model
fields @timestamp, model_id, duration_ms, tokens_used
| filter model_id like /anthropic/
| stats avg(duration_ms) as avgDuration, sum(tokens_used) as totalTokens by model_id
```

## Troubleshooting

### Common Issues and Solutions

#### High Error Rates
1. **Check CloudWatch Dashboard** for error distribution
2. **Review structured logs** for error patterns
3. **Monitor custom metrics** for specific failure points
4. **Check service quotas** (Bedrock, Transcribe, etc.)

#### High Latency
1. **Analyze request flow** through dashboard widgets
2. **Check Bedrock response times** in custom metrics
3. **Monitor Lambda cold starts** and memory usage
4. **Review Knowledge Base query performance**

#### Quota Issues
1. **Monitor quota usage metrics** in dashboard
2. **Check user patterns** in structured logs
3. **Review quota thresholds** in parameters
4. **Analyze usage distribution** across users

### Emergency Response Procedures

#### Service Degradation
1. Check CloudWatch dashboard for anomalies
2. Review recent deployments and changes
3. Check AWS service health dashboard
4. Monitor alert notifications

#### Complete Service Outage
1. Check CloudFormation stack status
2. Verify AWS service availability
3. Review IAM permissions and policies
4. Check network connectivity and DNS

### Debugging Commands

#### Service Health Check
```bash
# Check all CloudFormation resources
aws cloudformation describe-stack-resources \
  --stack-name manuel-dev \
  --query 'StackResources[?ResourceStatus!=`CREATE_COMPLETE`]'

# Test API Gateway endpoint
curl -X OPTIONS https://your-api-id.execute-api.eu-west-1.amazonaws.com/Prod/api/transcribe

# Check Lambda function status
aws lambda get-function --function-name manuel-query-dev
```

#### Performance Analysis
```bash
# Get custom metrics
aws cloudwatch get-metric-statistics \
  --namespace "Manuel/Application" \
  --metric-name "RequestDuration" \
  --dimensions Name=Function,Value=manuel-query \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Check alarm status
aws cloudwatch describe-alarms \
  --alarm-names manuel-query-errors-dev
```

## Maintenance

### Regular Monitoring Tasks

#### Daily
- Review CloudWatch dashboard for anomalies
- Check email alerts and notifications
- Monitor resource utilization trends
- Review top error patterns

#### Weekly
- Analyze performance trends
- Review user activity patterns
- Check quota usage distribution
- Optimize based on metrics

#### Monthly
- Review and tune alarm thresholds
- Analyze cost and usage patterns
- Update monitoring documentation
- Plan capacity adjustments

### Dashboard Customization

#### Adding New Widgets
1. Navigate to CloudWatch Dashboard
2. Click "Add widget"
3. Choose metric source (CloudWatch Metrics or Logs)
4. Configure metric filters and visualization
5. Save changes

#### Creating Custom Alarms
```bash
# Example: Create custom quota usage alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "manuel-high-quota-usage-dev" \
  --alarm-description "High quota usage detected" \
  --metric-name QuotaUsagePercentage \
  --namespace Manuel/Application \
  --statistic Average \
  --period 300 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:eu-west-1:123456789:manuel-alerts-dev
```

## Best Practices

### Monitoring Strategy
1. **Proactive Monitoring**: Use predictive alerts, not just reactive
2. **Context-Rich Alerts**: Include relevant metadata in notifications
3. **Escalation Procedures**: Define clear escalation paths
4. **Regular Reviews**: Continuously improve monitoring based on incidents

### Log Management
1. **Structured Logging**: Always use JSON format with consistent schema
2. **Correlation IDs**: Track requests across service boundaries
3. **Appropriate Log Levels**: Use DEBUG sparingly, INFO for business events
4. **Retention Policies**: Balance cost with debugging needs

### Performance Optimization
1. **Baseline Metrics**: Establish performance baselines
2. **Continuous Monitoring**: Track performance trends over time
3. **Capacity Planning**: Monitor resource utilization for scaling decisions
4. **Cost Optimization**: Balance performance with cost efficiency