"""
S3 Operations Optimizer
Provides high-performance S3 operations with intelligent caching and optimization
"""

import hashlib
import os
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from logger import get_logger


@dataclass
class S3UploadResult:
    """Result of S3 upload operation."""

    success: bool
    s3_key: str
    bucket: str
    size_bytes: int
    etag: Optional[str] = None
    version_id: Optional[str] = None
    upload_time_ms: Optional[float] = None
    error_message: Optional[str] = None


@dataclass
class S3OperationConfig:
    """Configuration for S3 operations."""

    multipart_threshold: int = 64 * 1024 * 1024  # 64MB
    multipart_chunksize: int = 16 * 1024 * 1024  # 16MB
    max_concurrency: int = 10
    max_bandwidth: Optional[int] = None  # bytes per second
    use_acceleration: bool = True
    storage_class: str = "STANDARD"
    server_side_encryption: str = "AES256"


class S3Optimizer:
    """High-performance S3 operations with intelligent optimization."""

    def __init__(self, config: Optional[S3OperationConfig] = None):
        self.logger = get_logger("s3-optimizer")
        self.config = config or S3OperationConfig()

        # Configure S3 client for optimal performance
        s3_config = Config(
            region_name=os.environ.get("AWS_REGION", "us-east-1"),
            retries={"max_attempts": 3, "mode": "adaptive"},
            max_pool_connections=self.config.max_concurrency,
            tcp_keepalive=True,
        )

        self.s3_client = boto3.client("s3", config=s3_config)
        self.s3_resource = boto3.resource("s3", config=s3_config)

        # Thread pool for concurrent operations
        self.executor = ThreadPoolExecutor(max_workers=self.config.max_concurrency)

        # Simple in-memory cache for metadata
        self.metadata_cache = {}
        self.cache_ttl = 300  # 5 minutes

    def _get_cache_key(self, bucket: str, key: str) -> str:
        """Generate cache key for S3 object metadata."""
        return hashlib.md5(f"{bucket}:{key}".encode()).hexdigest()

    def _get_cached_metadata(self, bucket: str, key: str) -> Optional[Dict[str, Any]]:
        """Get cached metadata for S3 object."""
        cache_key = self._get_cache_key(bucket, key)
        if cache_key in self.metadata_cache:
            entry = self.metadata_cache[cache_key]
            if time.time() - entry["timestamp"] < self.cache_ttl:
                return entry["data"]
            else:
                del self.metadata_cache[cache_key]
        return None

    def _set_cached_metadata(self, bucket: str, key: str, metadata: Dict[str, Any]):
        """Cache metadata for S3 object."""
        cache_key = self._get_cache_key(bucket, key)
        self.metadata_cache[cache_key] = {"data": metadata, "timestamp": time.time()}

        # Cleanup old entries
        if len(self.metadata_cache) > 1000:
            oldest_key = min(
                self.metadata_cache.keys(),
                key=lambda k: self.metadata_cache[k]["timestamp"],
            )
            del self.metadata_cache[oldest_key]

    def upload_file_optimized(
        self,
        file_data: bytes,
        bucket: str,
        key: str,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None,
        tags: Optional[Dict[str, str]] = None,
    ) -> S3UploadResult:
        """Upload file with intelligent optimization based on size."""
        start_time = time.time()
        file_size = len(file_data)

        try:
            # Determine optimal upload strategy
            if file_size >= self.config.multipart_threshold:
                return self._upload_multipart(
                    file_data, bucket, key, content_type, metadata, tags, start_time
                )
            else:
                return self._upload_single_part(
                    file_data, bucket, key, content_type, metadata, tags, start_time
                )

        except Exception as e:
            upload_time = (time.time() - start_time) * 1000
            self.logger.error(
                f"S3 upload failed: {str(e)}", bucket=bucket, key=key, size=file_size
            )

            return S3UploadResult(
                success=False,
                s3_key=key,
                bucket=bucket,
                size_bytes=file_size,
                upload_time_ms=upload_time,
                error_message=str(e),
            )

    def _upload_single_part(
        self,
        file_data: bytes,
        bucket: str,
        key: str,
        content_type: str,
        metadata: Optional[Dict[str, str]],
        tags: Optional[Dict[str, str]],
        start_time: float,
    ) -> S3UploadResult:
        """Upload file in a single operation."""
        put_args = {
            "Bucket": bucket,
            "Key": key,
            "Body": file_data,
            "ContentType": content_type,
            "StorageClass": self.config.storage_class,
            "ServerSideEncryption": self.config.server_side_encryption,
        }

        if metadata:
            put_args["Metadata"] = metadata

        if tags:
            tag_string = "&".join([f"{k}={v}" for k, v in tags.items()])
            put_args["Tagging"] = tag_string

        response = self.s3_client.put_object(**put_args)
        upload_time = (time.time() - start_time) * 1000

        # Cache metadata
        cached_metadata = {
            "ContentLength": len(file_data),
            "ContentType": content_type,
            "ETag": response.get("ETag", "").strip('"'),
            "LastModified": time.time(),
            "StorageClass": self.config.storage_class,
        }
        self._set_cached_metadata(bucket, key, cached_metadata)

        self.logger.info(
            "S3 single-part upload completed",
            bucket=bucket,
            key=key,
            size=len(file_data),
            upload_time_ms=upload_time,
        )

        return S3UploadResult(
            success=True,
            s3_key=key,
            bucket=bucket,
            size_bytes=len(file_data),
            etag=response.get("ETag", "").strip('"'),
            version_id=response.get("VersionId"),
            upload_time_ms=upload_time,
        )

    def _upload_multipart(
        self,
        file_data: bytes,
        bucket: str,
        key: str,
        content_type: str,
        metadata: Optional[Dict[str, str]],
        tags: Optional[Dict[str, str]],
        start_time: float,
    ) -> S3UploadResult:
        """Upload large file using multipart upload."""
        # Initiate multipart upload
        create_args = {
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,
            "StorageClass": self.config.storage_class,
            "ServerSideEncryption": self.config.server_side_encryption,
        }

        if metadata:
            create_args["Metadata"] = metadata

        if tags:
            tag_string = "&".join([f"{k}={v}" for k, v in tags.items()])
            create_args["Tagging"] = tag_string

        response = self.s3_client.create_multipart_upload(**create_args)
        upload_id = response["UploadId"]

        try:
            # Split file into chunks
            chunk_size = self.config.multipart_chunksize
            total_size = len(file_data)
            part_number = 1
            parts = []

            # Upload parts concurrently
            futures = []

            for offset in range(0, total_size, chunk_size):
                chunk = file_data[offset : offset + chunk_size]

                future = self.executor.submit(
                    self._upload_part, bucket, key, upload_id, part_number, chunk
                )
                futures.append((part_number, future))
                part_number += 1

            # Collect results
            for part_num, future in futures:
                etag = future.result()
                parts.append({"ETag": etag, "PartNumber": part_num})

            # Complete multipart upload
            response = self.s3_client.complete_multipart_upload(
                Bucket=bucket,
                Key=key,
                UploadId=upload_id,
                MultipartUpload={"Parts": sorted(parts, key=lambda x: x["PartNumber"])},
            )

            upload_time = (time.time() - start_time) * 1000

            # Cache metadata
            cached_metadata = {
                "ContentLength": total_size,
                "ContentType": content_type,
                "ETag": response.get("ETag", "").strip('"'),
                "LastModified": time.time(),
                "StorageClass": self.config.storage_class,
            }
            self._set_cached_metadata(bucket, key, cached_metadata)

            self.logger.info(
                "S3 multipart upload completed",
                bucket=bucket,
                key=key,
                size=total_size,
                parts=len(parts),
                upload_time_ms=upload_time,
            )

            return S3UploadResult(
                success=True,
                s3_key=key,
                bucket=bucket,
                size_bytes=total_size,
                etag=response.get("ETag", "").strip('"'),
                version_id=response.get("VersionId"),
                upload_time_ms=upload_time,
            )

        except Exception as e:
            # Abort multipart upload on error
            try:
                self.s3_client.abort_multipart_upload(
                    Bucket=bucket, Key=key, UploadId=upload_id
                )
            except Exception:
                pass
            raise e

    def _upload_part(
        self, bucket: str, key: str, upload_id: str, part_number: int, data: bytes
    ) -> str:
        """Upload a single part of multipart upload."""
        response = self.s3_client.upload_part(
            Bucket=bucket,
            Key=key,
            PartNumber=part_number,
            UploadId=upload_id,
            Body=data,
        )
        return response["ETag"]

    def get_object_metadata_cached(
        self, bucket: str, key: str
    ) -> Optional[Dict[str, Any]]:
        """Get object metadata with caching."""
        # Try cache first
        cached = self._get_cached_metadata(bucket, key)
        if cached:
            return cached

        try:
            response = self.s3_client.head_object(Bucket=bucket, Key=key)

            metadata = {
                "ContentLength": response.get("ContentLength", 0),
                "ContentType": response.get("ContentType", ""),
                "ETag": response.get("ETag", "").strip('"'),
                "LastModified": response.get("LastModified"),
                "StorageClass": response.get("StorageClass", "STANDARD"),
                "Metadata": response.get("Metadata", {}),
            }

            # Cache for future use
            self._set_cached_metadata(bucket, key, metadata)
            return metadata

        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise e

    def download_object_optimized(
        self, bucket: str, key: str
    ) -> Tuple[bytes, Dict[str, Any]]:
        """Download object with optimization."""
        start_time = time.time()

        try:
            # Get metadata first to check size
            metadata = self.get_object_metadata_cached(bucket, key)
            if not metadata:
                raise ClientError(
                    {"Error": {"Code": "NoSuchKey", "Message": "Object not found"}},
                    "HeadObject",
                )

            size = metadata["ContentLength"]

            # For large files, consider range requests
            if size > 100 * 1024 * 1024:  # 100MB
                return self._download_large_object(bucket, key, size)
            else:
                response = self.s3_client.get_object(Bucket=bucket, Key=key)
                data = response["Body"].read()

                download_time = (time.time() - start_time) * 1000
                self.logger.info(
                    "S3 download completed",
                    bucket=bucket,
                    key=key,
                    size=len(data),
                    download_time_ms=download_time,
                )

                return data, metadata

        except Exception as e:
            download_time = (time.time() - start_time) * 1000
            self.logger.error(
                f"S3 download failed: {str(e)}",
                bucket=bucket,
                key=key,
                download_time_ms=download_time,
            )
            raise

    def _download_large_object(
        self, bucket: str, key: str, size: int
    ) -> Tuple[bytes, Dict[str, Any]]:
        """Download large object using range requests."""
        chunk_size = 32 * 1024 * 1024  # 32MB chunks
        chunks = []

        # Download chunks concurrently
        futures = []
        for start in range(0, size, chunk_size):
            end = min(start + chunk_size - 1, size - 1)
            future = self.executor.submit(self._download_range, bucket, key, start, end)
            futures.append(future)

        # Collect chunks in order
        for future in futures:
            chunks.append(future.result())

        data = b"".join(chunks)
        metadata = self.get_object_metadata_cached(bucket, key)

        return data, metadata

    def _download_range(self, bucket: str, key: str, start: int, end: int) -> bytes:
        """Download a range of bytes from S3 object."""
        response = self.s3_client.get_object(
            Bucket=bucket, Key=key, Range=f"bytes={start}-{end}"
        )
        return response["Body"].read()

    def batch_delete_objects(self, bucket: str, keys: List[str]) -> Dict[str, Any]:
        """Delete multiple objects efficiently."""
        if not keys:
            return {"deleted": [], "errors": []}

        deleted = []
        errors = []

        # Process in batches of 1000 (S3 limit)
        batch_size = 1000
        for i in range(0, len(keys), batch_size):
            batch_keys = keys[i : i + batch_size]

            try:
                delete_objects = [{"Key": key} for key in batch_keys]
                response = self.s3_client.delete_objects(
                    Bucket=bucket, Delete={"Objects": delete_objects}
                )

                deleted.extend(response.get("Deleted", []))
                errors.extend(response.get("Errors", []))

                # Clear cached metadata
                for key in batch_keys:
                    cache_key = self._get_cache_key(bucket, key)
                    if cache_key in self.metadata_cache:
                        del self.metadata_cache[cache_key]

            except Exception as e:
                self.logger.error(
                    f"Batch delete failed: {str(e)}",
                    bucket=bucket,
                    batch_size=len(batch_keys),
                )
                errors.extend(
                    [
                        {"Key": key, "Code": "DeleteError", "Message": str(e)}
                        for key in batch_keys
                    ]
                )

        return {"deleted": deleted, "errors": errors}

    def cleanup(self):
        """Cleanup resources."""
        if hasattr(self, "executor"):
            self.executor.shutdown(wait=True)


def get_s3_optimizer(config: Optional[S3OperationConfig] = None) -> S3Optimizer:
    """Factory function to get S3 optimizer instance."""
    return S3Optimizer(config)
