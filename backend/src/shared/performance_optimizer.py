"""
Performance Optimization System for Manuel Backend
Provides connection pooling, caching, and performance enhancements
"""
import json
import time
import hashlib
import boto3
import redis
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Union, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import threading
import os
from botocore.config import Config
from botocore.exceptions import ClientError
import pickle
import gzip
import base64

from logger import get_logger


class CacheStrategy(Enum):
    """Cache strategies for different data types"""
    NONE = "none"
    MEMORY = "memory"
    REDIS = "redis"
    HYBRID = "hybrid"


@dataclass
class CacheConfig:
    """Configuration for caching strategies"""
    strategy: CacheStrategy = CacheStrategy.MEMORY
    ttl_seconds: int = 300  # 5 minutes default
    max_size: int = 1000
    compress: bool = True
    prefix: str = "manuel"


@dataclass
class ConnectionPoolConfig:
    """Configuration for connection pooling"""
    max_connections: int = 50
    max_idle_connections: int = 10
    connection_timeout: float = 10.0
    read_timeout: float = 30.0
    retries: int = 3
    enable_ssl: bool = True


class MemoryCache:
    """Thread-safe in-memory cache with LRU eviction"""
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.cache = {}
        self.access_times = {}
        self.lock = threading.RLock()
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        with self.lock:
            if key in self.cache:
                self.access_times[key] = time.time()
                return self.cache[key]
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with optional TTL"""
        with self.lock:
            # Evict if at max size
            if len(self.cache) >= self.max_size and key not in self.cache:
                self._evict_lru()
            
            self.cache[key] = {
                'value': value,
                'expires_at': time.time() + ttl if ttl else None
            }
            self.access_times[key] = time.time()
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        with self.lock:
            if key in self.cache:
                del self.cache[key]
                del self.access_times[key]
                return True
            return False
    
    def clear(self) -> None:
        """Clear all cache entries"""
        with self.lock:
            self.cache.clear()
            self.access_times.clear()
    
    def _evict_lru(self) -> None:
        """Evict least recently used item"""
        if not self.access_times:
            return
        
        # Find LRU key
        lru_key = min(self.access_times, key=self.access_times.get)
        del self.cache[lru_key]
        del self.access_times[lru_key]
    
    def cleanup_expired(self) -> int:
        """Clean up expired entries"""
        with self.lock:
            current_time = time.time()
            expired_keys = []
            
            for key, data in self.cache.items():
                if data.get('expires_at') and current_time > data['expires_at']:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self.cache[key]
                del self.access_times[key]
            
            return len(expired_keys)


class RedisCache:
    """Redis-based cache with compression and serialization"""
    
    def __init__(self, redis_url: str, prefix: str = "manuel"):
        self.redis_client = redis.from_url(redis_url, decode_responses=False)
        self.prefix = prefix
        self.logger = get_logger("redis-cache")
    
    def _make_key(self, key: str) -> str:
        """Create prefixed cache key"""
        return f"{self.prefix}:{key}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from Redis cache"""
        try:
            redis_key = self._make_key(key)
            data = self.redis_client.get(redis_key)
            
            if data:
                # Decompress and deserialize
                decompressed = gzip.decompress(data)
                return pickle.loads(decompressed)
            
            return None
            
        except Exception as e:
            self.logger.warning("Redis cache get failed", key=key, error=str(e))
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in Redis cache"""
        try:
            redis_key = self._make_key(key)
            
            # Serialize and compress
            serialized = pickle.dumps(value)
            compressed = gzip.compress(serialized)
            
            if ttl:
                return self.redis_client.setex(redis_key, ttl, compressed)
            else:
                return self.redis_client.set(redis_key, compressed)
            
        except Exception as e:
            self.logger.warning("Redis cache set failed", key=key, error=str(e))
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from Redis cache"""
        try:
            redis_key = self._make_key(key)
            return bool(self.redis_client.delete(redis_key))
        except Exception as e:
            self.logger.warning("Redis cache delete failed", key=key, error=str(e))
            return False
    
    def clear(self) -> bool:
        """Clear all cache entries with prefix"""
        try:
            pattern = f"{self.prefix}:*"
            keys = self.redis_client.keys(pattern)
            if keys:
                return bool(self.redis_client.delete(*keys))
            return True
        except Exception as e:
            self.logger.warning("Redis cache clear failed", error=str(e))
            return False


