"""
AWS Secrets Manager Integration
Provides secure secret management with caching and rotation support
"""

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, Optional, Union

import boto3
from botocore.exceptions import ClientError
from logger import get_logger


class SecretType(Enum):
    """Types of secrets"""

    API_KEY = "api_key"
    DATABASE_CREDENTIALS = "database_credentials"
    ENCRYPTION_KEY = "encryption_key"
    OAUTH_CREDENTIALS = "oauth_credentials"
    SIGNING_KEY = "signing_key"
    EXTERNAL_SERVICE = "external_service"


@dataclass
class SecretMetadata:
    """Secret metadata"""

    name: str
    secret_type: SecretType
    version_id: str
    created_date: datetime
    last_changed_date: datetime
    next_rotation_date: Optional[datetime] = None
    description: Optional[str] = None


@dataclass
class CachedSecret:
    """Cached secret with TTL"""

    value: Union[str, Dict[str, Any]]
    metadata: SecretMetadata
    cached_at: datetime
    ttl_seconds: int

    @property
    def is_expired(self) -> bool:
        """Check if cached secret has expired"""
        return (datetime.utcnow() - self.cached_at).total_seconds() > self.ttl_seconds


class SecretsManager:
    """AWS Secrets Manager client with caching and security features"""

    def __init__(self, region: Optional[str] = None):
        self.logger = get_logger("secrets-manager")
        self.region = region or os.environ.get("AWS_REGION", "eu-west-1")

        # Initialize AWS Secrets Manager client
        self.client = boto3.client("secretsmanager", region_name=self.region)

        # In-memory cache for secrets (with TTL)
        self._cache: Dict[str, CachedSecret] = {}

        # Default cache TTL (5 minutes)
        self.default_cache_ttl = int(os.environ.get("SECRETS_CACHE_TTL", "300"))

        # Maximum cache size
        self.max_cache_size = int(os.environ.get("SECRETS_MAX_CACHE_SIZE", "100"))

        # Secret name prefix for this application
        self.secret_prefix = os.environ.get("SECRET_PREFIX", "manuel")

    def get_secret(
        self, secret_name: str, use_cache: bool = True, version_id: Optional[str] = None
    ) -> Union[str, Dict[str, Any]]:
        """
        Retrieve a secret from AWS Secrets Manager

        Args:
            secret_name: Name of the secret
            use_cache: Whether to use cached value if available
            version_id: Specific version of the secret to retrieve

        Returns:
            Secret value (string or parsed JSON dict)

        Raises:
            ClientError: If secret cannot be retrieved
        """
        try:
            # Construct full secret name
            full_secret_name = self._construct_secret_name(secret_name)
            cache_key = f"{full_secret_name}#{version_id or 'latest'}"

            # Check cache first
            if use_cache and cache_key in self._cache:
                cached_secret = self._cache[cache_key]
                if not cached_secret.is_expired:
                    self.logger.debug(
                        "Secret retrieved from cache",
                        secret_name=secret_name,
                        cache_key=cache_key,
                    )
                    return cached_secret.value
                else:
                    # Remove expired secret from cache
                    del self._cache[cache_key]

            # Retrieve secret from AWS
            secret_value, metadata = self._retrieve_secret_from_aws(
                full_secret_name, version_id
            )

            # Cache the secret
            if use_cache:
                self._cache_secret(cache_key, secret_value, metadata)

            self.logger.info(
                "Secret retrieved successfully",
                secret_name=secret_name,
                version_id=metadata.version_id,
                cached=use_cache,
            )

            return secret_value

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")

            if error_code == "ResourceNotFoundException":
                self.logger.error(f"Secret not found: {secret_name}")
                raise ValueError(f"Secret '{secret_name}' not found")
            elif error_code == "InvalidRequestException":
                self.logger.error(f"Invalid request for secret: {secret_name}")
                raise ValueError(f"Invalid request for secret '{secret_name}'")
            elif error_code == "InvalidParameterException":
                self.logger.error(f"Invalid parameter for secret: {secret_name}")
                raise ValueError(f"Invalid parameter for secret '{secret_name}'")
            elif error_code == "DecryptionFailureException":
                self.logger.error(f"Failed to decrypt secret: {secret_name}")
                raise RuntimeError(f"Failed to decrypt secret '{secret_name}'")
            elif error_code == "InternalServiceErrorException":
                self.logger.error(f"AWS Secrets Manager internal error: {secret_name}")
                raise RuntimeError("AWS Secrets Manager service error")
            else:
                self.logger.error(
                    f"Unknown error retrieving secret: {secret_name}", error=str(e)
                )
                raise

        except Exception as e:
            self.logger.error(
                f"Unexpected error retrieving secret: {secret_name}", error=str(e)
            )
            raise

    def create_secret(
        self,
        secret_name: str,
        secret_value: Union[str, Dict[str, Any]],
        secret_type: SecretType,
        description: Optional[str] = None,
        enable_rotation: bool = False,
        rotation_lambda_arn: Optional[str] = None,
    ) -> str:
        """
        Create a new secret in AWS Secrets Manager

        Args:
            secret_name: Name of the secret
            secret_value: Secret value (string or dict)
            secret_type: Type of secret
            description: Description of the secret
            enable_rotation: Whether to enable automatic rotation
            rotation_lambda_arn: Lambda function ARN for rotation

        Returns:
            ARN of the created secret
        """
        try:
            full_secret_name = self._construct_secret_name(secret_name)

            # Prepare secret string
            if isinstance(secret_value, dict):
                secret_string = json.dumps(secret_value)
            else:
                secret_string = str(secret_value)

            # Create secret
            create_params = {
                "Name": full_secret_name,
                "SecretString": secret_string,
                "Description": description
                or f"Manuel {secret_type.value}: {secret_name}",
                "Tags": [
                    {"Key": "Application", "Value": "Manuel"},
                    {"Key": "SecretType", "Value": secret_type.value},
                    {"Key": "Environment", "Value": os.environ.get("STAGE", "dev")},
                    {"Key": "CreatedBy", "Value": "SecretsManager"},
                ],
            }

            response = self.client.create_secret(**create_params)
            secret_arn = response["ARN"]

            # Configure rotation if requested
            if enable_rotation and rotation_lambda_arn:
                self._configure_rotation(secret_arn, rotation_lambda_arn)

            self.logger.info(
                "Secret created successfully",
                secret_name=secret_name,
                secret_type=secret_type.value,
                arn=secret_arn,
                rotation_enabled=enable_rotation,
            )

            return secret_arn

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")

            if error_code == "ResourceExistsException":
                self.logger.error(f"Secret already exists: {secret_name}")
                raise ValueError(f"Secret '{secret_name}' already exists")
            else:
                self.logger.error(
                    f"Failed to create secret: {secret_name}", error=str(e)
                )
                raise

        except Exception as e:
            self.logger.error(
                f"Unexpected error creating secret: {secret_name}", error=str(e)
            )
            raise

    def update_secret(
        self,
        secret_name: str,
        secret_value: Union[str, Dict[str, Any]],
        version_stage: str = "AWSCURRENT",
    ) -> str:
        """
        Update an existing secret

        Args:
            secret_name: Name of the secret
            secret_value: New secret value
            version_stage: Version stage for the new value

        Returns:
            Version ID of the updated secret
        """
        try:
            full_secret_name = self._construct_secret_name(secret_name)

            # Prepare secret string
            if isinstance(secret_value, dict):
                secret_string = json.dumps(secret_value)
            else:
                secret_string = str(secret_value)

            response = self.client.update_secret(
                SecretId=full_secret_name, SecretString=secret_string
            )

            version_id = response["VersionId"]

            # Clear cache for this secret
            self._invalidate_cache(full_secret_name)

            self.logger.info(
                "Secret updated successfully",
                secret_name=secret_name,
                version_id=version_id,
            )

            return version_id

        except ClientError as e:
            self.logger.error(f"Failed to update secret: {secret_name}", error=str(e))
            raise

        except Exception as e:
            self.logger.error(
                f"Unexpected error updating secret: {secret_name}", error=str(e)
            )
            raise

    def delete_secret(
        self,
        secret_name: str,
        force_delete: bool = False,
        recovery_window_days: int = 30,
    ) -> None:
        """
        Delete a secret from AWS Secrets Manager

        Args:
            secret_name: Name of the secret to delete
            force_delete: Whether to force immediate deletion
            recovery_window_days: Recovery window (7-30 days)
        """
        try:
            full_secret_name = self._construct_secret_name(secret_name)

            delete_params = {"SecretId": full_secret_name}

            if force_delete:
                delete_params["ForceDeleteWithoutRecovery"] = True
            else:
                delete_params["RecoveryWindowInDays"] = recovery_window_days

            self.client.delete_secret(**delete_params)

            # Clear from cache
            self._invalidate_cache(full_secret_name)

            self.logger.info(
                "Secret deleted successfully",
                secret_name=secret_name,
                force_delete=force_delete,
                recovery_window=recovery_window_days if not force_delete else 0,
            )

        except ClientError as e:
            self.logger.error(f"Failed to delete secret: {secret_name}", error=str(e))
            raise

        except Exception as e:
            self.logger.error(
                f"Unexpected error deleting secret: {secret_name}", error=str(e)
            )
            raise

    def list_secrets(
        self, secret_type: Optional[SecretType] = None
    ) -> List[SecretMetadata]:
        """
        List all secrets for this application

        Args:
            secret_type: Filter by secret type

        Returns:
            List of secret metadata
        """
        try:
            secrets = []
            paginator = self.client.get_paginator("list_secrets")

            # Build filters
            filters = [
                {"Key": "tag-key", "Values": ["Application"]},
                {"Key": "tag-value", "Values": ["Manuel"]},
                {"Key": "name", "Values": [f"{self.secret_prefix}/*"]},
            ]

            if secret_type:
                filters.append({"Key": "tag-key", "Values": ["SecretType"]})
                filters.append({"Key": "tag-value", "Values": [secret_type.value]})

            for page in paginator.paginate(Filters=filters):
                for secret in page.get("SecretList", []):
                    metadata = self._parse_secret_metadata(secret)
                    if metadata:
                        secrets.append(metadata)

            self.logger.info(
                "Secrets listed successfully",
                count=len(secrets),
                secret_type=secret_type.value if secret_type else "all",
            )

            return secrets

        except Exception as e:
            self.logger.error("Failed to list secrets", error=str(e))
            raise

    def rotate_secret(self, secret_name: str, force_rotate: bool = False) -> str:
        """
        Trigger secret rotation

        Args:
            secret_name: Name of the secret to rotate
            force_rotate: Force rotation even if not due

        Returns:
            Version ID of the new secret version
        """
        try:
            full_secret_name = self._construct_secret_name(secret_name)

            params = {"SecretId": full_secret_name}
            if force_rotate:
                params["ForceRotateSecrets"] = True

            response = self.client.rotate_secret(**params)
            version_id = response["VersionId"]

            # Clear cache
            self._invalidate_cache(full_secret_name)

            self.logger.info(
                "Secret rotation initiated",
                secret_name=secret_name,
                version_id=version_id,
                force_rotate=force_rotate,
            )

            return version_id

        except ClientError as e:
            self.logger.error(f"Failed to rotate secret: {secret_name}", error=str(e))
            raise

        except Exception as e:
            self.logger.error(
                f"Unexpected error rotating secret: {secret_name}", error=str(e)
            )
            raise

    def get_secret_metadata(self, secret_name: str) -> SecretMetadata:
        """
        Get metadata for a secret

        Args:
            secret_name: Name of the secret

        Returns:
            Secret metadata
        """
        try:
            full_secret_name = self._construct_secret_name(secret_name)

            response = self.client.describe_secret(SecretId=full_secret_name)
            metadata = self._parse_secret_metadata(response)

            if not metadata:
                raise ValueError(f"Unable to parse metadata for secret: {secret_name}")

            return metadata

        except ClientError as e:
            self.logger.error(
                f"Failed to get secret metadata: {secret_name}", error=str(e)
            )
            raise

        except Exception as e:
            self.logger.error(
                f"Unexpected error getting secret metadata: {secret_name}", error=str(e)
            )
            raise

    def clear_cache(self, secret_name: Optional[str] = None) -> None:
        """
        Clear secrets cache

        Args:
            secret_name: Specific secret to clear, or None for all
        """
        if secret_name:
            full_secret_name = self._construct_secret_name(secret_name)
            self._invalidate_cache(full_secret_name)
        else:
            self._cache.clear()

        self.logger.info("Secrets cache cleared", secret_name=secret_name or "all")

    def _retrieve_secret_from_aws(
        self, secret_name: str, version_id: Optional[str]
    ) -> tuple[Union[str, Dict], SecretMetadata]:
        """Retrieve secret from AWS Secrets Manager"""
        params = {"SecretId": secret_name}
        if version_id:
            params["VersionId"] = version_id

        response = self.client.get_secret_value(**params)

        # Parse secret value
        secret_string = response.get("SecretString")
        if secret_string:
            try:
                # Try to parse as JSON
                secret_value = json.loads(secret_string)
            except json.JSONDecodeError:
                # Return as string if not valid JSON
                secret_value = secret_string
        else:
            # Handle binary secrets if needed
            secret_value = response.get("SecretBinary", "")

        # Parse metadata
        metadata = SecretMetadata(
            name=response["Name"],
            secret_type=SecretType.API_KEY,  # Default, should be determined from tags
            version_id=response["VersionId"],
            created_date=response["CreatedDate"],
            last_changed_date=response.get("LastChangedDate", response["CreatedDate"]),
        )

        return secret_value, metadata

    def _cache_secret(
        self, cache_key: str, value: Union[str, Dict], metadata: SecretMetadata
    ) -> None:
        """Cache a secret with TTL"""
        # Implement cache size limit
        if len(self._cache) >= self.max_cache_size:
            # Remove oldest cache entry
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k].cached_at)
            del self._cache[oldest_key]

        self._cache[cache_key] = CachedSecret(
            value=value,
            metadata=metadata,
            cached_at=datetime.utcnow(),
            ttl_seconds=self.default_cache_ttl,
        )

    def _invalidate_cache(self, secret_name: str) -> None:
        """Invalidate cache entries for a secret"""
        keys_to_remove = [
            key for key in self._cache.keys() if key.startswith(secret_name)
        ]
        for key in keys_to_remove:
            del self._cache[key]

    def _construct_secret_name(self, secret_name: str) -> str:
        """Construct full secret name with prefix"""
        if secret_name.startswith(f"{self.secret_prefix}/"):
            return secret_name
        return f"{self.secret_prefix}/{secret_name}"

    def _parse_secret_metadata(self, secret_data: Dict) -> Optional[SecretMetadata]:
        """Parse secret metadata from AWS response"""
        try:
            # Extract secret type from tags
            secret_type = SecretType.API_KEY  # Default
            tags = secret_data.get("Tags", [])
            for tag in tags:
                if tag.get("Key") == "SecretType":
                    try:
                        secret_type = SecretType(tag["Value"])
                    except ValueError:
                        pass
                    break

            return SecretMetadata(
                name=secret_data["Name"],
                secret_type=secret_type,
                version_id=secret_data.get("VersionId", ""),
                created_date=secret_data["CreatedDate"],
                last_changed_date=secret_data.get(
                    "LastChangedDate", secret_data["CreatedDate"]
                ),
                next_rotation_date=secret_data.get("NextRotationDate"),
                description=secret_data.get("Description"),
            )

        except Exception as e:
            self.logger.warning("Failed to parse secret metadata", error=str(e))
            return None

    def _configure_rotation(self, secret_arn: str, rotation_lambda_arn: str) -> None:
        """Configure automatic rotation for a secret"""
        try:
            self.client.update_secret_version_stage(
                SecretId=secret_arn, VersionStage="AWSCURRENT"
            )

            self.client.rotate_secret(
                SecretId=secret_arn,
                RotationLambdaARN=rotation_lambda_arn,
                RotationRules={"AutomaticallyAfterDays": 30},
            )

            self.logger.info(
                "Secret rotation configured",
                secret_arn=secret_arn,
                lambda_arn=rotation_lambda_arn,
            )

        except Exception as e:
            self.logger.error("Failed to configure rotation", error=str(e))
            raise


