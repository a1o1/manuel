# Backend Migration Plan: Minimal to Full Enterprise

## Overview

This document outlines the migration strategy from the minimal backend
configuration to the full enterprise-grade backend with all features enabled.

## Current State (Minimal Backend)

### Deployed Resources

- **Stack**: `manuel-dev-minimal`
- **Template**: `template-minimal.yaml`
- **Resources**:
  - Cognito User Pool (authentication only)
  - Health check endpoint
  - Basic API Gateway

### Active Features

- Basic authentication via Cognito
- Health monitoring endpoint
- CORS configuration

## Target State (Full Enterprise Backend)

### Additional Resources

1. **Core Application Services**

   - Lambda functions (Query, Upload, List, Bootstrap, etc.)
   - DynamoDB tables (Usage, FileTracking, IngestionJobs)
   - S3 bucket for manuals storage
   - Bedrock Knowledge Base with vector store
   - Transcribe for audio processing

2. **Enterprise Features**

   - **Security**:

     - WAF integration
     - Rate limiting with DynamoDB
     - HMAC request signing
     - IP allowlisting
     - Advanced threat protection

   - **Performance**:

     - Redis caching (ElastiCache)
     - Connection pooling
     - Optimized Lambda configurations
     - CloudFront distribution

   - **Error Handling**:

     - Dead Letter Queues (DLQ)
     - Error tracking table
     - SNS notifications
     - Retry mechanisms

   - **Monitoring & Observability**:
     - CloudWatch Dashboard
     - X-Ray tracing
     - Custom metrics
     - Cost tracking
     - Alerting via SNS

## Migration Strategy

### Phase 1: Pre-Migration Preparation

1. **Backup Current State** ✅

   - `template-minimal-backup.yaml`
   - `samconfig-minimal-backup.toml`

2. **Create Migration Parameters**

   ```bash
   # Create parameters-migration.json with minimal features enabled
   cp parameters.json parameters-migration.json
   # Edit to disable advanced features initially
   ```

3. **Update SAM Configuration**
   - Create new samconfig section for full deployment
   - Keep minimal config as fallback

### Phase 2: Incremental Migration

#### Step 1: Deploy Core Services (Week 1)

```bash
# Deploy with core services only
sam deploy --template template.yaml \
  --parameter-overrides-file parameters-migration.json \
  --stack-name manuel-dev-full
```

**Resources Added**:

- Lambda functions
- DynamoDB tables
- S3 bucket
- Basic Bedrock Knowledge Base

#### Step 2: Enable Monitoring (Week 2)

- Enable CloudWatch Dashboard
- Configure basic alerts
- Enable X-Ray tracing (test environment)

#### Step 3: Add Performance Features (Week 3)

- Enable Redis caching
- Configure connection pooling
- Optimize Lambda memory/timeout

#### Step 4: Enable Security Features (Week 4)

- Configure WAF rules
- Enable rate limiting
- Set up IP allowlisting (if needed)

### Phase 3: Testing & Validation

1. **Functional Testing**

   - Test all API endpoints
   - Verify authentication flows
   - Test file uploads and queries
   - Validate voice query functionality

2. **Performance Testing**

   - Load testing with expected traffic
   - Measure response times
   - Verify caching effectiveness

3. **Security Testing**
   - Test rate limiting
   - Verify WAF rules
   - Test error handling

### Phase 4: Production Cutover

1. **Pre-Cutover Checklist**

   - All tests passing
   - Monitoring alerts configured
   - Rollback plan documented
   - Team trained on new features

2. **Cutover Process**
   ```bash
   # Update DNS/routing to point to new stack
   # Monitor for 24 hours
   # Keep minimal stack running as backup
   ```

## Rollback Procedures

### Immediate Rollback (< 1 hour)

```bash
# Point traffic back to minimal stack
# No data migration needed
```

### Standard Rollback (> 1 hour)

1. Export any new data from DynamoDB
2. Switch traffic to minimal stack
3. Investigate issues
4. Re-attempt migration with fixes

### Emergency Rollback Script

```bash
#!/bin/bash
# rollback-to-minimal.sh

# 1. Update API Gateway custom domain
aws apigateway update-base-path-mapping \
  --domain-name api.manuel.example.com \
  --base-path "" \
  --patch-operations op=replace,path=/restApiId,value=<MINIMAL_API_ID>

# 2. Update Route53 if needed
# 3. Notify team
```

## Configuration Differences

### Parameters to Modify

| Parameter                     | Minimal | Full | Notes                      |
| ----------------------------- | ------- | ---- | -------------------------- |
| EnableAdvancedSecurity        | false   | true | Enable after basic testing |
| EnableAdvancedErrorHandling   | false   | true | Enable with monitoring     |
| EnablePerformanceOptimization | false   | true | Enable after load testing  |
| EnableXRayTracing             | false   | true | Start with dev only        |
| EnableWAF                     | false   | true | Configure rules carefully  |
| EnableRedisCache              | false   | true | Test cache hit rates       |

### Cost Implications

**Minimal Backend**: ~$10-20/month

- Cognito free tier
- Minimal API Gateway calls

**Full Backend**: ~$200-500/month (estimated)

- Redis cache: ~$50-100/month
- WAF: ~$20-50/month
- Enhanced monitoring: ~$20-30/month
- DynamoDB: ~$25-50/month
- Lambda/API Gateway: Usage-based

## Success Criteria

1. **Functional**

   - All endpoints responding correctly
   - Authentication working
   - File processing successful

2. **Performance**

   - API response time < 2s (p95)
   - Cache hit rate > 60%
   - Zero dropped requests

3. **Security**

   - No unauthorized access
   - Rate limiting effective
   - WAF blocking malicious requests

4. **Operational**
   - All alerts configured
   - Dashboard showing metrics
   - Cost within budget

## Timeline

- **Week 1-2**: Preparation and core services
- **Week 3-4**: Monitoring and performance features
- **Week 5-6**: Security features and testing
- **Week 7**: Production cutover
- **Week 8**: Monitoring and optimization

## Commands Reference

```bash
# Deploy minimal (current)
sam deploy --template template-minimal.yaml \
  --stack-name manuel-dev-minimal

# Deploy full (migration)
sam deploy --template template.yaml \
  --parameter-overrides-file parameters-migration.json \
  --stack-name manuel-dev-full

# Switch between stacks
./scripts/switch-stack.sh minimal|full

# Monitor migration
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 4XXError \
  --dimensions Name=ApiName,Value=manuel-api
```

## Risks and Mitigations

| Risk                      | Impact | Mitigation                  |
| ------------------------- | ------ | --------------------------- |
| Service disruption        | High   | Blue-green deployment       |
| Cost overrun              | Medium | Gradual feature enablement  |
| Performance degradation   | Medium | Load testing before cutover |
| Security misconfiguration | High   | Security review checklist   |

## Contact Information

- **Migration Lead**: [Your Name]
- **Emergency Contact**: [Phone/Email]
- **Escalation Path**: Dev Lead → CTO → AWS Support

---

Last Updated: 2025-07-13 Next Review: Before Phase 2 begins
