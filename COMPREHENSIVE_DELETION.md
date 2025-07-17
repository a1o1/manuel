# Comprehensive Manual Deletion System

## Overview

Manuel now includes a comprehensive deletion system that performs complete cleanup of all manual-related data when a manual is deleted. This ensures no orphaned data remains in the system.

## What Gets Cleaned Up

When you delete a manual using `manuel manuals delete <key>` or `DELETE /api/manuals/{id}`, the system performs the following cleanup operations:

### 1. ✅ **S3 Storage Cleanup**
- **Action**: Deletes the original PDF file from S3
- **Location**: `s3://manuel-manuals-{stage}/manuals/{user_id}/{manual_id}.pdf`
- **Purpose**: Removes the source file to free up storage

### 2. ✅ **Knowledge Base Sync**
- **Action**: Triggers AWS Bedrock Knowledge Base ingestion job
- **Purpose**: Removes vector embeddings and search index entries
- **Timeline**: Takes 5-15 minutes to complete
- **Result**: Manual no longer appears in query results

### 3. ✅ **DynamoDB File Tracking Cleanup**
- **Action**: Removes file tracking records
- **Table**: `manuel-usage-{stage}`
- **Records**: `file_tracker#{s3_key}` entries
- **Purpose**: Prevents duplicate processing attempts

### 4. ✅ **Redis Cache Invalidation**
- **Action**: Removes cached query results containing the manual
- **Patterns**: 
  - `query:{user_id}:*` (all user queries)
  - `*{manual_filename}*` (manual-specific cache)
- **Purpose**: Ensures stale results don't appear in future queries

### 5. ✅ **PDF Page Cache Cleanup**
- **Action**: Removes processed PDF page images
- **Location**: `s3://cache-bucket/pdf-pages/{user_id}/{manual_filename}/`
- **Purpose**: Cleans up extracted page highlights and images

## CLI Usage

### Basic Deletion
```bash
# Delete with confirmation prompt
manuel manuals delete "manuals/user123/my-manual.pdf"

# Force delete (skip confirmation)
manuel manuals delete "manuals/user123/my-manual.pdf" --force
```

### Example Output
```
✅ Manual deleted successfully!

🧹 Cleanup Summary:
Completed: 5/5 steps

✅ S3 file deleted
✅ Knowledge Base sync triggered
✅ File tracking cleaned up
✅ Cache invalidated (3 keys)
✅ PDF pages cleaned up (0 pages)

🔄 Knowledge Base sync job: abc123-def456-ghi789
Note: It may take a few minutes for the manual to be completely removed from search results.
```

## API Response Format

```json
{
  "message": "Manual deletion completed",
  "success": true,
  "cleanup_summary": {
    "completed_steps": 5,
    "total_steps": 5,
    "details": {
      "s3_deletion": true,
      "knowledge_base_sync": true,
      "file_tracking_cleanup": true,
      "cache_invalidation": true,
      "pdf_page_cleanup": true,
      "sync_job_id": "abc123-def456-ghi789",
      "cache_keys_deleted": 3,
      "cached_pages_deleted": 0,
      "errors": []
    }
  }
}
```

## Error Handling

### Partial Failures
If some cleanup steps fail, the system continues with other operations:

```json
{
  "cleanup_summary": {
    "completed_steps": 3,
    "total_steps": 5,
    "details": {
      "s3_deletion": true,
      "knowledge_base_sync": false,
      "file_tracking_cleanup": true,
      "cache_invalidation": false,
      "pdf_page_cleanup": true,
      "errors": [
        "Knowledge Base sync: Data source not found",
        "Redis cleanup: Connection timeout"
      ]
    }
  }
}
```

### Common Warnings
- **"Knowledge Base ID not configured"**: X-Ray tracing disabled in development
- **"Redis cache not enabled"**: Redis disabled in development environments
- **"No data sources found"**: Knowledge Base configuration issue

## Implementation Details

### IAM Permissions Required
The manuals function needs these additional permissions:
```yaml
- Effect: Allow
  Action:
    - bedrock:ListDataSources
    - bedrock:GetDataSource  
    - bedrock:StartIngestionJob
    - bedrock:GetIngestionJob
  Resource: !GetAtt BedrockKnowledgeBase.KnowledgeBaseArn
```

### Environment Variables
```yaml
KNOWLEDGE_BASE_ID: !Ref BedrockKnowledgeBase
USAGE_TABLE: !Ref UsageTable
REDIS_ENDPOINT: !GetAtt RedisCluster.PrimaryEndpoint.Address
ENABLE_REDIS_CACHE: "true"
```

### Lambda Layers
- **Redis Layer**: Required for cache invalidation
- **VPC Configuration**: Required for Redis access

## Testing

### Manual Testing
1. Upload a test manual:
   ```bash
   manuel manuals download "https://example.com/test.pdf" --name "Test Manual"
   ```

2. Verify it appears in queries:
   ```bash
   manuel ask "test manual question"
   ```

3. Delete the manual:
   ```bash
   manuel manuals delete "manuals/{user_id}/test-manual.pdf"
   ```

4. Verify cleanup:
   ```bash
   # Should show the manual is gone
   manuel manuals list
   
   # Should not return results from deleted manual (after sync completes)
   manuel ask "test manual question"
   ```

### Monitoring
- **CloudWatch Logs**: Check `/aws/lambda/manuel-manuals-{stage}` for cleanup details
- **X-Ray Traces**: Monitor ingestion job performance
- **Knowledge Base Console**: Verify sync job completion

## Benefits

1. **Complete Data Removal**: No orphaned data left in the system
2. **Immediate S3 Cleanup**: Storage freed up instantly
3. **Search Result Accuracy**: Prevents stale results in queries
4. **Cache Efficiency**: Removes invalid cached entries
5. **Cost Optimization**: Reduces storage and compute costs

## Future Enhancements

1. **Async Cleanup**: Move Knowledge Base sync to background job
2. **Bulk Deletion**: Support deleting multiple manuals at once
3. **Restore Capability**: Add manual restore from backup
4. **Admin Dashboard**: Visual cleanup status monitoring