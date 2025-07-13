# Manuel Project - Voice Assistant for Product Manuals

## Project Overview

- Voice-powered assistant for querying product manuals using AWS services
- Backend: AWS-native (Bedrock, S3, Transcribe, Cognito, Lambda, API Gateway)
- Frontend: React Native iOS with Expo + CLI interface
- Architecture: RAG system with Bedrock Knowledge Base
- Target Region: eu-west-1 (Dublin, Ireland)

## 🎉 Major Milestone Achieved: End-to-End Voice Query System

**Status: ✅ FULLY FUNCTIONAL**

The complete voice query pipeline is now working end-to-end:
- ✅ Audio recording with CLI (sox integration)
- ✅ AWS Transcribe speech-to-text conversion
- ✅ RAG-based Knowledge Base querying
- ✅ Source attribution and cost tracking
- ✅ Automatic cleanup and error handling

**Test Command:** `manuel query voice`

## Development Commands

### Backend

- Build backend: `sam build`
- Deploy backend (minimal template):
  `sam deploy --template-file template-minimal.yaml --resolve-s3 --parameter-overrides "Stage=dev TextModelId=eu.anthropic.claude-sonnet-4-20250514-v1:0 UseInferenceProfile=true" --no-confirm-changeset`
- Deploy production:
  `sam deploy --parameter-overrides-file backend/parameters-production.json`
- Deploy with Claude 4:
  `sam deploy --parameter-overrides-file backend/parameters-claude4.json`
- Test backend: `npm test` (in backend directory)

### Frontend

- Run iOS app: `expo start` (in frontend directory)
- Build CLI: `cd frontend/packages/cli-app && npm run build`
- Install CLI globally: `cd frontend/packages/cli-app && npm install -g .`
- Test CLI: `manuel --help`
- Lint frontend: `npm run lint`

### CLI Commands

- Authentication: `manuel auth login/logout/status`
- **Text queries: `manuel ask "question"` or `manuel query ask "question"`**
- **Voice queries: `manuel query voice`** ✅ **WORKING END-TO-END**
- Manage manuals: `manuel manuals list/upload/download`
- Bootstrap system: `manuel bootstrap populate/clear/status`
- Monitor ingestion: `manuel ingestion status/job/files`
- View usage: `manuel usage today/week/month`
- Configuration: `manuel config get/set`

### Alternative Test CLI

- Simple CLI: `node backend/test_cli.js` (simpler interface, same functionality)

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
- Implement user data isolation using metadata filtering
- Prefer AWS-native solutions over third-party services
- Enable X-Ray tracing in production for distributed tracing
- Use CloudWatch structured logging for observability

## Model Configuration

- Current Text Model: Claude Sonnet 4
  (`eu.anthropic.claude-sonnet-4-20250514-v1:0`)
- Current Embedding Model: Amazon Titan Text Embeddings V2
  (`amazon.titan-embed-text-v2:0`)
- Inference Profile: Enabled for cross-region availability
- Model switching: Use parameter files for easy upgrades

## Key File Locations

- Backend specs: `backend/specs/`
- Lambda functions: `backend/src/functions/`
  - `bootstrap/` - Smart bootstrap with deduplication
  - `ingestion-status/` - Ingestion job monitoring
  - `process-manual-simple/` - Automatic S3 → Knowledge Base sync
- Shared utilities: `backend/src/shared/`
  - `file_tracker.py` - File deduplication system
- Parameter files: `backend/parameters*.json`
- Frontend components: `frontend/src/components/`
- Frontend CLI: `frontend/packages/cli-app/src/commands/`
  - `ingestion.ts` - Ingestion monitoring commands
  - `bootstrap.ts` - Bootstrap system commands
- Frontend mock services: `frontend/packages/ios-app/src/services/mock/`
- AWS templates: `backend/template.yaml` + `backend/template-minimal.yaml`
- Pipeline infrastructure: `backend/pipeline-template.yaml`
- Improvement plan: `backend/BACKEND_IMPROVEMENT_PLAN.md`
- User isolation docs: `backend/METADATA_FILTERING_IMPLEMENTATION.md`

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
- Ingestion Monitoring: Real-time tracking of Knowledge Base ingestion jobs
- File Deduplication: S3 ETag-based tracking to prevent duplicate processing

## Testing Requirements

- Run tests before any commits
- Test quota enforcement for all API endpoints
- Validate audio processing with various file formats
- Check authentication flows thoroughly
- Test user data isolation and metadata filtering
- Verify frontend mock services and user switching
- Test ingestion monitoring and deduplication systems
- Verify bootstrap process skips already-ingested files
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

## Ingestion Monitoring & Deduplication

### Overview

- **Real-time tracking** of AWS Bedrock Knowledge Base ingestion jobs
- **File deduplication** prevents processing identical files multiple times
- **Cost optimization** through smart ingestion job management
- **Complete transparency** into file processing status

