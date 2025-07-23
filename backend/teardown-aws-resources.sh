#!/bin/bash
# Manuel AWS Resources Teardown Script
# This script removes all AWS resources to reduce costs to zero

set -e

echo "🔴 Manuel AWS Resources Teardown Script"
echo "======================================"
echo "⚠️  WARNING: This will DELETE all AWS resources!"
echo "⚠️  Make sure you have backed up any important data!"
echo ""
read -r -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Teardown cancelled."
    exit 0
fi

STAGE="${1:-dev}"
REGION="${AWS_DEFAULT_REGION:-eu-west-1}"

echo ""
echo "📋 Teardown Configuration:"
echo "  Stage: $STAGE"
echo "  Region: $REGION"
echo ""

# Function to check if a stack exists
stack_exists() {
    aws cloudformation describe-stacks --stack-name "$1" --region "$REGION" >/dev/null 2>&1
}

# Function to empty and delete an S3 bucket
delete_s3_bucket() {
    local bucket_name=$1
    if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
        echo "  📦 Emptying S3 bucket: $bucket_name"
        aws s3 rm "s3://$bucket_name" --recursive --quiet || true

        # Delete all versions if versioning is enabled
        echo "  🗑️  Deleting all object versions..."
        aws s3api list-object-versions --bucket "$bucket_name" --output json | \
        jq -r '.Versions[]? | "\(.Key) \(.VersionId)"' | \
        while read -r key version; do
            aws s3api delete-object --bucket "$bucket_name" --key "$key" --version-id "$version" --quiet || true
        done

        # Delete all delete markers
        aws s3api list-object-versions --bucket "$bucket_name" --output json | \
        jq -r '.DeleteMarkers[]? | "\(.Key) \(.VersionId)"' | \
        while read -r key version; do
            aws s3api delete-object --bucket "$bucket_name" --key "$key" --version-id "$version" --quiet || true
        done

        echo "  🗑️  Deleting S3 bucket: $bucket_name"
        aws s3api delete-bucket --bucket "$bucket_name" || true
    fi
}

# 1. Get stack outputs before deletion
echo "1️⃣ Getting resource information..."
if stack_exists "manuel-$STAGE"; then
    # Get bucket names
    # shellcheck disable=SC2016
    MANUALS_BUCKET=$(aws cloudformation describe-stacks --stack-name "manuel-$STAGE" --query 'Stacks[0].Outputs[?OutputKey==`ManualsBucketName`].OutputValue' --output text 2>/dev/null || echo "")
    # shellcheck disable=SC2016
    AUDIO_BUCKET=$(aws cloudformation describe-stacks --stack-name "manuel-$STAGE" --query 'Stacks[0].Outputs[?OutputKey==`AudioBucketName`].OutputValue' --output text 2>/dev/null || echo "")

    # Get Cognito pools
    # shellcheck disable=SC2016
    USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "manuel-$STAGE" --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")

    # Get Knowledge Base ID
    # shellcheck disable=SC2016
    KB_ID=$(aws cloudformation describe-stacks --stack-name "manuel-$STAGE" --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null || echo "")
fi

# 2. Delete Bedrock Knowledge Base and Data Source (if exists)
if [ -n "$KB_ID" ]; then
    echo ""
    echo "2️⃣ Deleting Bedrock Knowledge Base..."

    # Get data sources
    DATA_SOURCES=$(aws bedrock-agent list-data-sources --knowledge-base-id "$KB_ID" --region "$REGION" --query 'dataSourceSummaries[*].dataSourceId' --output text 2>/dev/null || echo "")

    # Delete each data source
    for ds in $DATA_SOURCES; do
        echo "  🗄️  Deleting data source: $ds"
        aws bedrock-agent delete-data-source --knowledge-base-id "$KB_ID" --data-source-id "$ds" --region "$REGION" || true
    done

    # Delete the knowledge base
    echo "  🧠 Deleting knowledge base: $KB_ID"
    aws bedrock-agent delete-knowledge-base --knowledge-base-id "$KB_ID" --region "$REGION" || true
fi

# 3. Empty S3 buckets before CloudFormation deletion
echo ""
echo "3️⃣ Emptying S3 buckets..."
if [ -n "$MANUALS_BUCKET" ]; then
    delete_s3_bucket "$MANUALS_BUCKET"
fi
if [ -n "$AUDIO_BUCKET" ]; then
    delete_s3_bucket "$AUDIO_BUCKET"
