# Manuel Backend - CI/CD Pipeline Setup

This document provides comprehensive instructions for setting up and managing
the AWS-native CI/CD pipeline for the Manuel backend.

## 🚀 Quick Start

### Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js 18+ and Python 3.11+
- SAM CLI installed
- Git configured with GitHub access

### One-Command Setup

```bash
cd backend
./deploy-pipeline.sh --notification-email your-email@domain.com
```

This will create:

- CodePipeline with multi-stage deployment
- CodeBuild projects for build, test, and chaos testing
- CodeCommit repository for AWS integration
- S3 bucket for pipeline artifacts
- SNS topic for notifications
- CloudWatch alarms for monitoring

## 📋 Pipeline Architecture

### Pipeline Stages

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Source    │ -> │    Build    │ -> │ Deploy Dev  │ -> │  Test Dev   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                 │
┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│Deploy Staging│ <- │Manual Approval│ <- │Test Staging │ <--------┘
└─────────────┘    └─────────────┘    └─────────────┘
       │
       ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│Chaos Testing│ -> │Deploy Canary│ -> │Deploy Prod  │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Environment Configuration

| Environment    | Purpose                | Resources                         | Monitoring              | Manual Approval |
| -------------- | ---------------------- | --------------------------------- | ----------------------- | --------------- |
| **Dev**        | Feature development    | 256MB Lambda, Basic security      | CloudWatch logs         | No              |
| **Staging**    | Pre-production testing | 512MB Lambda, Full security       | Enhanced monitoring     | No              |
| **Production** | Live environment       | 512MB Lambda, Enterprise security | Full monitoring + X-Ray | Yes             |

## 🔧 Configuration Files

### Parameter Files

- `parameters-dev.json` - Development environment
- `parameters-staging.json` - Staging environment
- `parameters-production.json` - Production environment
- `parameters-claude4.json` - Claude 4 testing environment

### Build Specifications

- `buildspec-build.yml` - Main build and unit testing
- `buildspec-integration-test.yml` - Integration testing
- `buildspec-chaos-testing.yml` - Chaos engineering tests

### Infrastructure

- `pipeline-template.yaml` - CodePipeline infrastructure
- `template.yaml` - Main SAM template with canary deployment support

## 🚀 Deployment Process

### 1. Deploy Pipeline Infrastructure

```bash
# Basic deployment
./deploy-pipeline.sh --notification-email admin@yourdomain.com

# Custom configuration
./deploy-pipeline.sh \
  --stack-name my-manuel-pipeline \
  --region eu-west-1 \
  --github-owner your-org \
  --github-repo your-repo \
  --notification-email admin@yourdomain.com
```

### 2. Configure Source Integration

#### Option A: GitHub Webhook (Recommended)

```bash
# GitHub will automatically trigger pipeline on push to main
# No additional configuration needed
```

#### Option B: Manual CodeCommit Push

```bash
# Get CodeCommit URL from CloudFormation outputs
git remote add codecommit <codecommit-url>
git push codecommit main
```

### 3. Monitor Pipeline Execution

```bash
# View pipeline status
aws codepipeline get-pipeline-state --name manuel-backend-pipeline

# View build logs
aws logs describe-log-groups --log-group-name-prefix "/aws/codebuild/manuel"
```

## 🧪 Testing Strategy

### Automated Testing Levels

| Test Level            | Environment    | Duration  | Coverage               |
| --------------------- | -------------- | --------- | ---------------------- |
| **Unit Tests**        | All            | ~2 min    | 80%+ code coverage     |
| **Integration Tests** | Dev/Staging    | ~5-15 min | API functionality      |
| **Security Tests**    | All            | ~3 min    | Vulnerability scanning |
| **Performance Tests** | Staging        | ~10 min   | Load testing           |
| **Chaos Tests**       | Pre-production | ~20 min   | Resilience testing     |

### Test Categories

1. **Smoke Tests** - Basic functionality validation
2. **API Tests** - REST API functionality
3. **Authentication Tests** - Cognito integration
4. **Security Tests** - Input validation, rate limiting
5. **Performance Tests** - Response time, throughput
6. **Error Handling Tests** - Failure scenarios
7. **Chaos Engineering** - System resilience

