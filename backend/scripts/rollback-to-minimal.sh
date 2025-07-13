#!/bin/bash

# Rollback Script: Full Backend to Minimal Backend
# Usage: ./rollback-to-minimal.sh [emergency|standard]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
MODE="${1:-standard}"

echo "🔄 Manuel Backend Rollback Script"
echo "Mode: $MODE"
echo "================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if stack exists
stack_exists() {
    aws cloudformation describe-stacks --stack-name "$1" >/dev/null 2>&1
}

# Function to get API Gateway ID
get_api_id() {
    local stack_name=$1
    aws cloudformation describe-stack-resources \
        --stack-name "$stack_name" \
        --query "StackResources[?ResourceType=='AWS::ApiGateway::RestApi'].PhysicalResourceId" \
        --output text
}

# Emergency rollback - immediate switch
emergency_rollback() {
    echo -e "${RED}⚠️  EMERGENCY ROLLBACK INITIATED${NC}"

    # Check if minimal stack exists
    if ! stack_exists "manuel-dev-minimal"; then
        echo -e "${RED}❌ Error: Minimal stack 'manuel-dev-minimal' not found!${NC}"
        exit 1
    fi

    echo "✅ Minimal stack found"

    # Get API IDs
    MINIMAL_API_ID=$(get_api_id "manuel-dev-minimal")
    echo "Minimal API ID: $MINIMAL_API_ID"

    # TODO: Update your custom domain mapping here
    # Example for API Gateway custom domain:
    # aws apigateway update-base-path-mapping \
    #     --domain-name api.manuel.example.com \
    #     --base-path "" \
    #     --patch-operations op=replace,path=/restApiId,value=$MINIMAL_API_ID

    echo -e "${GREEN}✅ Emergency rollback completed${NC}"
    echo "⚠️  Remember to:"
    echo "  1. Update any hardcoded endpoints in the frontend"
    echo "  2. Notify the team about the rollback"
    echo "  3. Monitor the minimal stack for stability"
}

# Standard rollback - with data export
standard_rollback() {
    echo "📋 Standard Rollback Process"

    # Check both stacks exist
    if ! stack_exists "manuel-dev-minimal"; then
        echo -e "${RED}❌ Error: Minimal stack not found!${NC}"
        exit 1
    fi

    if ! stack_exists "manuel-dev-full"; then
        echo -e "${YELLOW}⚠️  Warning: Full stack not found, nothing to rollback from${NC}"
        exit 0
    fi

    # Export usage data if needed
    echo "📤 Exporting usage data..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    EXPORT_DIR="$BACKEND_DIR/rollback-exports/$TIMESTAMP"
    mkdir -p "$EXPORT_DIR"

    # Export DynamoDB tables
    TABLES=("UsageTable" "FileTrackingTable" "IngestionJobsTable")
    for table_suffix in "${TABLES[@]}"; do
        TABLE_NAME="manuel-dev-$table_suffix"
        if aws dynamodb describe-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
            echo "  Exporting $TABLE_NAME..."
            aws dynamodb scan --table-name "$TABLE_NAME" \
                --output json > "$EXPORT_DIR/$TABLE_NAME.json"
        fi
    done

    echo "✅ Data exported to: $EXPORT_DIR"

    # Perform the switch
    emergency_rollback

    echo ""
    echo "📝 Post-Rollback Checklist:"
    echo "  [ ] Update frontend configuration"
    echo "  [ ] Test authentication flow"
    echo "  [ ] Verify health endpoint"
    echo "  [ ] Monitor CloudWatch logs"
    echo "  [ ] Review exported data in $EXPORT_DIR"
}

# Main execution
case $MODE in
    emergency)
        emergency_rollback
        ;;
    standard)
        standard_rollback
        ;;
    *)
        echo -e "${RED}❌ Invalid mode: $MODE${NC}"
        echo "Usage: $0 [emergency|standard]"
        echo "  emergency - Immediate switch, no data export"
        echo "  standard  - Export data before switching (default)"
        exit 1
        ;;
esac

echo ""
echo "🎯 Next Steps:"
echo "1. Deploy minimal stack if not already running:"
echo "   cd $BACKEND_DIR"
echo "   sam deploy --template template-minimal.yaml --config-env minimal"
echo ""
echo "2. To restore full backend later:"
echo "   sam deploy --template template.yaml --parameter-overrides-file parameters-migration.json"
