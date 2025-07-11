# Manuel Project - Voice Assistant for Product Manuals

## Project Overview

- Voice-powered assistant for querying product manuals using AWS services
- Backend: AWS-native (Bedrock, S3, Transcribe, Cognito, Lambda, API Gateway)
- Frontend: React Native iOS with Expo
- Architecture: RAG system with Bedrock Knowledge Base
- Target Region: eu-west-1 (Dublin, Ireland)

## Development Commands

- Build backend: `sam build`
- Deploy backend:
  `sam deploy --parameter-overrides-file backend/parameters.json`
- Deploy production:
  `sam deploy --parameter-overrides-file backend/parameters-production.json`
- Deploy with Claude 4:
  `sam deploy --parameter-overrides-file backend/parameters-claude4.json`
- Test backend: `npm test` (in backend directory)
- Run frontend: `expo start` (in frontend directory)
- Lint frontend: `npm run lint`

## Code Style & Conventions

- Use 2-space indentation for JavaScript/TypeScript
- Use 4-space indentation for Python (Lambda functions)
- Follow AWS Lambda best practices for error handling
- Use TypeScript for React Native components
- Prefer async/await over promises
- Use structured logging with JSON format for all Lambda functions
- Always include request correlation IDs in logs

## Architecture Guidelines

- All AWS services should be in the same region (eu-west-1)
- Use Cognito for authentication, not custom auth
- Implement user quotas via DynamoDB before expensive operations
- Use Bedrock Knowledge Base for RAG, not custom vector DB
- Prefer AWS-native solutions over third-party services
- Enable X-Ray tracing in production for distributed tracing
- Use CloudWatch structured logging for observability

## Model Configuration

- Current Text Model: Claude 3.5 Sonnet
  (`anthropic.claude-3-5-sonnet-20241022-v2:0`)
- Current Embedding Model: Amazon Titan Text Embeddings V2
  (`amazon.titan-embed-text-v2:0`)
- Claude 4 Support: Ready for upgrade when available in eu-west-1
- Model switching: Use parameter files for easy upgrades

## Key File Locations

- Backend specs: `backend/specs/`
- Lambda functions: `backend/src/functions/`
- Shared utilities: `backend/src/shared/`
- Parameter files: `backend/parameters*.json`
- Frontend components: `frontend/src/components/`
- AWS templates: `backend/template.yaml`
- Pipeline infrastructure: `backend/pipeline-template.yaml`
- Improvement plan: `backend/BACKEND_IMPROVEMENT_PLAN.md`

## Parameter Files

- `parameters.json` - Development environment (basic resources, no email alerts)
- `parameters-production.json` - Production environment (enhanced performance,
  email alerts)
- `parameters-claude4.json` - Claude 4 testing (conservative quotas, enhanced
  monitoring)

## Monitoring & Observability

- CloudWatch Dashboard: Real-time application metrics and performance
- Structured Logging: JSON-formatted logs with correlation IDs and business
  metrics
- Custom Metrics: Business KPIs (quota usage, token consumption, response times)
- Alerting: SNS notifications for errors, latency, and quota issues
- X-Ray Tracing: Distributed request tracing (configurable via parameters)

## Testing Requirements

- Run tests before any commits
- Test quota enforcement for all API endpoints
- Validate audio processing with various file formats
- Check authentication flows thoroughly
- Monitor CloudWatch dashboards after deployments
- Verify structured logging is working correctly

## Deployment Notes

- Use TestFlight for iOS app distribution
- Monitor AWS costs due to Bedrock usage
- Set up CloudWatch alerts for quota violations
- Configure spend alerts for cost management
- Always deploy with parameter files for consistency
- Check CloudWatch dashboard after each deployment

## Monitoring Access

- Dashboard URL: Available in CloudFormation outputs as `DashboardURL`
- Log Groups: `/aws/lambda/manuel-*-{stage}`
- Alert Topic: SNS topic ARN in CloudFormation outputs as `AlertTopicArn`

## Cost Tracking & Management

- Real-time cost calculation and tracking for all AWS services
- Cost-per-request returned in API responses with detailed breakdown
- CloudWatch cost metrics and dashboard widgets
- Cost alerting with configurable thresholds
- Historical cost data stored in DynamoDB
- Service-specific cost attribution (Bedrock, Transcribe, Lambda, etc.)

## Key Environment Variables (Lambda)

- `TEXT_MODEL_ID` - Bedrock text generation model
- `EMBEDDING_MODEL_ID` - Bedrock embedding model
- `KNOWLEDGE_BASE_RETRIEVAL_RESULTS` - Number of KB results to retrieve
- `USAGE_DATA_RETENTION_DAYS` - DynamoDB TTL for usage data
- `USE_INFERENCE_PROFILE` - Whether to use cross-region inference profiles

## Cost Management

- View detailed cost documentation: `backend/COST_TRACKING.md`
- Daily cost thresholds: Configurable per environment
- Request cost thresholds: Alert on expensive individual requests
- Cost optimization strategies: Model selection, token management, caching