## 🚦 Manual Approval Gates

### Pre-Production Approval

**Trigger**: After successful staging deployment and testing

**Approvers**: DevOps Engineer (required), Product Owner (required)

**Information Provided**:

- Test results summary
- Performance benchmarks
- Security scan results
- Infrastructure changes summary

### Canary Approval

**Trigger**: After canary monitoring period (15 minutes)

**Approvers**: DevOps Engineer (required)

**Information Provided**:

- Canary performance metrics
- Error rate comparison
- Response time analysis
- Cost impact assessment

### Approval Actions

```bash
# Approve via AWS CLI
aws codepipeline put-approval-result \
  --pipeline-name manuel-backend-pipeline \
  --stage-name ManualApproval \
  --action-name ApprovalAction \
  --result summary="Approved after review",status=Approved \
  --token <approval-token>

# Reject
aws codepipeline put-approval-result \
  --pipeline-name manuel-backend-pipeline \
  --stage-name ManualApproval \
  --action-name ApprovalAction \
  --result summary="Rejected due to test failures",status=Rejected \
  --token <approval-token>
```

## 📊 Monitoring & Alerting

### CloudWatch Alarms

#### API Gateway Alarms

- **4xx Error Rate**: > 5 errors in 5 minutes
- **5xx Error Rate**: > 3 errors in 5 minutes
- **Latency**: P95 > threshold (3-5 seconds)

#### Canary Deployment Alarms

- **Canary Error Rate**: > 1% for 10 minutes → Auto-rollback
- **Canary Latency**: > 5 seconds for 10 minutes → Auto-rollback

#### Lambda Function Alarms

- **Function Errors**: > 5 errors in 5 minutes
- **Duration**: > 80% of timeout
- **Throttles**: Any throttling events

### Notification Channels

- **Email**: Critical alerts and approval requests
- **SNS**: Integration with Slack/PagerDuty
- **CloudWatch Dashboard**: Real-time metrics

## 🔄 Canary Deployment Strategy

### Traffic Splitting Strategy

```yaml
Canary Flow:
  1. Deploy 10% traffic to new version 2. Monitor for 15 minutes 3. Manual
  approval required 4. Increase to 50% traffic 5. Monitor for 15 minutes 6.
  Final approval required 7. Deploy 100% traffic
```

### Success Criteria

```yaml
Health Checks:
  - Error rate < 1%
  - Response time P95 < 5 seconds
  - No critical alarms triggered
  - Business metrics within tolerance
```

### Rollback Triggers

```yaml
Automatic Rollback:
  - Error rate > 1% for 10 minutes
  - Response time > 5 seconds for 10 minutes
  - DynamoDB throttling events
  - Lambda function errors > threshold

Manual Rollback:
  - Business impact detected
  - Customer complaints
  - Manual override by on-call engineer
```

## 🛠️ Operational Procedures

### Daily Operations

```bash
# Check pipeline health
aws codepipeline list-pipeline-executions --pipeline-name manuel-backend-pipeline

# View recent deployments
aws cloudformation describe-stacks --stack-name manuel-dev
aws cloudformation describe-stacks --stack-name manuel-staging
aws cloudformation describe-stacks --stack-name manuel-prod

# Monitor costs
aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

### Emergency Procedures

#### Fast Rollback

```bash
# Emergency rollback of production deployment
aws codedeploy stop-deployment --deployment-id <deployment-id> --auto-rollback-enabled

# Revert to previous stable version
aws codepipeline start-pipeline-execution \
  --name manuel-backend-pipeline \
  --source-revisions actionName=SourceAction,revisionType=COMMIT_ID,revisionValue=<previous-commit>
```

#### Pipeline Maintenance

```bash
# Disable pipeline for maintenance
aws codepipeline disable-stage-transition \
  --pipeline-name manuel-backend-pipeline \
  --stage-name DeployProd \
  --transition-type Inbound \
  --reason "Maintenance window"

