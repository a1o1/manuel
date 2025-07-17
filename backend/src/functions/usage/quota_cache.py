"""
Cached Quota Management System
Provides high-performance quota checking with caching layer
"""

import hashlib
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

import boto3
from botocore.exceptions import ClientError

from logger import get_logger
from utils import get_current_date, get_current_month, calculate_ttl


class CachedQuotaManager:
    """High-performance quota management with in-memory and Redis caching."""
    
    def __init__(self):
        self.logger = get_logger("quota-cache")
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(os.environ["USAGE_TABLE_NAME"])
        self.daily_limit = int(os.environ.get("DAILY_QUOTA", 50))
        self.monthly_limit = int(os.environ.get("MONTHLY_QUOTA", 1000))
        
        # Cache settings
        self.cache_ttl_seconds = 300  # 5 minutes cache
        self.memory_cache = {}  # In-memory cache for single request
        self.redis_client = None
        
        # Initialize Redis if available
        self._init_redis_cache()
    
    def _init_redis_cache(self):
        """Initialize Redis cache if performance optimization is enabled."""
        try:
            if os.environ.get("ENABLE_PERFORMANCE_OPTIMIZATION", "false").lower() == "true":
                from performance_optimizer import get_performance_optimizer
                perf_optimizer = get_performance_optimizer("quota")
                if hasattr(perf_optimizer, 'redis_client'):
                    self.redis_client = perf_optimizer.redis_client
                    self.logger.info("Redis cache initialized for quota management")
        except Exception as e:
            self.logger.warning(f"Redis cache initialization failed: {str(e)}")
    
    def _get_cache_key(self, user_id: str, date: str) -> str:
        """Generate cache key for user quota data."""
        return f"quota:{hashlib.md5(f'{user_id}:{date}'.encode()).hexdigest()}"
    
    def _get_from_memory_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get quota data from in-memory cache."""
        if cache_key in self.memory_cache:
            entry = self.memory_cache[cache_key]
            if time.time() - entry['timestamp'] < self.cache_ttl_seconds:
                return entry['data']
            else:
                # Expired, remove from cache
                del self.memory_cache[cache_key]
        return None
    
    def _set_memory_cache(self, cache_key: str, data: Dict[str, Any]):
        """Set quota data in in-memory cache."""
        self.memory_cache[cache_key] = {
            'data': data,
            'timestamp': time.time()
        }
        
        # Cleanup old entries to prevent memory leaks
        if len(self.memory_cache) > 1000:  # Max 1000 entries
            oldest_key = min(self.memory_cache.keys(), 
                           key=lambda k: self.memory_cache[k]['timestamp'])
            del self.memory_cache[oldest_key]
    
    def _get_from_redis_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get quota data from Redis cache."""
        if not self.redis_client:
            return None
        
        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            self.logger.warning(f"Redis cache read error: {str(e)}")
        
        return None
    
    def _set_redis_cache(self, cache_key: str, data: Dict[str, Any]):
        """Set quota data in Redis cache."""
        if not self.redis_client:
            return
        
        try:
            self.redis_client.setex(
                cache_key, 
                self.cache_ttl_seconds, 
                json.dumps(data)
            )
        except Exception as e:
            self.logger.warning(f"Redis cache write error: {str(e)}")
    
    def _get_quota_data(self, user_id: str, date: str) -> Dict[str, Any]:
        """Get quota data with caching."""
        cache_key = self._get_cache_key(user_id, date)
        
        # Try memory cache first
        cached_data = self._get_from_memory_cache(cache_key)
        if cached_data:
            return cached_data
        
        # Try Redis cache
        cached_data = self._get_from_redis_cache(cache_key)
        if cached_data:
            # Store in memory cache for faster subsequent access
            self._set_memory_cache(cache_key, cached_data)
            return cached_data
        
        # Fetch from DynamoDB
        try:
            response = self.table.get_item(Key={"user_id": user_id, "date": date})
            
            if "Item" in response:
                item = response["Item"]
                data = {
                    "daily_count": int(item.get("daily_count", 0)),
                    "monthly_count": int(item.get("monthly_count", 0)),
                    "last_operation": item.get("last_operation", ""),
                    "last_updated": item.get("last_updated", "")
                }
            else:
                data = {
                    "daily_count": 0,
                    "monthly_count": 0,
                    "last_operation": "",
                    "last_updated": ""
                }
            
            # Cache the data
            self._set_memory_cache(cache_key, data)
            self._set_redis_cache(cache_key, data)
            
            return data
            
        except ClientError as e:
            self.logger.error(f"DynamoDB quota fetch error: {str(e)}")
            # Return empty data to prevent blocking
            return {
                "daily_count": 0,
                "monthly_count": 0,
                "last_operation": "",
                "last_updated": ""
            }
    
    def _invalidate_cache(self, user_id: str, date: str):
        """Invalidate cache for user quota data."""
        cache_key = self._get_cache_key(user_id, date)
        
        # Remove from memory cache
        if cache_key in self.memory_cache:
            del self.memory_cache[cache_key]
        
        # Remove from Redis cache
        if self.redis_client:
            try:
                self.redis_client.delete(cache_key)
            except Exception as e:
                self.logger.warning(f"Redis cache invalidation error: {str(e)}")
    
    def check_quota_fast(self, user_id: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Fast quota check without incrementing usage.
        Returns (can_proceed, quota_info)
        """
        today = get_current_date()
        quota_data = self._get_quota_data(user_id, today)
        
        daily_count = quota_data["daily_count"]
        monthly_count = quota_data["monthly_count"]
        
        # Check quotas
        if daily_count >= self.daily_limit:
            return False, {
                "error": "Daily quota exceeded",
                "daily_used": daily_count,
                "daily_limit": self.daily_limit,
                "monthly_used": monthly_count,
                "monthly_limit": self.monthly_limit,
                "cached": True
            }
        
        if monthly_count >= self.monthly_limit:
            return False, {
                "error": "Monthly quota exceeded", 
                "daily_used": daily_count,
                "daily_limit": self.daily_limit,
                "monthly_used": monthly_count,
                "monthly_limit": self.monthly_limit,
                "cached": True
            }
        
        return True, {
            "daily_used": daily_count,
            "daily_limit": self.daily_limit,
            "monthly_used": monthly_count,
            "monthly_limit": self.monthly_limit,
            "cached": True
        }
    
    def increment_usage_atomic(
        self, user_id: str, operation: str
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Atomically check and increment usage with optimistic locking.
        Returns (success, usage_info)
        """
        today = get_current_date()
        month = get_current_month()
        
        try:
            # Use DynamoDB conditional update for atomic increment
            response = self.table.update_item(
                Key={"user_id": user_id, "date": today},
                UpdateExpression="""
                    SET daily_count = if_not_exists(daily_count, :zero) + :one,
                        monthly_count = if_not_exists(monthly_count, :zero) + :one,
                        #month = :month,
                        last_operation = :operation,
                        last_updated = :timestamp,
                        #ttl = :ttl
                """,
                ConditionExpression="""
                    (if_not_exists(daily_count, :zero) < :daily_limit) AND
                    (if_not_exists(monthly_count, :zero) < :monthly_limit)
                """,
                ExpressionAttributeNames={
                    "#month": "month",
                    "#ttl": "ttl"
                },
                ExpressionAttributeValues={
                    ":zero": 0,
                    ":one": 1,
                    ":daily_limit": self.daily_limit,
                    ":monthly_limit": self.monthly_limit,
                    ":month": month,
                    ":operation": operation,
                    ":timestamp": datetime.utcnow().isoformat(),
                    ":ttl": calculate_ttl()
                },
                ReturnValues="ALL_NEW"
            )
            
            # Invalidate cache since data changed
            self._invalidate_cache(user_id, today)
            
            # Extract updated values
            item = response["Attributes"]
            daily_count = int(item["daily_count"])
            monthly_count = int(item["monthly_count"])
            
            return True, {
                "daily_used": daily_count,
                "daily_limit": self.daily_limit,
                "monthly_used": monthly_count,
                "monthly_limit": self.monthly_limit,
                "atomic": True
            }
            
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                # Quota exceeded, get current values for error message
                quota_data = self._get_quota_data(user_id, today)
                daily_count = quota_data["daily_count"]
                monthly_count = quota_data["monthly_count"]
                
                if daily_count >= self.daily_limit:
                    error_msg = "Daily quota exceeded"
                else:
                    error_msg = "Monthly quota exceeded"
                
                return False, {
                    "error": error_msg,
                    "daily_used": daily_count,
                    "daily_limit": self.daily_limit,
                    "monthly_used": monthly_count,
                    "monthly_limit": self.monthly_limit,
                    "atomic": True
                }
            else:
                self.logger.error(f"DynamoDB atomic update error: {str(e)}")
                return False, {"error": "Usage tracking error", "atomic": True}
    
    def get_usage_stats_cached(self, user_id: str) -> Dict[str, Any]:
        """Get usage statistics with caching."""
        today = get_current_date()
        quota_data = self._get_quota_data(user_id, today)
        
        daily_remaining = max(0, self.daily_limit - quota_data["daily_count"])
        monthly_remaining = max(0, self.monthly_limit - quota_data["monthly_count"])
        
        return {
            "user_id": user_id,
            "date": today,
            "daily_used": quota_data["daily_count"],
            "daily_limit": self.daily_limit,
            "daily_remaining": daily_remaining,
            "monthly_used": quota_data["monthly_count"],
            "monthly_limit": self.monthly_limit,
            "monthly_remaining": monthly_remaining,
            "last_operation": quota_data["last_operation"],
            "last_updated": quota_data["last_updated"],
            "cached": True
        }
    
    def clear_cache(self, user_id: Optional[str] = None):
        """Clear quota cache for user or all users."""
        if user_id:
            # Clear specific user cache
            today = get_current_date()
            self._invalidate_cache(user_id, today)
        else:
            # Clear all memory cache
            self.memory_cache.clear()
            
            # Clear all Redis cache (if needed)
            if self.redis_client:
                try:
                    # This would clear all quota keys - use with caution
                    keys = self.redis_client.keys("quota:*")
                    if keys:
                        self.redis_client.delete(*keys)
                except Exception as e:
                    self.logger.warning(f"Redis cache clear error: {str(e)}")


def get_cached_quota_manager() -> CachedQuotaManager:
    """Factory function to get cached quota manager instance."""
    return CachedQuotaManager()