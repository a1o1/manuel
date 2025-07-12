#!/bin/bash

# Manuel API Testing Script using curl
# This script helps test the query functionality once you have authentication set up

set -e

API_BASE_URL="https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod"
QUERY="How do I adjust microtiming on the analog rytm?"

echo "🚀 Manuel API Testing with curl"
echo "==============================="
echo ""

# Test 1: Health check (no auth required)
echo "🔍 Testing health endpoint..."
curl -s -X GET "$API_BASE_URL/health" | jq '.' || echo "Health endpoint failed or jq not installed"
echo ""

# Test 2: Query endpoint (requires auth)
echo "🔍 Testing query endpoint without authentication..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "$API_BASE_URL/query" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$QUERY\", \"include_sources\": true}")

HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo $RESPONSE | sed -E 's/HTTPSTATUS:[0-9]{3}$//')

echo "Status: $HTTP_STATUS"
echo "Response: $BODY" | jq '.' 2>/dev/null || echo "Response: $BODY"
echo ""

if [ "$HTTP_STATUS" = "403" ] || [ "$HTTP_STATUS" = "401" ]; then
    echo "✅ As expected, query endpoint requires authentication"
    echo ""
    echo "📋 Next Steps to Test the Query:"
    echo ""
    echo "1. Get your CloudFormation stack outputs:"
    echo "   aws cloudformation describe-stacks --stack-name YOUR_STACK_NAME --region eu-west-1 --query 'Stacks[0].Outputs'"
    echo ""
    echo "2. Find UserPoolId and UserPoolClientId values"
    echo ""
    echo "3. Create a test user:"
    echo "   aws cognito-idp admin-create-user \\"
    echo "     --user-pool-id YOUR_USER_POOL_ID \\"
    echo "     --username test@example.com \\"
    echo "     --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true \\"
    echo "     --temporary-password TempPassword123! \\"
    echo "     --message-action SUPPRESS \\"
    echo "     --region eu-west-1"
    echo ""
    echo "4. Set permanent password:"
    echo "   aws cognito-idp admin-set-user-password \\"
    echo "     --user-pool-id YOUR_USER_POOL_ID \\"
    echo "     --username test@example.com \\"
    echo "     --password TestPassword123! \\"
    echo "     --permanent \\"
    echo "     --region eu-west-1"
    echo ""
    echo "5. Get authentication token (requires AWS SDK or cognito CLI):"
    echo "   # This is complex with curl alone, recommend using the Node.js script"
    echo "   node authenticate.js"
    echo ""
    echo "6. Test the query with authentication:"
    echo "   curl -X POST \"$API_BASE_URL/query\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" \\"
    echo "     -d '{\"query\": \"$QUERY\", \"include_sources\": true}'"
    echo ""
else
    echo "❌ Unexpected response from query endpoint"
fi

echo "💡 Alternative: Use the CLI once built:"
echo "   cd /Users/alanoleary/dev/personal/manuel/frontend/packages/cli-app"
echo "   npm run start -- auth login --email test@example.com"
echo "   npm run start -- ask \"$QUERY\" --sources --verbose"
echo ""

echo "🎯 Expected Query Result:"
echo "The query should return information about adjusting microtiming on the Elektron Analog Rytm MKII,"
echo "including references to specific sections in the manual and usage/cost information."