class HybridCache:
    """Hybrid cache using both memory and Redis"""
    
    def __init__(self, memory_cache: MemoryCache, redis_cache: RedisCache):
        self.memory_cache = memory_cache
        self.redis_cache = redis_cache
        self.logger = get_logger("hybrid-cache")
    
    def get(self, key: str) -> Optional[Any]:
        """Get from memory first, then Redis"""
        # Try memory cache first
        value = self.memory_cache.get(key)
        if value is not None:
            return value['value']
        
        # Try Redis cache
        value = self.redis_cache.get(key)
        if value is not None:
            # Store in memory cache for faster access
            self.memory_cache.set(key, value, ttl=300)  # 5 min in memory
            return value
        
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set in both memory and Redis"""
        # Set in memory
        self.memory_cache.set(key, value, ttl=min(ttl or 300, 300))
        
        # Set in Redis
        return self.redis_cache.set(key, value, ttl)
    
    def delete(self, key: str) -> bool:
        """Delete from both caches"""
        memory_deleted = self.memory_cache.delete(key)
        redis_deleted = self.redis_cache.delete(key)
        return memory_deleted or redis_deleted


class ConnectionPool:
    """AWS service connection pool with optimized configurations"""
    
    def __init__(self, config: ConnectionPoolConfig):
        self.config = config
        self.pools = {}
        self.logger = get_logger("connection-pool")
        
        # Base configuration for all AWS clients
        self.base_config = Config(
            max_pool_connections=config.max_connections,
            retries={
                'max_attempts': config.retries,
                'mode': 'adaptive'
            },
            connect_timeout=config.connection_timeout,
            read_timeout=config.read_timeout,
            use_ssl=config.enable_ssl
        )
    
    def get_bedrock_client(self) -> boto3.client:
        """Get optimized Bedrock client"""
        if 'bedrock' not in self.pools:
            self.pools['bedrock'] = boto3.client(
                'bedrock-runtime',
                config=self.base_config
            )
        return self.pools['bedrock']
    
    def get_bedrock_agent_client(self) -> boto3.client:
        """Get optimized Bedrock Agent client"""
        if 'bedrock-agent' not in self.pools:
            self.pools['bedrock-agent'] = boto3.client(
                'bedrock-agent-runtime',
                config=self.base_config
            )
        return self.pools['bedrock-agent']
    
    def get_transcribe_client(self) -> boto3.client:
        """Get optimized Transcribe client"""
        if 'transcribe' not in self.pools:
            self.pools['transcribe'] = boto3.client(
                'transcribe',
                config=self.base_config
            )
        return self.pools['transcribe']
    
    def get_s3_client(self) -> boto3.client:
        """Get optimized S3 client"""
        if 's3' not in self.pools:
            # S3-specific optimizations
            s3_config = Config(
                max_pool_connections=self.config.max_connections,
                retries={
                    'max_attempts': self.config.retries,
                    'mode': 'adaptive'
                },
                connect_timeout=self.config.connection_timeout,
                read_timeout=self.config.read_timeout,
                use_ssl=self.config.enable_ssl,
                s3={
                    'addressing_style': 'virtual',
                    'use_accelerate_endpoint': True,
                    'use_dualstack_endpoint': True
                }
            )
            self.pools['s3'] = boto3.client('s3', config=s3_config)
        return self.pools['s3']
    
    def get_dynamodb_resource(self) -> boto3.resource:
        """Get optimized DynamoDB resource"""
        if 'dynamodb' not in self.pools:
            self.pools['dynamodb'] = boto3.resource(
                'dynamodb',
                config=self.base_config
            )
        return self.pools['dynamodb']
    
    def get_sqs_client(self) -> boto3.client:
        """Get optimized SQS client"""
        if 'sqs' not in self.pools:
            self.pools['sqs'] = boto3.client(
                'sqs',
                config=self.base_config
            )
        return self.pools['sqs']
    
    def get_sns_client(self) -> boto3.client:
        """Get optimized SNS client"""
        if 'sns' not in self.pools:
            self.pools['sns'] = boto3.client(
                'sns',
                config=self.base_config
            )
        return self.pools['sns']


class PerformanceOptimizer:
    """Main performance optimizer with caching and connection pooling"""
    
    def __init__(self, function_name: str):
        self.function_name = function_name
        self.logger = get_logger(f"performance-{function_name}")
        
        # Initialize caches
        self.memory_cache = MemoryCache(max_size=1000)
        
        # Initialize Redis cache if configured
        redis_url = os.environ.get('REDIS_URL')
        self.redis_cache = RedisCache(redis_url, prefix="manuel") if redis_url else None
        
        # Initialize hybrid cache if Redis is available
        if self.redis_cache:
            self.cache = HybridCache(self.memory_cache, self.redis_cache)
        else:
            self.cache = self.memory_cache
        
        # Initialize connection pool
        pool_config = ConnectionPoolConfig(
            max_connections=int(os.environ.get('MAX_CONNECTIONS', '50')),
            max_idle_connections=int(os.environ.get('MAX_IDLE_CONNECTIONS', '10')),
            connection_timeout=float(os.environ.get('CONNECTION_TIMEOUT', '10.0')),
            read_timeout=float(os.environ.get('READ_TIMEOUT', '30.0')),
            retries=int(os.environ.get('CONNECTION_RETRIES', '3'))
        )
        self.connection_pool = ConnectionPool(pool_config)
        
        # Cache configurations for different data types
        self.cache_configs = {
            'bedrock_responses': CacheConfig(ttl_seconds=900, max_size=500),  # 15 min
            'knowledge_base_results': CacheConfig(ttl_seconds=1800, max_size=200),  # 30 min
            'transcription_results': CacheConfig(ttl_seconds=3600, max_size=100),  # 1 hour
            'user_usage': CacheConfig(ttl_seconds=300, max_size=1000),  # 5 min
            'manual_metadata': CacheConfig(ttl_seconds=7200, max_size=50),  # 2 hours
        }
    
    def cache_bedrock_response(self, model_id: str, prompt: str, response: str) -> str:
        """Cache Bedrock response with hash key"""
        cache_key = self._create_cache_key("bedrock", model_id, prompt)
        config = self.cache_configs['bedrock_responses']
        
        if isinstance(self.cache, HybridCache):
            self.cache.set(cache_key, response, config.ttl_seconds)
        else:
            self.cache.set(cache_key, response, config.ttl_seconds)
        
        self.logger.info("Bedrock response cached", 
                        cache_key=cache_key,
                        model_id=model_id,
                        ttl=config.ttl_seconds)
        
        return cache_key
    
    def get_cached_bedrock_response(self, model_id: str, prompt: str) -> Optional[str]:
        """Get cached Bedrock response"""
        cache_key = self._create_cache_key("bedrock", model_id, prompt)
        
        if isinstance(self.cache, HybridCache):
            response = self.cache.get(cache_key)
        else:
            cached_data = self.cache.get(cache_key)
            response = cached_data['value'] if cached_data else None
        
        if response:
            self.logger.info("Bedrock response cache hit", 
                            cache_key=cache_key,
                            model_id=model_id)
        
        return response
    
    def cache_knowledge_base_results(self, knowledge_base_id: str, query: str, results: List[Dict]) -> str:
        """Cache knowledge base retrieval results"""
        cache_key = self._create_cache_key("kb", knowledge_base_id, query)
        config = self.cache_configs['knowledge_base_results']
        
        if isinstance(self.cache, HybridCache):
            self.cache.set(cache_key, results, config.ttl_seconds)
        else:
            self.cache.set(cache_key, results, config.ttl_seconds)
        
        self.logger.info("Knowledge base results cached", 
                        cache_key=cache_key,
                        knowledge_base_id=knowledge_base_id,
                        result_count=len(results))
        
        return cache_key
    
    def get_cached_knowledge_base_results(self, knowledge_base_id: str, query: str) -> Optional[List[Dict]]:
        """Get cached knowledge base results"""
        cache_key = self._create_cache_key("kb", knowledge_base_id, query)
        
        if isinstance(self.cache, HybridCache):
            results = self.cache.get(cache_key)
        else:
            cached_data = self.cache.get(cache_key)
            results = cached_data['value'] if cached_data else None
        
        if results:
            self.logger.info("Knowledge base results cache hit", 
                            cache_key=cache_key,
                            knowledge_base_id=knowledge_base_id,
                            result_count=len(results))
        
        return results
    
    def cache_transcription_result(self, audio_hash: str, result: Dict) -> str:
        """Cache transcription result"""
        cache_key = self._create_cache_key("transcribe", audio_hash)
        config = self.cache_configs['transcription_results']
        
        if isinstance(self.cache, HybridCache):
            self.cache.set(cache_key, result, config.ttl_seconds)
        else:
            self.cache.set(cache_key, result, config.ttl_seconds)
        
        self.logger.info("Transcription result cached", 
                        cache_key=cache_key,
                        audio_hash=audio_hash)
        
        return cache_key
    
    def get_cached_transcription_result(self, audio_hash: str) -> Optional[Dict]:
        """Get cached transcription result"""
        cache_key = self._create_cache_key("transcribe", audio_hash)
        
        if isinstance(self.cache, HybridCache):
            result = self.cache.get(cache_key)
        else:
            cached_data = self.cache.get(cache_key)
            result = cached_data['value'] if cached_data else None
        
        if result:
            self.logger.info("Transcription result cache hit", 
                            cache_key=cache_key,
                            audio_hash=audio_hash)
        
        return result
    
    def cache_user_usage(self, user_id: str, usage_data: Dict) -> str:
        """Cache user usage data"""
        cache_key = self._create_cache_key("usage", user_id)
        config = self.cache_configs['user_usage']
        
        if isinstance(self.cache, HybridCache):
            self.cache.set(cache_key, usage_data, config.ttl_seconds)
        else:
            self.cache.set(cache_key, usage_data, config.ttl_seconds)
        
        return cache_key
    
    def get_cached_user_usage(self, user_id: str) -> Optional[Dict]:
        """Get cached user usage data"""
        cache_key = self._create_cache_key("usage", user_id)
        
        if isinstance(self.cache, HybridCache):
            usage_data = self.cache.get(cache_key)
        else:
            cached_data = self.cache.get(cache_key)
            usage_data = cached_data['value'] if cached_data else None
        
        return usage_data
    
    def invalidate_user_usage_cache(self, user_id: str) -> bool:
        """Invalidate user usage cache"""
        cache_key = self._create_cache_key("usage", user_id)
        
        if isinstance(self.cache, HybridCache):
            return self.cache.delete(cache_key)
        else:
            return self.cache.delete(cache_key)
    
    def _create_cache_key(self, prefix: str, *args) -> str:
        """Create cache key from arguments"""
        key_parts = [prefix] + [str(arg) for arg in args]
        key_string = "|".join(key_parts)
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def _calculate_audio_hash(self, audio_data: bytes) -> str:
        """Calculate hash for audio data"""
        return hashlib.sha256(audio_data).hexdigest()
    
    def get_optimized_clients(self) -> Dict[str, Any]:
        """Get all optimized AWS clients"""
        return {
            'bedrock': self.connection_pool.get_bedrock_client(),
            'bedrock_agent': self.connection_pool.get_bedrock_agent_client(),
            'transcribe': self.connection_pool.get_transcribe_client(),
            's3': self.connection_pool.get_s3_client(),
            'dynamodb': self.connection_pool.get_dynamodb_resource(),
            'sqs': self.connection_pool.get_sqs_client(),
            'sns': self.connection_pool.get_sns_client()
        }
    
    def cleanup_expired_cache(self) -> int:
        """Clean up expired cache entries"""
        if hasattr(self.cache, 'cleanup_expired'):
            return self.cache.cleanup_expired()
        return 0
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        stats = {
            'cache_type': type(self.cache).__name__,
            'function_name': self.function_name
        }
        
        if hasattr(self.cache, 'cache'):
            stats['memory_cache_size'] = len(self.cache.cache)
            stats['memory_cache_max_size'] = self.cache.max_size
        
        return stats
    
    def warm_up_connections(self) -> Dict[str, bool]:
        """Warm up connection pools"""
        results = {}
        
        try:
            # Test each connection
            clients = self.get_optimized_clients()
            
            for service_name, client in clients.items():
                try:
                    if service_name == 'bedrock':
                        # Test with a simple call
                        client.list_foundation_models()
                    elif service_name == 'transcribe':
                        client.list_transcription_jobs(MaxResults=1)
                    elif service_name == 's3':
                        client.list_buckets()
                    elif service_name == 'dynamodb':
                        client.meta.client.list_tables()
                    
                    results[service_name] = True
                    
                except Exception as e:
                    self.logger.warning(f"Connection warmup failed for {service_name}", 
                                       error=str(e))
                    results[service_name] = False
            
            self.logger.info("Connection warmup completed", results=results)
            
        except Exception as e:
            self.logger.error("Connection warmup failed", error=str(e))
        
        return results


def get_performance_optimizer(function_name: str) -> PerformanceOptimizer:
    """Factory function to get performance optimizer instance"""
    return PerformanceOptimizer(function_name)


def performance_cache_decorator(cache_type: str, ttl: int = 300):
    """Decorator for caching function results"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            optimizer = get_performance_optimizer(func.__name__)
            
            # Create cache key from function name and arguments
            cache_key = optimizer._create_cache_key(cache_type, func.__name__, *args, **kwargs)
            
            # Try to get from cache
            if isinstance(optimizer.cache, HybridCache):
                cached_result = optimizer.cache.get(cache_key)
            else:
                cached_data = optimizer.cache.get(cache_key)
                cached_result = cached_data['value'] if cached_data else None
            
            if cached_result is not None:
                return cached_result
            
            # Call function and cache result
            result = func(*args, **kwargs)
            
            if isinstance(optimizer.cache, HybridCache):
                optimizer.cache.set(cache_key, result, ttl)
            else:
                optimizer.cache.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator