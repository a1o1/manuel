#!/bin/bash

# Manuel Backend - CI/CD Pipeline Deployment Script
# This script sets up the complete AWS CodePipeline infrastructure

set -e

echo "🚀 Manuel Backend CI/CD Pipeline Deployment"
echo "==========================================="

# Default values
STACK_NAME="manuel-pipeline"
REGION="eu-west-1"
GITHUB_OWNER="a1o1"
GITHUB_REPO="manuel"
GITHUB_BRANCH="main"
NOTIFICATION_EMAIL=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --github-owner)
            GITHUB_OWNER="$2"
            shift 2
            ;;
        --github-repo)
            GITHUB_REPO="$2"
            shift 2
            ;;
        --github-branch)
            GITHUB_BRANCH="$2"
            shift 2
            ;;
        --notification-email)
            NOTIFICATION_EMAIL="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --stack-name NAME          Pipeline stack name (default: manuel-pipeline)"
            echo "  --region REGION           AWS region (default: eu-west-1)"
            echo "  --github-owner OWNER      GitHub repository owner (default: a1o1)"
            echo "  --github-repo REPO        GitHub repository name (default: manuel)"
            echo "  --github-branch BRANCH    GitHub branch to track (default: main)"
            echo "  --notification-email EMAIL Email for pipeline notifications"
            echo "  --help                    Show this help message"
            echo ""
            echo "Example:"
            echo "  $0 --notification-email admin@yourdomain.com"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$NOTIFICATION_EMAIL" ]; then
    echo "❌ Error: --notification-email is required"
    echo "Use --help for usage information"
    exit 1
fi

echo "📋 Configuration:"
echo "  Stack Name: $STACK_NAME"
echo "  Region: $REGION"
echo "  GitHub Owner: $GITHUB_OWNER"
echo "  GitHub Repo: $GITHUB_REPO"
echo "  GitHub Branch: $GITHUB_BRANCH"
echo "  Notification Email: $NOTIFICATION_EMAIL"
echo ""

# Check AWS CLI configuration
echo "🔍 Checking AWS CLI configuration..."
if ! aws sts get-caller-identity --region "$REGION" > /dev/null 2>&1; then
    echo "❌ Error: AWS CLI not configured or invalid credentials"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
echo "✅ AWS Account: $ACCOUNT_ID"
echo ""

# Create S3 bucket for pipeline artifacts if it doesn't exist
ARTIFACTS_BUCKET="manuel-pipeline-artifacts-$ACCOUNT_ID"
echo "🪣 Checking S3 artifacts bucket: $ARTIFACTS_BUCKET"

if aws s3api head-bucket --bucket "$ARTIFACTS_BUCKET" --region "$REGION" 2>/dev/null; then
    echo "✅ Artifacts bucket already exists"
else
    echo "📦 Creating artifacts bucket..."
    aws s3 mb "s3://$ARTIFACTS_BUCKET" --region "$REGION"

    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$ARTIFACTS_BUCKET" \
        --versioning-configuration Status=Enabled

    # Set lifecycle policy
    cat > /tmp/lifecycle-policy.json << EOF
{
    "Rules": [
        {
            "ID": "DeleteOldArtifacts",
            "Status": "Enabled",
            "Expiration": {
                "Days": 30
            },
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 7
            }
        }
    ]
}
EOF

    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$ARTIFACTS_BUCKET" \
        --lifecycle-configuration file:///tmp/lifecycle-policy.json

    echo "✅ Artifacts bucket created and configured"
fi
echo ""

# Deploy the pipeline infrastructure
echo "🏗️ Deploying CI/CD pipeline infrastructure..."
aws cloudformation deploy \
    --template-file pipeline-template.yaml \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        GitHubOwner="$GITHUB_OWNER" \
        GitHubRepo="$GITHUB_REPO" \
        GitHubBranch="$GITHUB_BRANCH" \
        ArtifactsBucketName="$ARTIFACTS_BUCKET" \
        NotificationEmail="$NOTIFICATION_EMAIL" \
    --tags \
        Project=Manuel \
        Component=Pipeline \
        Environment=shared

if [ $? -eq 0 ]; then
    echo "✅ Pipeline infrastructure deployed successfully"
else
    echo "❌ Pipeline deployment failed"
    exit 1
fi
echo ""

# Get pipeline outputs
echo "📊 Pipeline Information:"
PIPELINE_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`PipelineName`].OutputValue' \
    --output text)

CODECOMMIT_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`CodeCommitRepoCloneUrl`].OutputValue' \
    --output text)

echo "  Pipeline Name: $PIPELINE_NAME"
echo "  CodeCommit Repository: $CODECOMMIT_URL"
echo "  Artifacts Bucket: $ARTIFACTS_BUCKET"
echo ""

echo "🔧 Next Steps:"
echo "1. Set up GitHub → CodeCommit mirroring:"
echo "   - Configure GitHub webhook to mirror to CodeCommit"
echo "   - Or manually push code to CodeCommit repository"
echo ""
echo "2. Configure GitHub webhook (optional for direct trigger):"
echo "   - Repository Settings → Webhooks → Add webhook"
echo "   - Payload URL: Use CodePipeline webhook if configured"
echo ""
echo "3. Test the pipeline:"
echo "   - Push code to the $GITHUB_BRANCH branch"
echo "   - Monitor pipeline execution in AWS Console"
echo ""
echo "4. Configure manual approval notifications:"
echo "   - Check email for SNS subscription confirmation"
echo "   - Configure Slack integration if needed"
echo ""

echo "🎉 CI/CD Pipeline setup complete!"
echo ""
echo "📖 Documentation:"
echo "  - Pipeline Dashboard: https://console.aws.amazon.com/codesuite/codepipeline/pipelines/$PIPELINE_NAME/view"
echo "  - CloudFormation Stack: https://console.aws.amazon.com/cloudformation/home?region=$REGION#/stacks/stackinfo?stackId=$STACK_NAME"
echo ""