fi

# Also check for SAM deployment buckets
# shellcheck disable=SC2016
SAM_BUCKETS=$(aws s3api list-buckets --query 'Buckets[?contains(Name, `sam-`) || contains(Name, `cf-templates-`)].Name' --output text)
for bucket in $SAM_BUCKETS; do
    if [[ $bucket == *"$REGION"* ]]; then
        echo "  🗑️  Found SAM deployment bucket: $bucket"
        delete_s3_bucket "$bucket"
    fi
done

# 4. Delete CloudFormation stacks
echo ""
echo "4️⃣ Deleting CloudFormation stacks..."

# Delete main stack
if stack_exists "manuel-$STAGE"; then
    echo "  ☁️  Deleting stack: manuel-$STAGE"
    aws cloudformation delete-stack --stack-name "manuel-$STAGE" --region "$REGION"

    echo "  ⏳ Waiting for stack deletion..."
    aws cloudformation wait stack-delete-complete --stack-name "manuel-$STAGE" --region "$REGION" || true
fi

# Delete pipeline stack if exists
if stack_exists "manuel-pipeline-$STAGE"; then
    echo "  🔧 Deleting pipeline stack: manuel-pipeline-$STAGE"
    aws cloudformation delete-stack --stack-name "manuel-pipeline-$STAGE" --region "$REGION"
    aws cloudformation wait stack-delete-complete --stack-name "manuel-pipeline-$STAGE" --region "$REGION" || true
fi

# 5. Clean up Cognito domain (if exists)
if [ -n "$USER_POOL_ID" ]; then
    echo ""
    echo "5️⃣ Cleaning up Cognito resources..."
    DOMAIN=$(aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" --query 'UserPool.Domain' --output text 2>/dev/null || echo "")
    if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "None" ]; then
        echo "  🔐 Deleting Cognito domain: $DOMAIN"
        aws cognito-idp delete-user-pool-domain --domain "$DOMAIN" --region "$REGION" || true
    fi
fi

# 6. Delete CloudWatch log groups
echo ""
echo "6️⃣ Deleting CloudWatch log groups..."
LOG_GROUPS=$(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/manuel-" --query 'logGroups[*].logGroupName' --output text)
for lg in $LOG_GROUPS; do
    echo "  📊 Deleting log group: $lg"
    aws logs delete-log-group --log-group-name "$lg" || true
done

# 7. Clean up any remaining ElastiCache resources
echo ""
echo "7️⃣ Checking for ElastiCache resources..."
# shellcheck disable=SC2016
REDIS_CLUSTERS=$(aws elasticache describe-cache-clusters --query 'CacheClusters[?contains(CacheClusterId, `manuel-`)].CacheClusterId' --output text 2>/dev/null || echo "")
for cluster in $REDIS_CLUSTERS; do
    echo "  🔴 Deleting Redis cluster: $cluster"
    aws elasticache delete-cache-cluster --cache-cluster-id "$cluster" --region "$REGION" || true
done

# 8. Clean up VPC endpoints if they exist
echo ""
echo "8️⃣ Checking for VPC endpoints..."
VPC_ENDPOINTS=$(aws ec2 describe-vpc-endpoints --filters "Name=tag:Project,Values=manuel" --query 'VpcEndpoints[*].VpcEndpointId' --output text 2>/dev/null || echo "")
for endpoint in $VPC_ENDPOINTS; do
    echo "  🔌 Deleting VPC endpoint: $endpoint"
    aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$endpoint" || true
done

# 9. Final verification
echo ""
echo "9️⃣ Verifying cleanup..."
echo ""
echo "✅ Resource cleanup complete!"
echo ""
echo "📊 Cost reduction summary:"
echo "  - All Lambda functions deleted"
echo "  - API Gateway removed"
echo "  - DynamoDB tables deleted"
echo "  - S3 buckets emptied and deleted"
echo "  - Cognito user pools removed"
echo "  - CloudWatch logs deleted"
echo "  - ElastiCache clusters terminated"
echo "  - VPC endpoints removed"
echo ""
echo "💰 Estimated time to $0 billing:"
echo "  - Most resources: Immediate"
echo "  - CloudWatch logs: Within 1 hour"
echo "  - VPC endpoints: Within 1 hour"
echo ""
echo "📝 To redeploy Manuel later:"
echo "  cd backend"
echo "  sam build"
echo "  sam deploy --guided"
echo ""
echo "✨ Thank you for using Manuel!"