### Key Features

**Ingestion Job Tracking:**

- All ingestion jobs stored in DynamoDB with status updates
- Job progress tracking from STARTED → IN_PROGRESS → COMPLETE/FAILED
- Real-time status synchronization with AWS Bedrock
- 7-day TTL for automatic cleanup

**File Deduplication System:**

- S3 ETag-based file content tracking (changes when file content changes)
- Prevents duplicate ingestion of identical files
- Tracks file metadata: ETag, size, last_modified, ingestion_status
- 30-day file tracking retention
- Smart retry logic for failed ingestions

**CLI Commands:**

- `manuel ingestion status` - View all recent ingestion jobs
- `manuel ingestion job <job-id>` - Get detailed job information
- `manuel ingestion files` - Show deduplication system status
- `manuel bootstrap populate` - Smart bootstrap with deduplication

### Technical Implementation

**File Tracking Storage:**

- DynamoDB composite key: `file_tracker#{s3_key}` + `metadata`
- Tracks: ETag, file size, ingestion job ID, status, timestamps
- Automatic TTL cleanup after 30 days

**Deduplication Logic:**

- Compare S3 ETag with stored file tracking record
- Skip ingestion if file unchanged and previously completed
- Retry ingestion if previous job failed or file content changed
- Support for multipart vs single-part upload ETag differences

**Status Updates:**

- Real-time job status polling from AWS Bedrock Agent API
- Automatic DynamoDB updates when status changes
- File tracking status synchronization with job completion

### Benefits

- **Cost Savings:** Eliminates duplicate ingestion processing costs
- **Performance:** Faster bootstrap operations skip processed files
- **Reliability:** Failed job tracking enables smart retry logic
- **Transparency:** Complete visibility into ingestion pipeline
- **Efficiency:** Only new or modified files trigger ingestion jobs

## Voice Query System ✅ FULLY FUNCTIONAL

### Overview

The voice query system provides end-to-end audio processing, enabling users to ask questions about their manuals using voice input. The system integrates AWS Transcribe for speech-to-text conversion with the existing RAG-based query pipeline.

### Voice Query Workflow

1. **Audio Recording:** CLI captures audio using platform-native tools (sox on macOS/Linux)
2. **Audio Upload:** Base64-encoded audio uploaded to S3 temp storage
3. **Transcription:** AWS Transcribe converts speech to text
4. **Query Processing:** Transcribed text processed through Knowledge Base RAG system
5. **Response:** Answer returned with sources and metadata
6. **Cleanup:** Temporary audio files automatically removed

### Technical Implementation

**Audio Recording:**
- Platform detection: Node.js CLI uses sox, React Native uses Expo AV
- Configurable duration (default 30 seconds)
- High-quality recording: 44.1kHz, 16-bit, mono
- Real-time recording controls (start/stop/pause)

**Transcription Pipeline:**
- AWS Transcribe integration with job polling
- Support for multiple audio formats (WAV, MP3, MP4, FLAC)
- Real-time job status monitoring
- Automatic cleanup of S3 temporary files and transcription jobs

**Query Integration:**
- Seamless integration with existing query function
- Same response format as text queries
- Full source attribution and cost tracking
- User quota enforcement for audio processing

### CLI Usage

```bash
# Start voice query (default 30s recording)
manuel query voice

# Custom recording duration
manuel query voice --duration 10

# Include source information
manuel query voice --sources

# Interactive voice chat mode
manuel query interactive
```

### Dependencies

**System Requirements:**
- macOS/Linux: sox audio utility (`brew install sox`)
- Node.js: Built-in audio processing
- AWS: Transcribe, S3, Bedrock services

**Audio Processing:**
- No external audio libraries required for CLI
- Uses platform-native audio utilities
- Automatic permission handling and error recovery

### Error Handling

- **Audio Permission Errors:** Clear messaging for microphone access
- **Recording Failures:** Automatic cleanup and retry logic
- **Transcription Errors:** Fallback to text input with error context
- **Network Issues:** Retry logic with exponential backoff
- **Service Limits:** Quota enforcement with helpful messaging

### Performance Optimizations

- **Efficient Audio Encoding:** Base64 optimization for network transfer
- **Parallel Processing:** Audio upload and transcription job creation
- **Resource Cleanup:** Automatic S3 and Transcribe job cleanup
- **Caching:** Reuse audio service instances across requests
- **Standard Library Usage:** Replaced `requests` with `urllib` for better Lambda performance

### Troubleshooting

- Check ingestion logs: `/aws/lambda/manuel-ingestion-status-dev`
- Bootstrap logs: `/aws/lambda/manuel-bootstrap-dev`
- File tracking stored in DynamoDB table: `manuel-usage-dev`
- Typical ingestion time: 5-10 minutes for multi-MB PDFs
