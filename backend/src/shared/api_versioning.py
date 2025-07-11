"""
API Versioning and Backward Compatibility Framework for Manuel Backend
Provides version-aware request handling and response transformation
"""
import json
import re
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class ApiVersion(Enum):
    """Supported API versions"""
    V1_0 = "1.0"
    V1_1 = "1.1"
    V2_0 = "2.0"
    
    @classmethod
    def from_string(cls, version_str: str) -> 'ApiVersion':
        """Parse version string to enum"""
        # Normalize version string
        version_str = version_str.replace('v', '').replace('V', '')
        
        try:
            return cls(version_str)
        except ValueError:
            # Default to latest stable version for unknown versions
            return cls.V1_1


@dataclass
class VersionedRequest:
    """Container for version-aware API requests"""
    version: ApiVersion
    original_body: Dict[str, Any]
    normalized_body: Dict[str, Any]
    headers: Dict[str, str]
    query_params: Dict[str, str]


@dataclass
class VersionedResponse:
    """Container for version-aware API responses"""
    version: ApiVersion
    data: Dict[str, Any]
    status_code: int = 200


class ApiVersioningHandler:
    """Handles API versioning, request normalization, and response transformation"""
    
    def __init__(self):
        self.current_version = ApiVersion.V1_1
        self.supported_versions = [ApiVersion.V1_0, ApiVersion.V1_1]
        self.deprecated_versions = []
        
        # Version-specific transformers
        self.request_transformers = {
            ApiVersion.V1_0: self._transform_v1_0_request,
            ApiVersion.V1_1: self._transform_v1_1_request,
        }
        
        self.response_transformers = {
            ApiVersion.V1_0: self._transform_v1_0_response,
            ApiVersion.V1_1: self._transform_v1_1_response,
        }
    
    def extract_version_from_event(self, event: Dict[str, Any]) -> ApiVersion:
        """Extract API version from Lambda event"""
        
        # Method 1: Check Accept header (preferred)
        headers = event.get('headers', {})
        accept_header = headers.get('Accept', '') or headers.get('accept', '')
        
        version_match = re.search(r'application/vnd\.manuel\.v(\d+\.\d+)', accept_header)
        if version_match:
            return ApiVersion.from_string(version_match.group(1))
        
        # Method 2: Check custom API-Version header
        api_version_header = headers.get('API-Version', '') or headers.get('api-version', '')
        if api_version_header:
            return ApiVersion.from_string(api_version_header)
        
        # Method 3: Check query parameter
        query_params = event.get('queryStringParameters') or {}
        version_param = query_params.get('version', '') or query_params.get('api_version', '')
        if version_param:
            return ApiVersion.from_string(version_param)
        
        # Method 4: Check path prefix (e.g., /v1.1/query)
        path = event.get('path', '')
        path_match = re.match(r'^/v(\d+\.\d+)/', path)
        if path_match:
            return ApiVersion.from_string(path_match.group(1))
        
        # Default to current stable version
        return self.current_version
    
    def normalize_request(self, event: Dict[str, Any]) -> VersionedRequest:
        """Convert incoming request to current internal format"""
        
        version = self.extract_version_from_event(event)
        headers = event.get('headers', {})
        query_params = event.get('queryStringParameters') or {}
        
        # Parse request body
        original_body = {}
        if event.get('body'):
            try:
                original_body = json.loads(event['body'])
            except (json.JSONDecodeError, TypeError):
                original_body = {}
        
        # Transform request based on version
        transformer = self.request_transformers.get(version, self._transform_v1_1_request)
        normalized_body = transformer(original_body)
        
        return VersionedRequest(
            version=version,
            original_body=original_body,
            normalized_body=normalized_body,
            headers=headers,
            query_params=query_params
        )
    
    def format_response(self, version: ApiVersion, data: Dict[str, Any], 
                       status_code: int = 200) -> VersionedResponse:
        """Format response data according to requested API version"""
        
        transformer = self.response_transformers.get(version, self._transform_v1_1_response)
        transformed_data = transformer(data)
        
        return VersionedResponse(
            version=version,
            data=transformed_data,
            status_code=status_code
        )
    
    def create_version_headers(self, version: ApiVersion) -> Dict[str, str]:
        """Create response headers with version information"""
        
        headers = {
            'API-Version': version.value,
            'Content-Type': f'application/vnd.manuel.v{version.value}+json',
            'Supported-Versions': ','.join([v.value for v in self.supported_versions]),
            'Current-Version': self.current_version.value
        }
        
        if version in self.deprecated_versions:
            headers['Deprecation'] = 'true'
            headers['Sunset'] = self._get_sunset_date(version)
        
        return headers
    
    def validate_version_compatibility(self, version: ApiVersion) -> Tuple[bool, Optional[str]]:
        """Validate if requested version is supported"""
        
        if version not in self.supported_versions:
            return False, f"API version {version.value} is not supported. Supported versions: {[v.value for v in self.supported_versions]}"
        
        if version in self.deprecated_versions:
            return True, f"API version {version.value} is deprecated and will be removed on {self._get_sunset_date(version)}"
        
        return True, None
    
    def _transform_v1_0_request(self, body: Dict[str, Any]) -> Dict[str, Any]:
        """Transform v1.0 request to current internal format"""
        
        # v1.0 compatibility transformations
        normalized = body.copy()
        
        # Example: v1.0 used 'text' instead of 'question'
        if 'text' in normalized and 'question' not in normalized:
            normalized['question'] = normalized.pop('text')
        
        # Example: v1.0 had different audio format specification
        if 'audio_format' in normalized:
            content_type_map = {
                'mp4': 'audio/mp4',
                'wav': 'audio/wav',
                'webm': 'audio/webm'
            }
            format_value = normalized.pop('audio_format')
            if format_value in content_type_map:
                normalized['content_type'] = content_type_map[format_value]
        
        return normalized
    
    def _transform_v1_1_request(self, body: Dict[str, Any]) -> Dict[str, Any]:
        """Transform v1.1 request to current internal format"""
        # v1.1 is the current format, no transformation needed
        return body.copy()
    
    def _transform_v1_0_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform current response format to v1.0 format"""
        
        transformed = data.copy()
        
        # v1.0 compatibility transformations
        
        # Example: v1.0 expected 'text' instead of 'answer'
        if 'answer' in transformed:
            transformed['text'] = transformed.pop('answer')
        
        # Example: v1.0 had simpler cost structure
        if 'cost' in transformed:
            cost_data = transformed['cost']
            if isinstance(cost_data, dict):
                # Simplify cost data for v1.0
                transformed['cost'] = {
                    'total': cost_data.get('total_cost', 0),
                    'currency': cost_data.get('currency', 'USD')
                }
        
        # Example: v1.0 didn't have detailed usage info
        if 'usage' in transformed:
            usage_data = transformed['usage']
            if isinstance(usage_data, dict):
                # Simplify usage data for v1.0
                transformed['quota_remaining'] = usage_data.get('daily_limit', 0) - usage_data.get('daily_used', 0)
                del transformed['usage']
        
        # Add v1.0 metadata
        transformed['api_version'] = '1.0'
        
        return transformed
    
    def _transform_v1_1_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform current response format to v1.1 format"""
        
        transformed = data.copy()
        
        # Add v1.1 metadata
        transformed['api_version'] = '1.1'
        
        # v1.1 enhancements
        if 'cost' in transformed:
            cost_data = transformed['cost']
            if isinstance(cost_data, dict):
                # Add v1.1 specific cost metadata
                transformed['cost']['version'] = '1.1'
                transformed['cost']['detailed_breakdown'] = True
        
        return transformed
    
    def _get_sunset_date(self, version: ApiVersion) -> str:
        """Get sunset date for deprecated version"""
        # In a real implementation, this would be configurable
        sunset_dates = {
            ApiVersion.V1_0: "2025-12-31"
        }
        return sunset_dates.get(version, "TBD")
    
    def get_version_info(self) -> Dict[str, Any]:
        """Get comprehensive version information"""
        return {
            'current_version': self.current_version.value,
            'supported_versions': [v.value for v in self.supported_versions],
            'deprecated_versions': [v.value for v in self.deprecated_versions],
            'version_detection_methods': [
                'Accept header (application/vnd.manuel.v{version}+json)',
                'API-Version header',
                'version query parameter',
                'path prefix (/v{version}/endpoint)'
            ],
            'backward_compatibility': {
                'v1.0': {
                    'request_transformations': ['text->question', 'audio_format->content_type'],
                    'response_transformations': ['answer->text', 'simplified_cost', 'simplified_usage'],
                    'deprecated': False
                },
                'v1.1': {
                    'request_transformations': ['none (current format)'],
                    'response_transformations': ['enhanced_metadata'],
                    'deprecated': False
                }
            }
        }


def get_versioning_handler() -> ApiVersioningHandler:
    """Factory function to create versioning handler instance"""
    return ApiVersioningHandler()


def create_versioned_response(data: Dict[str, Any], version: ApiVersion, 
                            status_code: int = 200) -> Dict[str, Any]:
    """Utility function to create a properly versioned API response"""
    
    handler = get_versioning_handler()
    versioned_response = handler.format_response(version, data, status_code)
    version_headers = handler.create_version_headers(version)
    
    # Standard response format
    response = {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,API-Version',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            **version_headers
        },
        'body': json.dumps(versioned_response.data)
    }
    
    return response