# Re-enable after maintenance
aws codepipeline enable-stage-transition \
  --pipeline-name manuel-backend-pipeline \
  --stage-name DeployProd \
  --transition-type Inbound
```

## 📈 DORA Metrics

### Target Metrics

| Metric                   | Current   | Target       | Elite                  |
| ------------------------ | --------- | ------------ | ---------------------- |
| **Deployment Frequency** | Weekly    | Daily        | Multiple times per day |
| **Lead Time**            | 3-4 hours | < 2 hours    | < 1 hour               |
| **Change Failure Rate**  | 15%       | < 5%         | < 5%                   |
| **Recovery Time**        | 2-3 hours | < 30 minutes | < 1 hour               |

### Metrics Collection

```bash
# Pipeline execution metrics
aws codepipeline list-pipeline-executions --pipeline-name manuel-backend-pipeline \
  --max-items 50 | jq '.pipelineExecutionSummaries[] | {status, startTime, lastUpdateTime}'

# Deployment frequency
aws cloudformation describe-stack-events --stack-name manuel-prod \
  --max-items 100 | jq '.StackEvents[] | select(.ResourceStatusReason | contains("UPDATE_COMPLETE"))'
```

## 🔒 Security Considerations

### Pipeline Security

- **IAM Roles**: Principle of least privilege
- **Secrets Management**: AWS Systems Manager Parameter Store
- **Code Scanning**: SAST with bandit, DAST capabilities
- **Dependency Scanning**: Safety for known vulnerabilities
- **Infrastructure Scanning**: AWS Config compliance

### Security Gates

```yaml
Security Checkpoints:
  - Pre-build: Dependency vulnerability scan
  - Build: Static code analysis (bandit)
  - Post-build: Infrastructure compliance check
  - Pre-deploy: Security test suite
  - Post-deploy: Runtime security validation
```

## 💰 Cost Optimization

### Pipeline Costs (Monthly)

| Service          | Estimated Cost | Optimization                      |
| ---------------- | -------------- | --------------------------------- |
| **CodePipeline** | $30-50         | Use efficient stage design        |
| **CodeBuild**    | $20-40         | Optimize build times, use caching |
| **CloudWatch**   | $10-20         | Set appropriate retention periods |
| **S3 Storage**   | $5-10          | Lifecycle policies for artifacts  |
| **Lambda**       | $5-15          | Right-size memory allocation      |

### Cost Monitoring

```bash
# Pipeline cost analysis
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --filter file://cost-filter.json
```

## 🆘 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Check build logs
aws logs describe-log-streams --log-group-name /aws/codebuild/manuel-build
aws logs get-log-events --log-group-name /aws/codebuild/manuel-build --log-stream-name <stream-name>

# Common fixes:
# 1. Check Python dependencies in requirements.txt
# 2. Verify buildspec.yml syntax
# 3. Check IAM permissions for CodeBuild role
```

#### Deployment Failures

```bash
# Check CloudFormation events
aws cloudformation describe-stack-events --stack-name manuel-dev

# Common fixes:
# 1. Verify parameter values in parameters-*.json
# 2. Check resource limits (Lambda concurrency, API Gateway throttling)
# 3. Validate SAM template syntax
```

#### Test Failures

```bash
# Check integration test results
aws codebuild batch-get-builds --ids <build-id>

# Common fixes:
# 1. Verify test environment configuration
# 2. Check test data and fixtures
# 3. Validate API endpoints accessibility
```

### Support Contacts

- **Pipeline Issues**: DevOps team
- **Application Issues**: Development team
- **Security Issues**: Security team
- **Cost Issues**: FinOps team

## 📚 Additional Resources

- [DEPLOYMENT_PIPELINE.md](specs/DEPLOYMENT_PIPELINE.md) - Detailed pipeline
  specification
- [CODE_QUALITY.md](CODE_QUALITY.md) - Code quality standards
- [COST_TRACKING.md](COST_TRACKING.md) - Cost management
- [MONITORING.md](MONITORING.md) - Monitoring and observability
- [SECURITY.md](SECURITY.md) - Security guidelines

---

**Next Steps**: After successful pipeline deployment, proceed with application
development following the established CI/CD workflow.
