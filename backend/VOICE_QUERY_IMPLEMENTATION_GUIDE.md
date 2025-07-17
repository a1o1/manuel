# Voice Query Implementation Guide - Working Solution

## 🎉 Status: FULLY FUNCTIONAL ✅

This document captures the exact working implementation of the voice query system after extensive debugging and optimization. Use this as a reference for future implementations or troubleshooting.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Critical Design Decisions](#critical-design-decisions)
3. [Key Components](#key-components)
4. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
5. [Debugging Guide](#debugging-guide)
6. [Deployment Checklist](#deployment-checklist)
7. [Testing Procedures](#testing-procedures)

## Architecture Overview

### High-Level Flow
```
CLI/iOS App → API Gateway → QueryFunction → AWS Transcribe → Bedrock Knowledge Base → Response
```

### Key Architectural Principles

1. **Single Function Approach**: Voice transcription is handled within the QueryFunction, not a separate TranscribeFunction
2. **No VPC Configuration**: QueryFunction runs outside VPC for direct AWS service access
3. **Optimized for API Gateway Timeout**: Polling designed to complete within 30-second limit
4. **AudioBucket Strategy**: Uses dedicated audio bucket with pre-configured permissions

## Critical Design Decisions

### 1. Bucket Strategy: AudioBucket vs ManualsBucket

**✅ WORKING SOLUTION:**
- Use `AUDIO_BUCKET` environment variable
- Points to: `manuel-audio-dev-455574531460`
- Has existing bucket policy for AWS Transcribe access

**❌ FAILED APPROACHES:**
- Using `MANUALS_BUCKET` - required manual bucket policy application
- Using fallback bucket `"manuel-temp-audio"` - bucket doesn't exist

**Code Implementation:**
```python
bucket_name = os.environ.get("AUDIO_BUCKET", "manuel-temp-audio")
audio_key = f"temp-audio/{job_name}.wav"
```

### 2. VPC Configuration: Outside VPC

**✅ WORKING SOLUTION:**
- QueryFunction has NO VPC configuration
- Direct internet access to AWS services
- No VPC endpoints required

**❌ FAILED APPROACHES:**
- VPC configuration with VPC endpoints
- Even with proper security groups and VPC endpoints, transcription failed

**Template Configuration:**
```yaml
# VpcConfig: !If
#   - EnableRedisCaching
#   - SecurityGroupIds:
#       - !Ref LambdaSecurityGroup
#     SubnetIds:
#       - !Ref PrivateSubnet1
#       - !Ref PrivateSubnet2
#   - !Ref AWS::NoValue
```

### 3. IAM Permissions: Comprehensive S3 + Transcribe

**✅ WORKING SOLUTION:**
```yaml
Policies:
  - S3WritePolicy:
      BucketName: !Ref ManualsBucket
  - S3ReadPolicy:
      BucketName: !Ref ManualsBucket
  - S3WritePolicy:
      BucketName: !Ref AudioBucket
  - S3ReadPolicy:
      BucketName: !Ref AudioBucket
  - Statement:
    - Effect: Allow
      Action:
        - transcribe:StartTranscriptionJob
        - transcribe:GetTranscriptionJob
        - transcribe:DeleteTranscriptionJob
      Resource: "*"
```

**❌ FAILED APPROACHES:**
- Only S3WritePolicy without S3ReadPolicy
- Missing transcribe:DeleteTranscriptionJob permission
- Trying to rely on bucket policy alone

### 4. Timeout Optimization: API Gateway Constraints

**✅ WORKING SOLUTION:**
- 6 polling attempts maximum
- 4-second intervals between checks
- Total max time: 24 seconds (under 30-second API Gateway limit)

**❌ FAILED APPROACHES:**
- 30 attempts × 10 seconds = 300 seconds (far exceeds API Gateway timeout)
- Longer Lambda timeout doesn't help due to API Gateway hard limit

**Code Implementation:**
```python
# Poll for completion with shorter intervals for API Gateway timeout
max_attempts = 6  # 25 seconds max (6 attempts × 4 seconds = 24 seconds)
for attempt in range(max_attempts):
    # ... polling logic ...
    time.sleep(4)  # Wait 4 seconds before next check
```

## Key Components

### 1. S3 Bucket Policy (AudioBucket)

**Essential Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "transcribe.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::manuel-audio-dev-455574531460/temp-audio/*"
    }
  ]
}
```

**Verification Command:**
```bash
aws s3api get-bucket-policy --bucket manuel-audio-dev-455574531460 --region eu-west-1
```

### 2. QueryFunction Environment Variables

**Required Variables:**
```yaml
Environment:
  Variables:
    AUDIO_BUCKET: !Ref AudioBucket  # Critical: NOT MANUALS_BUCKET
    MANUALS_BUCKET: !Ref ManualsBucket  # For other operations
    KNOWLEDGE_BASE_ID: !Ref BedrockKnowledgeBase
    # ... other variables
```

### 3. Transcription Function (within QueryFunction)

**Core Logic:**
```python
def transcribe_audio(audio_data: str, content_type: str) -> str:
    # 1. Use AUDIO_BUCKET environment variable
    bucket_name = os.environ.get("AUDIO_BUCKET", "manuel-temp-audio")
    
    # 2. Upload to temp-audio/ prefix
    audio_key = f"temp-audio/{job_name}.wav"
    
    # 3. Start transcription job
    audio_uri = f"s3://{bucket_name}/{audio_key}"
    transcribe_client.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={"MediaFileUri": audio_uri},
        MediaFormat=media_format,
        LanguageCode="en-US"
    )
    
    # 4. Optimized polling (6 attempts × 4 seconds)
    max_attempts = 6
    for attempt in range(max_attempts):
        # ... check status ...
        time.sleep(4)
```

## Common Pitfalls & Solutions

### Pitfall 1: "S3 URI can't be accessed" Error

**Root Cause:** Incorrect bucket or missing permissions

**Solutions Tried:**
1. ❌ Adding bucket policy to ManualsBucket
2. ❌ Using VPC endpoints for S3 access
3. ✅ **WORKING**: Switch to AudioBucket with existing policy

**Debugging Steps:**
1. Check which bucket is being used in logs
2. Verify bucket policy exists: `aws s3api get-bucket-policy --bucket <bucket-name>`
3. Test transcription manually: `aws transcribe start-transcription-job`

### Pitfall 2: API Gateway Timeout (504 Error)

**Root Cause:** Transcription polling exceeds 30-second API Gateway limit

**Solutions Tried:**
1. ❌ Increasing Lambda timeout (doesn't help with API Gateway)
2. ✅ **WORKING**: Optimize polling to 24 seconds maximum

**Warning Signs:**
- Error: "Endpoint request timed out"
- Status: 504 Gateway Timeout
- Transcription actually working but timing out

### Pitfall 3: VPC Networking Issues

**Root Cause:** VPC configuration blocking AWS service access

**Solutions Tried:**
1. ❌ Adding VPC endpoints for all services
2. ❌ Configuring security group egress rules
3. ✅ **WORKING**: Remove VPC configuration entirely

**Key Insight:** Voice queries don't need Redis caching, so VPC isn't required

### Pitfall 4: Permissions Complexity

**Root Cause:** Incomplete IAM permissions

**Solutions Tried:**
1. ❌ Only S3WritePolicy
2. ❌ Missing transcribe:DeleteTranscriptionJob
3. ✅ **WORKING**: Comprehensive read/write permissions

**Debug Command:**
```bash
# Check actual Lambda role permissions
aws iam list-role-policies --role-name <lambda-role-name>
aws iam get-role-policy --role-name <lambda-role-name> --policy-name <policy-name>
```

## Debugging Guide

### 1. Voice Query Failing: "Failed to transcribe audio"

**Check List:**
1. **Bucket Policy**: Verify AudioBucket has transcribe policy
2. **Environment Variables**: Confirm AUDIO_BUCKET is set correctly
3. **IAM Permissions**: Ensure comprehensive S3 + Transcribe permissions
4. **VPC Configuration**: Should be disabled for QueryFunction

**Debug Commands:**
```bash
# Check logs
aws logs tail /aws/lambda/manuel-query-dev --since 5m --region eu-west-1

# Test transcription manually
aws transcribe start-transcription-job \
  --transcription-job-name test-manual-$(date +%s) \
  --media MediaFileUri=s3://manuel-audio-dev-455574531460/temp-audio/test-file.wav \
  --media-format wav \
  --language-code en-US
```

### 2. API Gateway Timeout (504)

**Check List:**
1. **Polling Configuration**: Max 6 attempts × 4 seconds
2. **Audio Length**: Shorter clips work better
3. **Transcription Speed**: Check AWS Transcribe processing time

**Debug Approach:**
1. Check if transcription job actually completes
2. Verify polling intervals in code
3. Test with very short audio clips first

### 3. Permissions Issues

**Check List:**
1. **Lambda Role**: Has both read and write S3 permissions
2. **Bucket Policy**: Allows transcribe.amazonaws.com
3. **Service Access**: No VPC blocking AWS services

**Debug Commands:**
```bash
# Check Lambda role
aws cloudformation describe-stack-resources --stack-name manuel-dev --logical-resource-id QueryFunctionRole

# Check policies
aws iam list-attached-role-policies --role-name <role-name>
aws iam list-role-policies --role-name <role-name>
```

## Deployment Checklist

### Pre-Deployment
- [ ] Verify AudioBucket exists and has correct policy
- [ ] Confirm QueryFunction has no VPC configuration
- [ ] Check all required environment variables are set
- [ ] Validate IAM permissions in template

### Deployment
```bash
# Build and deploy
sam build QueryFunction
sam deploy --stack-name manuel-dev --resolve-s3 --capabilities CAPABILITY_NAMED_IAM --no-confirm-changeset
```

### Post-Deployment
- [ ] Test voice query with short audio clip
- [ ] Check CloudWatch logs for any errors
- [ ] Verify bucket policy is still in place
- [ ] Test both CLI and iOS app interfaces

## Testing Procedures

### 1. Basic Functionality Test

**CLI Test:**
```bash
# From frontend directory
npm run cli query voice
```

**iOS App Test:**
1. Open iOS app
2. Navigate to Voice Query screen
3. Record short audio (3-5 seconds)
4. Verify transcription and answer

### 2. Edge Case Testing

**Test Cases:**
1. **Short audio** (1-2 seconds): Should work quickly
2. **Medium audio** (5-10 seconds): Should work within timeout
3. **Long audio** (30+ seconds): Should timeout gracefully
4. **Invalid audio**: Should handle errors gracefully

### 3. Performance Testing

**Metrics to Check:**
- Transcription completion time
- API Gateway response time
- CloudWatch logs for errors
- S3 bucket usage

## Configuration Reference

### Working Template Configuration (Key Sections)

```yaml
QueryFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub manuel-query-${Stage}
    CodeUri: src/functions/query/
    Handler: app.lambda_handler
    Timeout: !Ref QueryTimeout
    # NO VPC CONFIG - Critical for voice queries
    Environment:
      Variables:
        AUDIO_BUCKET: !Ref AudioBucket  # Use AudioBucket, not ManualsBucket
        MANUALS_BUCKET: !Ref ManualsBucket
        KNOWLEDGE_BASE_ID: !Ref BedrockKnowledgeBase
    Policies:
      - S3WritePolicy:
          BucketName: !Ref ManualsBucket
      - S3ReadPolicy:
          BucketName: !Ref ManualsBucket
      - S3WritePolicy:
          BucketName: !Ref AudioBucket
      - S3ReadPolicy:
          BucketName: !Ref AudioBucket
      - Statement:
        - Effect: Allow
          Action:
            - transcribe:StartTranscriptionJob
            - transcribe:GetTranscriptionJob
            - transcribe:DeleteTranscriptionJob
          Resource: "*"
```

### Working Parameters

```json
{
  "QueryTimeout": "120",
  "Stage": "dev",
  "EnableRedisCache": "true"
}
```

## Success Criteria

### ✅ Voice Query Working When:
1. Short audio clips (3-5 seconds) transcribe and respond within 10-15 seconds
2. Medium audio clips (5-10 seconds) complete within 20-25 seconds
3. Long audio clips timeout gracefully with helpful error message
4. Both CLI and iOS app interfaces work consistently
5. CloudWatch logs show successful transcription job completion
6. No 504 Gateway Timeout errors for normal usage

### ❌ Warning Signs of Problems:
1. "S3 URI can't be accessed" errors
2. 504 Gateway Timeout for short audio clips
3. Transcription jobs stuck in "IN_PROGRESS" state
4. Missing AUDIO_BUCKET environment variable
5. VPC configuration preventing AWS service access

## Maintenance Notes

### Regular Checks
- Monitor AudioBucket policy remains intact
- Check CloudWatch logs for recurring errors
- Verify S3 bucket cleanup is working (temp files deleted)
- Monitor API Gateway timeout rates

### Future Improvements
- Consider implementing asynchronous transcription for longer clips
- Add caching for repeated audio clips
- Implement more sophisticated error handling
- Add retry logic for transient failures

---

## Summary

The key to the working solution was:

1. **Use AudioBucket** (not ManualsBucket) with existing transcribe policy
2. **No VPC configuration** for direct AWS service access
3. **Comprehensive IAM permissions** (both read/write S3 + transcribe)
4. **Optimized polling** (6 attempts × 4 seconds = 24 seconds max)
5. **Proper debugging approach** using CLI transcribe tests to isolate issues

This implementation successfully handles voice queries end-to-end within API Gateway timeout constraints while maintaining reliability and performance.