# Convenience functions for common secret operations
def get_database_credentials(db_name: str) -> Dict[str, str]:
    """Get database credentials from Secrets Manager"""
    manager = SecretsManager()
    secret_name = f"database/{db_name}"
    credentials = manager.get_secret(secret_name)

    if not isinstance(credentials, dict):
        raise ValueError(f"Invalid database credentials format for {db_name}")

    required_fields = ["username", "password", "host", "port", "dbname"]
    for field in required_fields:
        if field not in credentials:
            raise ValueError(
                f"Missing required field '{field}' in database credentials"
            )

    return credentials


def get_api_key(service_name: str) -> str:
    """Get API key for external service"""
    manager = SecretsManager()
    secret_name = f"api-key/{service_name}"
    api_key = manager.get_secret(secret_name)

    if not isinstance(api_key, str):
        raise ValueError(f"Invalid API key format for {service_name}")

    return api_key


def get_encryption_key(key_name: str) -> str:
    """Get encryption key"""
    manager = SecretsManager()
    secret_name = f"encryption/{key_name}"
    encryption_key = manager.get_secret(secret_name)

    if not isinstance(encryption_key, str):
        raise ValueError(f"Invalid encryption key format for {key_name}")

    return encryption_key


def get_secrets_manager() -> SecretsManager:
    """Factory function to get SecretsManager instance"""
    return SecretsManager()
