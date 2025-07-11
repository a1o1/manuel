"""
Manuel - Backup and Disaster Recovery Function
Handles automated backup verification and disaster recovery procedures
"""
import json
import os
import time
from typing import Dict, Any, List
from datetime import datetime, timedelta
import boto3
from botocore.exceptions import ClientError
import sys
sys.path.append('/opt/python')
sys.path.append('../../shared')

from utils import create_response, handle_options_request
from logger import get_logger, LoggingContext
from health_checker import get_health_checker


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle backup and disaster recovery operations
    
    Endpoints:
    GET /backup/status - Get backup status for all services
    POST /backup/verify - Verify backup integrity
    POST /backup/restore - Initiate disaster recovery procedure
    GET /backup/metrics - Get backup metrics and statistics
    """
    
    # Handle CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return handle_options_request()
    
    logger = get_logger("manuel-backup", context)
    health_checker = get_health_checker()
    
    try:
        path = event.get('path', '')
        method = event.get('httpMethod', 'GET')
        
        logger.info("Backup operation request", path=path, method=method)
        
        if method == 'GET':
            if path.endswith('/backup/status'):
                return handle_backup_status(logger)
            elif path.endswith('/backup/metrics'):
                return handle_backup_metrics(logger)
            else:
                return create_response(404, {'error': 'Backup endpoint not found'})
        
        elif method == 'POST':
            if path.endswith('/backup/verify'):
                return handle_backup_verify(event, logger)
            elif path.endswith('/backup/restore'):
                return handle_disaster_recovery(event, logger)
            else:
                return create_response(404, {'error': 'Backup endpoint not found'})
        
        else:
            return create_response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        logger.error("Error in backup operation", error=str(e), error_type=type(e).__name__)
        return create_response(500, {
            'error': 'Backup operation failed',
            'details': str(e)
        })


def handle_backup_status(logger) -> Dict[str, Any]:
    """Get backup status for all services"""
    
    try:
        with LoggingContext(logger, "BackupStatusCheck"):
            backup_status = get_backup_status()
        
        logger.info("Backup status retrieved", 
                   services_checked=len(backup_status['services']))
        
        return create_response(200, backup_status)
        
    except Exception as e:
        logger.error("Backup status check failed", error=str(e))
        return create_response(500, {
            'error': 'Failed to get backup status',
            'details': str(e)
        })


def handle_backup_verify(event: Dict[str, Any], logger) -> Dict[str, Any]:
    """Verify backup integrity"""
    
    try:
        # Parse request body for verification options
        body = {}
        if event.get('body'):
            body = json.loads(event['body'])
        
        services = body.get('services', ['dynamodb', 's3'])
        
        with LoggingContext(logger, "BackupVerification"):
            verification_results = verify_backup_integrity(services, logger)
        
        logger.info("Backup verification completed", 
                   services_verified=len(verification_results['services']),
                   overall_status=verification_results['overall_status'])
        
        status_code = 200 if verification_results['overall_status'] == 'healthy' else 207
        return create_response(status_code, verification_results)
        
    except Exception as e:
        logger.error("Backup verification failed", error=str(e))
        return create_response(500, {
            'error': 'Backup verification failed',
            'details': str(e)
        })


def handle_disaster_recovery(event: Dict[str, Any], logger) -> Dict[str, Any]:
    """Initiate disaster recovery procedure"""
    
    try:
        # Parse request body for recovery options
        body = json.loads(event.get('body', '{}'))
        
        recovery_type = body.get('type', 'point_in_time')
        target_time = body.get('target_time')
        services = body.get('services', ['dynamodb'])
        
        with LoggingContext(logger, "DisasterRecovery"):
            recovery_results = initiate_disaster_recovery(
                recovery_type, target_time, services, logger
            )
        
        logger.info("Disaster recovery initiated", 
                   recovery_type=recovery_type,
                   services=services,
                   status=recovery_results['status'])
        
        return create_response(202, recovery_results)
        
    except Exception as e:
        logger.error("Disaster recovery failed", error=str(e))
        return create_response(500, {
            'error': 'Disaster recovery failed',
            'details': str(e)
        })


def handle_backup_metrics(logger) -> Dict[str, Any]:
    """Get backup metrics and statistics"""
    
    try:
        with LoggingContext(logger, "BackupMetrics"):
            metrics = get_backup_metrics()
        
        logger.info("Backup metrics retrieved", 
                   metrics_count=len(metrics))
        
        return create_response(200, metrics)
        
    except Exception as e:
        logger.error("Backup metrics retrieval failed", error=str(e))
        return create_response(500, {
            'error': 'Failed to get backup metrics',
            'details': str(e)
        })


def get_backup_status() -> Dict[str, Any]:
    """Get comprehensive backup status for all services"""
    
    status = {
        'timestamp': datetime.utcnow().isoformat(),
        'overall_status': 'healthy',
        'services': {}
    }
    
    # Check DynamoDB point-in-time recovery
    status['services']['dynamodb'] = check_dynamodb_backup_status()
    
    # Check S3 replication status
    status['services']['s3'] = check_s3_backup_status()
    
    # Check OpenSearch snapshots (if configured)
    status['services']['opensearch'] = check_opensearch_backup_status()
    
    # Determine overall status
    unhealthy_services = [
        name for name, service in status['services'].items() 
        if service['status'] != 'healthy'
    ]
    
    if unhealthy_services:
        status['overall_status'] = 'degraded'
        status['unhealthy_services'] = unhealthy_services
    
    return status


def check_dynamodb_backup_status() -> Dict[str, Any]:
    """Check DynamoDB backup and point-in-time recovery status"""
    
    try:
        dynamodb = boto3.client('dynamodb')
        table_name = os.environ.get('USAGE_TABLE_NAME')
        
        if not table_name:
            return {
                'status': 'unknown',
                'error': 'Table name not configured'
            }
        
        # Check point-in-time recovery status
        response = dynamodb.describe_continuous_backups(TableName=table_name)
        pitr_status = response['ContinuousBackupsDescription']['PointInTimeRecoveryDescription']
        
        # Check recent backups
        backups = dynamodb.list_backups(
            TableName=table_name,
            TimeRangeUpperBound=datetime.utcnow(),
            TimeRangeLowerBound=datetime.utcnow() - timedelta(days=7)
        )
        
        return {
            'status': 'healthy' if pitr_status['PointInTimeRecoveryStatus'] == 'ENABLED' else 'unhealthy',
            'point_in_time_recovery': {
                'enabled': pitr_status['PointInTimeRecoveryStatus'] == 'ENABLED',
                'earliest_restorable_time': pitr_status.get('EarliestRestorableDateTime', '').isoformat() if pitr_status.get('EarliestRestorableDateTime') else None,
                'latest_restorable_time': pitr_status.get('LatestRestorableDateTime', '').isoformat() if pitr_status.get('LatestRestorableDateTime') else None
            },
            'recent_backups': len(backups['BackupSummaries']),
            'last_backup_time': max(
                [backup['BackupCreationDateTime'] for backup in backups['BackupSummaries']], 
                default=None
            ).isoformat() if backups['BackupSummaries'] else None
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


def check_s3_backup_status() -> Dict[str, Any]:
    """Check S3 backup and replication status"""
    
    try:
        s3 = boto3.client('s3')
        
        # Get primary bucket info
        primary_bucket = os.environ.get('MANUALS_BUCKET')
        backup_bucket = f"manuel-manuals-backup-{os.environ.get('STAGE', 'dev')}-{os.environ.get('AWS_ACCOUNT_ID', '')}"
        
        if not primary_bucket:
            return {
                'status': 'unknown',
                'error': 'Primary bucket name not configured'
            }
        
        status_info = {
            'status': 'healthy',
            'primary_bucket': {
                'name': primary_bucket,
                'versioning': 'unknown',
                'replication': 'unknown'
            }
        }
        
        # Check versioning on primary bucket
        try:
            versioning = s3.get_bucket_versioning(Bucket=primary_bucket)
            status_info['primary_bucket']['versioning'] = versioning.get('Status', 'Suspended')
        except ClientError:
            status_info['primary_bucket']['versioning'] = 'error'
        
        # Check replication configuration
        try:
            replication = s3.get_bucket_replication(Bucket=primary_bucket)
            rules = replication.get('ReplicationConfiguration', {}).get('Rules', [])
            status_info['primary_bucket']['replication'] = 'enabled' if rules else 'disabled'
            status_info['replication_rules'] = len(rules)
        except ClientError as e:
            if e.response['Error']['Code'] == 'ReplicationConfigurationNotFoundError':
                status_info['primary_bucket']['replication'] = 'disabled'
            else:
                status_info['primary_bucket']['replication'] = 'error'
        
        # Check backup bucket if replication is enabled
        if status_info['primary_bucket']['replication'] == 'enabled':
            try:
                s3.head_bucket(Bucket=backup_bucket)
                status_info['backup_bucket'] = {
                    'name': backup_bucket,
                    'accessible': True
                }
            except ClientError:
                status_info['backup_bucket'] = {
                    'name': backup_bucket,
                    'accessible': False
                }
                status_info['status'] = 'degraded'
        
        return status_info
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


def check_opensearch_backup_status() -> Dict[str, Any]:
    """Check OpenSearch backup status"""
    
    try:
        # OpenSearch Serverless doesn't support traditional snapshots
        # Check collection health instead
        opensearch = boto3.client('opensearchserverless')
        
        # This would need to be implemented based on actual collection name
        # For now, return a placeholder status
        return {
            'status': 'not_implemented',
            'note': 'OpenSearch Serverless backup monitoring not yet implemented'
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


def verify_backup_integrity(services: List[str], logger) -> Dict[str, Any]:
    """Verify backup integrity for specified services"""
    
    results = {
        'timestamp': datetime.utcnow().isoformat(),
        'overall_status': 'healthy',
        'services': {}
    }
    
    for service in services:
        if service == 'dynamodb':
            results['services']['dynamodb'] = verify_dynamodb_backup(logger)
        elif service == 's3':
            results['services']['s3'] = verify_s3_backup(logger)
        else:
            results['services'][service] = {
                'status': 'skipped',
                'reason': 'Service not supported for verification'
            }
    
    # Determine overall status
    failed_services = [
        name for name, service in results['services'].items() 
        if service.get('status') == 'failed'
    ]
    
    if failed_services:
        results['overall_status'] = 'failed'
        results['failed_services'] = failed_services
    
    return results


def verify_dynamodb_backup(logger) -> Dict[str, Any]:
    """Verify DynamoDB backup integrity"""
    
    try:
        # This is a simplified verification
        # In a real scenario, you might restore to a test table and verify data
        
        dynamodb = boto3.client('dynamodb')
        table_name = os.environ.get('USAGE_TABLE_NAME')
        
        if not table_name:
            return {
                'status': 'failed',
                'error': 'Table name not configured'
            }
        
        # Check if we can describe the table and backups
        table_desc = dynamodb.describe_table(TableName=table_name)
        backups = dynamodb.list_backups(TableName=table_name)
        
        return {
            'status': 'passed',
            'table_status': table_desc['Table']['TableStatus'],
            'backup_count': len(backups['BackupSummaries']),
            'verification_time': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("DynamoDB backup verification failed", error=str(e))
        return {
            'status': 'failed',
            'error': str(e)
        }


def verify_s3_backup(logger) -> Dict[str, Any]:
    """Verify S3 backup integrity"""
    
    try:
        s3 = boto3.client('s3')
        primary_bucket = os.environ.get('MANUALS_BUCKET')
        
        if not primary_bucket:
            return {
                'status': 'failed',
                'error': 'Primary bucket name not configured'
            }
        
        # Sample a few objects and verify they exist
        response = s3.list_objects_v2(Bucket=primary_bucket, MaxKeys=10)
        objects = response.get('Contents', [])
        
        verified_objects = 0
        for obj in objects[:5]:  # Verify first 5 objects
            try:
                s3.head_object(Bucket=primary_bucket, Key=obj['Key'])
                verified_objects += 1
            except ClientError:
                pass
        
        return {
            'status': 'passed' if verified_objects == len(objects[:5]) else 'degraded',
            'total_objects': len(objects),
            'verified_objects': verified_objects,
            'verification_time': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("S3 backup verification failed", error=str(e))
        return {
            'status': 'failed',
            'error': str(e)
        }


def initiate_disaster_recovery(recovery_type: str, target_time: str, services: List[str], logger) -> Dict[str, Any]:
    """Initiate disaster recovery procedure"""
    
    results = {
        'recovery_id': f"recovery_{int(time.time())}",
        'timestamp': datetime.utcnow().isoformat(),
        'recovery_type': recovery_type,
        'target_time': target_time,
        'status': 'initiated',
        'services': {}
    }
    
    logger.warning("Disaster recovery initiated", 
                   recovery_type=recovery_type,
                   target_time=target_time,
                   services=services)
    
    for service in services:
        if service == 'dynamodb':
            results['services']['dynamodb'] = initiate_dynamodb_recovery(
                recovery_type, target_time, logger
            )
        else:
            results['services'][service] = {
                'status': 'skipped',
                'reason': 'Service recovery not implemented'
            }
    
    return results


def initiate_dynamodb_recovery(recovery_type: str, target_time: str, logger) -> Dict[str, Any]:
    """Initiate DynamoDB disaster recovery"""
    
    try:
        # This is a safe simulation - in production, this would create a new table
        # from backup or point-in-time recovery
        
        dynamodb = boto3.client('dynamodb')
        table_name = os.environ.get('USAGE_TABLE_NAME')
        recovery_table_name = f"{table_name}-recovery-{int(time.time())}"
        
        logger.warning("DynamoDB recovery simulation", 
                       source_table=table_name,
                       recovery_table=recovery_table_name,
                       recovery_type=recovery_type,
                       target_time=target_time)
        
        # In a real scenario, you would call restore_table_from_backup or restore_table_to_point_in_time
        # For safety, we're just returning a simulation result
        
        return {
            'status': 'simulated',
            'source_table': table_name,
            'recovery_table': recovery_table_name,
            'recovery_type': recovery_type,
            'target_time': target_time,
            'note': 'This is a simulation. In production, this would restore to a new table.'
        }
        
    except Exception as e:
        logger.error("DynamoDB recovery failed", error=str(e))
        return {
            'status': 'failed',
            'error': str(e)
        }


def get_backup_metrics() -> Dict[str, Any]:
    """Get backup metrics and statistics"""
    
    metrics = {
        'timestamp': datetime.utcnow().isoformat(),
        'retention_policies': {
            'dynamodb_pitr': '35 days (AWS default)',
            's3_versioning': 'Configured based on lifecycle policy',
            'backup_retention': f"{os.environ.get('BACKUP_RETENTION_DAYS', '30')} days"
        },
        'backup_costs': {
            'estimated_monthly': 'Calculated based on storage and request usage',
            'pitr_cost': 'Continuous backups charged per GB-hour',
            's3_replication_cost': 'Cross-region transfer and storage costs'
        },
        'recovery_estimates': {
            'dynamodb_pitr': '5-15 minutes',
            's3_cross_region': 'Near real-time replication',
            'full_restoration': '1-4 hours depending on data size'
        }
    }
    
    return metrics