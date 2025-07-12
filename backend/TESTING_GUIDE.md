# Manuel CLI Query Testing Guide

## Overview

This guide provides step-by-step instructions to test the CLI query functionality for the Manuel project, specifically testing the query: "How do I adjust microtiming on the analog rytm?"

## Prerequisites

- Backend is deployed and accessible at: `https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod/`
- Knowledge Base ID: `TI45ECGEZQ`
- Elektron Analog Rytm MKII User Manual is already uploaded to the system
- AWS CLI access with appropriate permissions

## Step 1: Verify System Status

First, confirm the backend is healthy:

```bash
curl -X GET https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": 1752338046,
  "service": "manuel-backend",
  "version": "minimal-v1.0.0",
  "region": "eu-west-1",
  "environment": "dev"
}
```

## Step 2: Get Cognito User Pool Information

Find the Cognito User Pool ID and Client ID from your deployed stack:

```bash
# List CloudFormation stacks
aws cloudformation list-stacks --region eu-west-1 --query 'StackSummaries[?StackStatus!=`DELETE_COMPLETE`].StackName'

# Get stack outputs (replace STACK_NAME with your actual stack name)
aws cloudformation describe-stacks --stack-name STACK_NAME --region eu-west-1 --query 'Stacks[0].Outputs'
```

Look for outputs like:
- `UserPoolId`: The Cognito User Pool ID
- `UserPoolClientId`: The Cognito User Pool Client ID

## Step 3: Create a Test User

Create a test user in the Cognito User Pool:

```bash
# Replace USER_POOL_ID with your actual User Pool ID
aws cognito-idp admin-create-user \
  --user-pool-id USER_POOL_ID \
  --username test@example.com \
  --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS \
  --region eu-west-1
```

Set a permanent password:

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id USER_POOL_ID \
  --username test@example.com \
  --password TestPassword123! \
  --permanent \
  --region eu-west-1
```

## Step 4: Option A - Test via CLI (Recommended)

### Build and Set Up CLI

1. Navigate to the CLI directory:
```bash
cd /Users/alanoleary/dev/personal/manuel/frontend/packages/cli-app
```

2. First, fix the shared library exports:
```bash
cd ../shared/src
# The platform exports are already fixed in index.ts
```

3. Build the shared library:
```bash
cd ../shared
npm run build
```

4. Build the CLI:
```bash
cd ../cli-app
npm run build
```

5. If build fails due to TypeScript errors, you can run directly with ts-node:
```bash
npm run start
```

### Authenticate with CLI

```bash
# Use the CLI to login
npm run start -- auth login --email test@example.com

# Or run directly if built:
./dist/bin/manuel.js auth login --email test@example.com
```

### Test the Query

```bash
# Ask about microtiming on Analog Rytm
npm run start -- ask "How do I adjust microtiming on the analog rytm?" --sources --verbose

# Or use the query command directly:
npm run start -- query ask "How do I adjust microtiming on the analog rytm?" --sources --verbose
```

## Step 5: Option B - Test via Direct API Call

If the CLI has build issues, you can test directly with the API:

### Get Authentication Token

Create a script to authenticate and get tokens:

```javascript
// auth_test.js
const AWS = require('aws-sdk');

const cognito = new AWS.CognitoIdentityServiceProvider({
  region: 'eu-west-1'
});

async function authenticate() {
  const params = {
    AuthFlow: 'USER_SRP_AUTH',
    ClientId: 'YOUR_CLIENT_ID', // Replace with actual client ID
    AuthParameters: {
      USERNAME: 'test@example.com',
      PASSWORD: 'TestPassword123!'
    }
  };

  try {
    const result = await cognito.initiateAuth(params).promise();
    console.log('Authentication successful!');
    console.log('Access Token:', result.AuthenticationResult.AccessToken);
    return result.AuthenticationResult.AccessToken;
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

authenticate();
```

### Make Query Request

```bash
# Replace ACCESS_TOKEN with the token from above
curl -X POST https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{
    "query": "How do I adjust microtiming on the analog rytm?",
    "include_sources": true
  }'
```

## Step 6: Verify Manual in Knowledge Base

If the query doesn't return results, verify the manual is properly ingested:

### Check if Manual Needs Ingestion

The manual might be uploaded to S3 but not yet ingested into the Knowledge Base. Check the process-manual function logs:

```bash
aws logs describe-log-groups --region eu-west-1 --log-group-name-prefix "/aws/lambda/manuel"
```

### Manually Trigger Knowledge Base Sync

If needed, you can trigger the manual processing:

```bash
# Check S3 bucket contents
aws s3 ls s3://YOUR-MANUALS-BUCKET/ --region eu-west-1

# Check Knowledge Base sync status
aws bedrock-agent get-knowledge-base --knowledge-base-id TI45ECGEZQ --region eu-west-1
```

## Expected Results

When the query works correctly, you should see:

1. **Query Response**: Detailed explanation about adjusting microtiming on the Elektron Analog Rytm MKII
2. **Sources**: References to specific sections of the manual
3. **Usage Information**: Daily/monthly query counts
4. **Cost Information**: Request cost breakdown

Example expected response structure:
```json
{
  "response": "To adjust microtiming on the Elektron Analog Rytm MKII, you can...",
  "sources": [
    {
      "content": "Microtiming settings can be found in...",
      "metadata": {
        "source": "Elektron Analog Rytm MKII User Manual",
        "score": 0.95
      }
    }
  ],
  "usage": {
    "daily_queries": 1,
    "daily_limit": 100,
    "monthly_queries": 1,
    "monthly_limit": 1000
  },
  "costs": {
    "total_cost": 0.0023
  }
}
```

## Troubleshooting

### CLI Build Issues
- If TypeScript compilation fails, use `npm run start` instead of building
- Check that all dependencies are installed: `npm install`
- Verify shared library builds successfully

### Authentication Issues
- Verify User Pool ID and Client ID are correct
- Ensure the user exists and password is set correctly
- Check that the user is confirmed (not in temporary password state)

### Query Returns No Results
- Verify the Knowledge Base contains the manual
- Check CloudWatch logs for the query function
- Ensure the manual was properly processed and indexed

### API Gateway Errors
- 403 errors indicate authentication issues
- 500 errors check Lambda function logs
- 429 errors indicate rate limiting

## Manual Content Check

The Elektron Analog Rytm MKII manual should contain information about:
- Microtiming adjustments
- Timing settings
- Per-step timing modifications
- Global timing parameters

If the query returns unexpected results, it may indicate:
1. The manual hasn't been fully processed
2. The query needs refinement
3. The Knowledge Base indexing needs to be verified

## Next Steps

After successful testing:
1. Document the exact query response
2. Test additional queries about the Analog Rytm
3. Verify user isolation (each user only sees their own manuals)
4. Test voice query functionality if needed
