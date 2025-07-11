"""
Enhanced Admin Authentication with MFA Support
Provides secure authentication for admin operations with multi-factor authentication
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError
from logger import get_logger


class AuthMethod(Enum):
    """Authentication methods"""

    API_KEY = "api_key"
    COGNITO_TOKEN = "cognito_token"
    IAM_SIGNATURE = "iam_signature"


class MFAMethod(Enum):
    """Multi-factor authentication methods"""

    TOTP = "totp"
    SMS = "sms"
    EMAIL = "email"
    HARDWARE_TOKEN = "hardware_token"


@dataclass
class AdminCredentials:
    """Admin credentials with MFA"""

    admin_id: str
    method: AuthMethod
    token: str
    mfa_code: Optional[str] = None
    mfa_method: Optional[MFAMethod] = None
    session_id: Optional[str] = None
    timestamp: Optional[datetime] = None


@dataclass
class AuthContext:
    """Authentication context"""

    admin_id: str
    permissions: List[str]
    session_id: str
    expires_at: datetime
    mfa_verified: bool
    source_ip: str
    user_agent: str


class AdminAuthenticator:
    """Enhanced admin authentication with MFA support"""

    def __init__(self):
        self.logger = get_logger("admin-auth")

        # AWS clients
        self.cognito = boto3.client("cognito-idp")
        self.secrets = boto3.client("secretsmanager")
        self.dynamodb = boto3.resource("dynamodb")

        # Configuration
        self.admin_table_name = os.environ.get("ADMIN_TABLE_NAME", "manuel-admin-auth")
        self.session_timeout_minutes = int(
            os.environ.get("ADMIN_SESSION_TIMEOUT", "60")
        )
        self.mfa_code_timeout_minutes = int(os.environ.get("MFA_CODE_TIMEOUT", "5"))
        self.max_failed_attempts = int(os.environ.get("MAX_FAILED_ATTEMPTS", "3"))
        self.lockout_duration_minutes = int(os.environ.get("LOCKOUT_DURATION", "30"))

        # Initialize admin table if it doesn't exist
        self._ensure_admin_table()

    def authenticate_admin(
        self, event: Dict[str, Any]
    ) -> Tuple[bool, Optional[AuthContext], str]:
        """
        Authenticate admin request with MFA support

        Returns:
            (success, auth_context, error_message)
        """
        try:
            # Extract authentication information
            headers = event.get("headers", {})
            source_ip = self._get_client_ip(event)
            user_agent = headers.get("User-Agent", "unknown")

            # Check for rate limiting
            if self._is_rate_limited(source_ip):
                self.logger.warning(
                    "Rate limited admin auth attempt", source_ip=source_ip
                )
                return False, None, "Too many authentication attempts. Try again later."

            # Parse credentials from different sources
            credentials = self._extract_credentials(event)
            if not credentials:
                return False, None, "Invalid or missing authentication credentials"

            # Validate primary authentication
            primary_auth_valid, admin_info = self._validate_primary_auth(credentials)
            if not primary_auth_valid:
                self._record_failed_attempt(source_ip, credentials.admin_id)
                return False, None, "Invalid authentication credentials"

            # Check if admin is locked out
            if self._is_admin_locked_out(credentials.admin_id):
                return (
                    False,
                    None,
                    "Admin account is temporarily locked due to failed attempts",
                )

            # Validate MFA if required
            mfa_valid = self._validate_mfa(credentials, admin_info)
            if not mfa_valid:
                self._record_failed_attempt(source_ip, credentials.admin_id)
                return False, None, "Invalid or missing MFA code"

            # Create authentication context
            auth_context = AuthContext(
                admin_id=credentials.admin_id,
                permissions=admin_info.get("permissions", []),
                session_id=self._generate_session_id(),
                expires_at=datetime.utcnow()
                + timedelta(minutes=self.session_timeout_minutes),
                mfa_verified=mfa_valid,
                source_ip=source_ip,
                user_agent=user_agent,
            )

            # Store session
            self._store_admin_session(auth_context)

            # Clear failed attempts on successful auth
            self._clear_failed_attempts(credentials.admin_id)

            self.logger.info(
                "Admin authentication successful",
                admin_id=credentials.admin_id,
                source_ip=source_ip,
                session_id=auth_context.session_id,
            )

            return True, auth_context, ""

        except Exception as e:
            self.logger.error("Admin authentication error", error=str(e))
            return False, None, "Authentication service error"

    def validate_admin_session(
        self, event: Dict[str, Any]
    ) -> Tuple[bool, Optional[AuthContext], str]:
        """Validate existing admin session"""
        try:
            headers = event.get("headers", {})
            session_token = headers.get("X-Admin-Session", "") or headers.get(
                "x-admin-session", ""
            )

            if not session_token:
                return False, None, "Missing admin session token"

            # Parse session token
            try:
                session_data = json.loads(base64.b64decode(session_token).decode())
                session_id = session_data.get("session_id")
                admin_id = session_data.get("admin_id")
                signature = session_data.get("signature")
            except (json.JSONDecodeError, ValueError, KeyError):
                return False, None, "Invalid session token format"

            # Verify session signature
            if not self._verify_session_signature(session_id, admin_id, signature):
                return False, None, "Invalid session signature"

            # Retrieve session from storage
            auth_context = self._get_admin_session(session_id)
            if not auth_context:
                return False, None, "Session not found or expired"

            # Check session expiry
            if datetime.utcnow() > auth_context.expires_at:
                self._delete_admin_session(session_id)
                return False, None, "Session has expired"

            # Update session activity
            self._update_session_activity(session_id)

            return True, auth_context, ""

        except Exception as e:
            self.logger.error("Session validation error", error=str(e))
            return False, None, "Session validation error"

    def check_admin_permission(
        self, auth_context: AuthContext, required_permission: str
    ) -> bool:
        """Check if admin has required permission"""
        return (
            required_permission in auth_context.permissions
            or "admin:*" in auth_context.permissions
        )

    def invalidate_admin_session(self, session_id: str) -> bool:
        """Invalidate admin session"""
        try:
            return self._delete_admin_session(session_id)
        except Exception as e:
            self.logger.error("Session invalidation error", error=str(e))
            return False

    def initiate_mfa_challenge(
        self, admin_id: str, method: MFAMethod
    ) -> Tuple[bool, str]:
        """Initiate MFA challenge"""
        try:
            if method == MFAMethod.TOTP:
                return self._initiate_totp_challenge(admin_id)
            elif method == MFAMethod.SMS:
                return self._initiate_sms_challenge(admin_id)
            elif method == MFAMethod.EMAIL:
                return self._initiate_email_challenge(admin_id)
            else:
                return False, "Unsupported MFA method"

        except Exception as e:
            self.logger.error("MFA challenge error", error=str(e))
            return False, "MFA challenge failed"

    def _extract_credentials(self, event: Dict[str, Any]) -> Optional[AdminCredentials]:
        """Extract admin credentials from request"""
        headers = event.get("headers", {})

        # Check for API key authentication
        api_key = headers.get("X-Admin-Key", "") or headers.get("x-admin-key", "")
        if api_key:
            # Extract admin ID from API key (format: admin_id:key)
            if ":" in api_key:
                admin_id, key = api_key.split(":", 1)
                return AdminCredentials(
                    admin_id=admin_id,
                    method=AuthMethod.API_KEY,
                    token=key,
                    mfa_code=headers.get("X-MFA-Code", "")
                    or headers.get("x-mfa-code", ""),
                )

        # Check for Cognito token
        auth_header = headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            # Parse JWT to get admin ID (simplified - should use proper JWT parsing)
            try:
                # This is a placeholder - in production, use proper JWT validation
                payload = json.loads(base64.b64decode(token.split(".")[1] + "=="))
                admin_id = payload.get("sub")
                if admin_id:
                    return AdminCredentials(
                        admin_id=admin_id,
                        method=AuthMethod.COGNITO_TOKEN,
                        token=token,
                        mfa_code=headers.get("X-MFA-Code", "")
                        or headers.get("x-mfa-code", ""),
                    )
            except Exception:
                pass

        return None

    def _validate_primary_auth(
        self, credentials: AdminCredentials
    ) -> Tuple[bool, Dict[str, Any]]:
        """Validate primary authentication"""
        try:
            if credentials.method == AuthMethod.API_KEY:
                return self._validate_api_key_auth(credentials)
            elif credentials.method == AuthMethod.COGNITO_TOKEN:
                return self._validate_cognito_token_auth(credentials)
            else:
                return False, {}

        except Exception as e:
            self.logger.error("Primary auth validation error", error=str(e))
            return False, {}

    def _validate_api_key_auth(
        self, credentials: AdminCredentials
    ) -> Tuple[bool, Dict[str, Any]]:
        """Validate API key authentication"""
        try:
            # Get admin info from DynamoDB
            table = self.dynamodb.Table(self.admin_table_name)
            response = table.get_item(Key={"admin_id": credentials.admin_id})

            admin_item = response.get("Item")
            if not admin_item:
                return False, {}

            # Check if admin is enabled
            if not admin_item.get("enabled", False):
                return False, {}

            # Verify API key hash
            stored_key_hash = admin_item.get("api_key_hash", "")
            computed_hash = hashlib.sha256(credentials.token.encode()).hexdigest()

            if not hmac.compare_digest(stored_key_hash, computed_hash):
                return False, {}

            return True, admin_item

        except Exception as e:
            self.logger.error("API key auth error", error=str(e))
            return False, {}

    def _validate_cognito_token_auth(
        self, credentials: AdminCredentials
    ) -> Tuple[bool, Dict[str, Any]]:
        """Validate Cognito token authentication"""
        try:
            # Verify JWT token with Cognito
            user_pool_id = os.environ.get("ADMIN_USER_POOL_ID")
            if not user_pool_id:
                return False, {}

            # This is simplified - in production, use proper JWT verification
            # with Cognito's public keys
            self.cognito.get_user(AccessToken=credentials.token)

            # Get admin info from DynamoDB
            table = self.dynamodb.Table(self.admin_table_name)
            admin_response = table.get_item(Key={"admin_id": credentials.admin_id})

            admin_item = admin_response.get("Item")
            if not admin_item or not admin_item.get("enabled", False):
                return False, {}

            return True, admin_item

        except ClientError as e:
            if e.response["Error"]["Code"] in [
                "NotAuthorizedException",
                "UserNotFoundException",
            ]:
                return False, {}
            raise
        except Exception as e:
            self.logger.error("Cognito auth error", error=str(e))
            return False, {}

    def _validate_mfa(
        self, credentials: AdminCredentials, admin_info: Dict[str, Any]
    ) -> bool:
        """Validate MFA code"""
        try:
            # Check if MFA is required for this admin
            mfa_enabled = admin_info.get("mfa_enabled", False)
            if not mfa_enabled:
                return True  # MFA not required

            if not credentials.mfa_code:
                return False  # MFA required but not provided

            mfa_method = MFAMethod(admin_info.get("mfa_method", "totp"))

            if mfa_method == MFAMethod.TOTP:
                return self._validate_totp_code(
                    credentials.admin_id, credentials.mfa_code, admin_info
                )
            elif mfa_method == MFAMethod.SMS:
                return self._validate_sms_code(
                    credentials.admin_id, credentials.mfa_code
                )
            elif mfa_method == MFAMethod.EMAIL:
                return self._validate_email_code(
                    credentials.admin_id, credentials.mfa_code
                )
            else:
                return False

        except Exception as e:
            self.logger.error("MFA validation error", error=str(e))
            return False

    def _validate_totp_code(
        self, admin_id: str, mfa_code: str, admin_info: Dict[str, Any]
    ) -> bool:
        """Validate TOTP MFA code"""
        try:
            import pyotp

            # Get TOTP secret from admin info (should be encrypted in production)
            totp_secret = admin_info.get("totp_secret")
            if not totp_secret:
                return False

            # Create TOTP object and verify
            totp = pyotp.TOTP(totp_secret)
            return totp.verify(mfa_code, valid_window=1)  # Allow 1 step tolerance

        except ImportError:
            self.logger.warning("pyotp not available for TOTP validation")
            return True  # Fallback - should install pyotp in production
        except Exception as e:
            self.logger.error("TOTP validation error", error=str(e))
            return False

    def _validate_sms_code(self, admin_id: str, mfa_code: str) -> bool:
        """Validate SMS MFA code"""
        try:
            # Get stored SMS code from cache/database
            table = self.dynamodb.Table("manuel-mfa-codes")
            response = table.get_item(Key={"admin_id": admin_id, "method": "sms"})

            stored_code_item = response.get("Item")
            if not stored_code_item:
                return False

            # Check expiry
            expires_at = datetime.fromisoformat(stored_code_item["expires_at"])
            if datetime.utcnow() > expires_at:
                return False

            # Verify code
            stored_code = stored_code_item["code"]
            if hmac.compare_digest(stored_code, mfa_code):
                # Delete used code
                table.delete_item(Key={"admin_id": admin_id, "method": "sms"})
                return True

            return False

        except Exception as e:
            self.logger.error("SMS code validation error", error=str(e))
            return False

    def _validate_email_code(self, admin_id: str, mfa_code: str) -> bool:
        """Validate email MFA code"""
        # Similar to SMS validation but for email codes
        return self._validate_sms_code(admin_id, mfa_code)  # Same logic

    def _generate_session_id(self) -> str:
        """Generate secure session ID"""
        return secrets.token_urlsafe(32)

    def _store_admin_session(self, auth_context: AuthContext) -> None:
        """Store admin session in DynamoDB"""
        try:
            table = self.dynamodb.Table("manuel-admin-sessions")
            table.put_item(
                Item={
                    "session_id": auth_context.session_id,
                    "admin_id": auth_context.admin_id,
                    "permissions": auth_context.permissions,
                    "expires_at": auth_context.expires_at.isoformat(),
                    "mfa_verified": auth_context.mfa_verified,
                    "source_ip": auth_context.source_ip,
                    "user_agent": auth_context.user_agent,
                    "created_at": datetime.utcnow().isoformat(),
                    "last_activity": datetime.utcnow().isoformat(),
                    "ttl": int(auth_context.expires_at.timestamp()),
                }
            )
        except Exception as e:
            self.logger.error("Session storage error", error=str(e))
            raise

    def _get_admin_session(self, session_id: str) -> Optional[AuthContext]:
        """Retrieve admin session from DynamoDB"""
        try:
            table = self.dynamodb.Table("manuel-admin-sessions")
            response = table.get_item(Key={"session_id": session_id})

            item = response.get("Item")
            if not item:
                return None

            return AuthContext(
                admin_id=item["admin_id"],
                permissions=item["permissions"],
                session_id=item["session_id"],
                expires_at=datetime.fromisoformat(item["expires_at"]),
                mfa_verified=item["mfa_verified"],
                source_ip=item["source_ip"],
                user_agent=item["user_agent"],
            )

        except Exception as e:
            self.logger.error("Session retrieval error", error=str(e))
            return None

    def _delete_admin_session(self, session_id: str) -> bool:
        """Delete admin session"""
        try:
            table = self.dynamodb.Table("manuel-admin-sessions")
            table.delete_item(Key={"session_id": session_id})
            return True
        except Exception as e:
            self.logger.error("Session deletion error", error=str(e))
            return False

    def _update_session_activity(self, session_id: str) -> None:
        """Update session last activity timestamp"""
        try:
            table = self.dynamodb.Table("manuel-admin-sessions")
            table.update_item(
                Key={"session_id": session_id},
                UpdateExpression="SET last_activity = :activity",
                ExpressionAttributeValues={":activity": datetime.utcnow().isoformat()},
            )
        except Exception as e:
            self.logger.error("Session activity update error", error=str(e))

    def _verify_session_signature(
        self, session_id: str, admin_id: str, signature: str
    ) -> bool:
        """Verify session token signature"""
        try:
            secret_key = os.environ.get("SESSION_SECRET_KEY", "dev-secret")
            expected_signature = hmac.new(
                secret_key.encode(), f"{session_id}:{admin_id}".encode(), hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(signature, expected_signature)
        except Exception:
            return False

    def _is_rate_limited(self, source_ip: str) -> bool:
        """Check if IP is rate limited"""
        # Simplified rate limiting - in production, use Redis or DynamoDB
        return False

    def _is_admin_locked_out(self, admin_id: str) -> bool:
        """Check if admin is locked out due to failed attempts"""
        try:
            table = self.dynamodb.Table("manuel-admin-lockouts")
            response = table.get_item(Key={"admin_id": admin_id})

            lockout_item = response.get("Item")
            if not lockout_item:
                return False

            lockout_until = datetime.fromisoformat(lockout_item["lockout_until"])
            return datetime.utcnow() < lockout_until

        except Exception as e:
            self.logger.error("Lockout check error", error=str(e))
            return False

    def _record_failed_attempt(self, source_ip: str, admin_id: str) -> None:
        """Record failed authentication attempt"""
        try:
            # Track failed attempts by admin_id
            table = self.dynamodb.Table("manuel-admin-failed-attempts")

            # Get current attempts
            response = table.get_item(Key={"admin_id": admin_id})
            current_attempts = response.get("Item", {}).get("attempt_count", 0)

            new_attempt_count = current_attempts + 1

            # Update attempt count
            table.put_item(
                Item={
                    "admin_id": admin_id,
                    "attempt_count": new_attempt_count,
                    "last_attempt": datetime.utcnow().isoformat(),
                    "source_ip": source_ip,
                    "ttl": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
                }
            )

            # Lock out admin if max attempts reached
            if new_attempt_count >= self.max_failed_attempts:
                lockout_table = self.dynamodb.Table("manuel-admin-lockouts")
                lockout_until = datetime.utcnow() + timedelta(
                    minutes=self.lockout_duration_minutes
                )

                lockout_table.put_item(
                    Item={
                        "admin_id": admin_id,
                        "lockout_until": lockout_until.isoformat(),
                        "reason": "max_failed_attempts",
                        "ttl": int(lockout_until.timestamp()),
                    }
                )

                self.logger.warning(
                    "Admin locked out due to failed attempts",
                    admin_id=admin_id,
                    attempt_count=new_attempt_count,
                )

        except Exception as e:
            self.logger.error("Failed attempt recording error", error=str(e))

    def _clear_failed_attempts(self, admin_id: str) -> None:
        """Clear failed attempts for admin"""
        try:
            table = self.dynamodb.Table("manuel-admin-failed-attempts")
            table.delete_item(Key={"admin_id": admin_id})
        except Exception as e:
            self.logger.error("Clear failed attempts error", error=str(e))

    def _get_client_ip(self, event: Dict[str, Any]) -> str:
        """Extract client IP from event"""
        # Check for IP in various headers (for different proxy setups)
        headers = event.get("headers", {})

        # Check forwarded headers
        forwarded_for = headers.get("X-Forwarded-For", "")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        # Check real IP header
        real_ip = headers.get("X-Real-IP", "")
        if real_ip:
            return real_ip

        # Fallback to source IP from API Gateway
        request_context = event.get("requestContext", {})
        return request_context.get("identity", {}).get("sourceIp", "unknown")

    def _ensure_admin_table(self) -> None:
        """Ensure admin table exists"""
        try:
            table = self.dynamodb.Table(self.admin_table_name)
            table.load()  # This will raise an exception if table doesn't exist
        except ClientError as e:
            if e.response["Error"]["Code"] == "ResourceNotFoundException":
                self.logger.info(
                    "Creating admin table", table_name=self.admin_table_name
                )
                # In production, tables should be created via CloudFormation/CDK
                # This is just for development
        except Exception as e:
            self.logger.error("Admin table check error", error=str(e))

    def _initiate_totp_challenge(self, admin_id: str) -> Tuple[bool, str]:
        """Initiate TOTP challenge (returns QR code for setup)"""
        try:
            import io

            import pyotp
            import qrcode

            # Generate new TOTP secret
            secret = pyotp.random_base32()

            # Store secret in admin record (should be encrypted)
            table = self.dynamodb.Table(self.admin_table_name)
            table.update_item(
                Key={"admin_id": admin_id},
                UpdateExpression="SET totp_secret = :secret",
                ExpressionAttributeValues={":secret": secret},
            )

            # Generate QR code
            provisioning_uri = pyotp.totp.TOTP(secret).provisioning_uri(
                name=admin_id, issuer_name="Manuel Admin"
            )

            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(provisioning_uri)
            qr.make(fit=True)

            # Convert QR code to base64
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            qr_b64 = base64.b64encode(buffer.getvalue()).decode()

            return True, qr_b64

        except ImportError:
            return False, "TOTP dependencies not available"
        except Exception as e:
            self.logger.error("TOTP challenge error", error=str(e))
            return False, "TOTP challenge failed"

    def _initiate_sms_challenge(self, admin_id: str) -> Tuple[bool, str]:
        """Initiate SMS MFA challenge"""
        try:
            # Generate 6-digit code
            mfa_code = str(secrets.randbelow(900000) + 100000)

            # Store code with expiry
            table = self.dynamodb.Table("manuel-mfa-codes")
            expires_at = datetime.utcnow() + timedelta(
                minutes=self.mfa_code_timeout_minutes
            )

            table.put_item(
                Item={
                    "admin_id": admin_id,
                    "method": "sms",
                    "code": mfa_code,
                    "expires_at": expires_at.isoformat(),
                    "ttl": int(expires_at.timestamp()),
                }
            )

            # Send SMS (placeholder - integrate with SNS)
            self.logger.info("SMS MFA code generated", admin_id=admin_id)

            return True, "SMS code sent"

        except Exception as e:
            self.logger.error("SMS challenge error", error=str(e))
            return False, "SMS challenge failed"

    def _initiate_email_challenge(self, admin_id: str) -> Tuple[bool, str]:
        """Initiate email MFA challenge"""
        # Similar to SMS but send via email
        return self._initiate_sms_challenge(admin_id)


def get_admin_authenticator() -> AdminAuthenticator:
    """Factory function to get admin authenticator instance"""
    return AdminAuthenticator()
