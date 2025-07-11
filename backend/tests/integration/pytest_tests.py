"""
Pytest-based integration tests for Manuel Backend
Provides traditional pytest interface alongside the custom framework
"""

import pytest
import json
import os
import sys
from typing import Dict, Any, Optional
from unittest.mock import patch, MagicMock

# Add the src directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from test_framework import IntegrationTestFramework, TestConfig, MockAWSServices


class TestIntegrationFramework:
    """Pytest wrapper for the integration test framework"""
    
    @pytest.fixture(scope="class")
    def test_config(self):
        """Load test configuration"""
        config_path = os.path.join(os.path.dirname(__file__), 'test_config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config_data = json.load(f)
            return TestConfig(**config_data)
        return TestConfig()
    
    @pytest.fixture(scope="class")
    def framework(self, test_config):
        """Initialize test framework"""
        return IntegrationTestFramework(test_config)
    
    @pytest.fixture(scope="class")
    def mock_aws(self):
        """Mock AWS services for testing"""
        with MockAWSServices() as aws:
            yield aws


@pytest.mark.auth
class TestAuthentication(TestIntegrationFramework):
    """Authentication tests"""
    
    def test_user_authentication(self, framework):
        """Test user authentication functionality"""
        framework._test_user_authentication()
    
    def test_token_refresh(self, framework):
        """Test token refresh mechanism"""
        framework._test_token_refresh()
    
    def test_invalid_token(self, framework):
        """Test invalid token handling"""
        framework._test_invalid_token()
    
    def test_expired_token(self, framework):
        """Test expired token handling"""
        framework._test_expired_token()


@pytest.mark.api
class TestAPIFunctionality(TestIntegrationFramework):
    """API functionality tests"""
    
    def test_transcribe_endpoint(self, framework):
        """Test transcribe endpoint"""
        framework._test_transcribe_endpoint()
    
    def test_query_endpoint(self, framework):
        """Test query endpoint"""
        framework._test_query_endpoint()
    
    def test_usage_endpoint(self, framework):
        """Test usage endpoint"""
        framework._test_usage_endpoint()
    
    def test_manuals_endpoint(self, framework):
        """Test manuals endpoint"""
        framework._test_manuals_endpoint()
    
    def test_health_endpoint(self, framework):
        """Test health endpoint"""
        framework._test_health_endpoint()
    
    def test_version_endpoint(self, framework):
        """Test version endpoint"""
        framework._test_version_endpoint()


@pytest.mark.security
class TestSecurity(TestIntegrationFramework):
    """Security tests"""
    
    def test_sql_injection_protection(self, framework):
        """Test SQL injection protection"""
        if framework.config.enable_security_testing:
            framework._test_sql_injection_protection()
        else:
            pytest.skip("Security testing disabled")
    
    def test_xss_protection(self, framework):
        """Test XSS protection"""
        if framework.config.enable_security_testing:
            framework._test_xss_protection()
        else:
            pytest.skip("Security testing disabled")
    
    def test_rate_limiting(self, framework):
        """Test rate limiting"""
        if framework.config.enable_security_testing:
            framework._test_rate_limiting()
        else:
            pytest.skip("Security testing disabled")
    
    def test_request_size_limits(self, framework):
        """Test request size limits"""
        if framework.config.enable_security_testing:
            framework._test_request_size_limits()
        else:
            pytest.skip("Security testing disabled")
    
    def test_unauthorized_access(self, framework):
        """Test unauthorized access protection"""
        if framework.config.enable_security_testing:
            framework._test_unauthorized_access()
        else:
            pytest.skip("Security testing disabled")
    
    def test_cors_headers(self, framework):
        """Test CORS headers"""
        if framework.config.enable_security_testing:
            framework._test_cors_headers()
        else:
            pytest.skip("Security testing disabled")
    
    def test_security_headers(self, framework):
        """Test security headers"""
        if framework.config.enable_security_testing:
            framework._test_security_headers()
        else:
            pytest.skip("Security testing disabled")


@pytest.mark.performance
class TestPerformance(TestIntegrationFramework):
    """Performance tests"""
    
    def test_response_time(self, framework):
        """Test response time requirements"""
        framework._test_response_time()
    
    def test_concurrent_requests(self, framework):
        """Test concurrent request handling"""
        framework._test_concurrent_requests()
    
    def test_cache_performance(self, framework):
        """Test cache performance"""
        framework._test_cache_performance()
    
    def test_connection_pooling(self, framework):
        """Test connection pooling"""
        framework._test_connection_pooling()


@pytest.mark.error_handling
class TestErrorHandling(TestIntegrationFramework):
    """Error handling tests"""
    
    def test_error_response_format(self, framework):
        """Test error response format"""
        framework._test_error_response_format()
    
    def test_retry_mechanism(self, framework):
        """Test retry mechanism"""
        framework._test_retry_mechanism()
    
    def test_circuit_breaker(self, framework):
        """Test circuit breaker functionality"""
        framework._test_circuit_breaker()
    
    def test_dead_letter_queue(self, framework):
        """Test dead letter queue processing"""
        framework._test_dead_letter_queue()
    
    def test_error_notifications(self, framework):
        """Test error notification system"""
        framework._test_error_notifications()


@pytest.mark.failure_scenarios
@pytest.mark.chaos
class TestFailureScenarios(TestIntegrationFramework):
    """Failure scenario tests"""
    
    def test_bedrock_throttling_scenario(self, framework):
        """Test Bedrock throttling scenario"""
        if framework.config.enable_chaos_testing:
            framework._test_bedrock_throttling_scenario()
        else:
            pytest.skip("Chaos testing disabled")
    
    def test_dynamodb_throttling_scenario(self, framework):
        """Test DynamoDB throttling scenario"""
        if framework.config.enable_chaos_testing:
            framework._test_dynamodb_throttling_scenario()
        else:
            pytest.skip("Chaos testing disabled")
    
    def test_transcribe_failure_scenario(self, framework):
        """Test Transcribe failure scenario"""
        if framework.config.enable_chaos_testing:
            framework._test_transcribe_failure_scenario()
        else:
            pytest.skip("Chaos testing disabled")
    
    def test_network_timeout_scenario(self, framework):
        """Test network timeout scenario"""
        if framework.config.enable_chaos_testing:
            framework._test_network_timeout_scenario()
        else:
            pytest.skip("Chaos testing disabled")
    
    def test_quota_exceeded_scenario(self, framework):
        """Test quota exceeded scenario"""
        if framework.config.enable_chaos_testing:
            framework._test_quota_exceeded_scenario()
        else:
            pytest.skip("Chaos testing disabled")


@pytest.mark.e2e
class TestEndToEnd(TestIntegrationFramework):
    """End-to-end tests"""
    
    def test_complete_voice_query_flow(self, framework):
        """Test complete voice query flow"""
        framework._test_complete_voice_query_flow()
    
    def test_manual_upload_and_query(self, framework):
        """Test manual upload and query flow"""
        framework._test_manual_upload_and_query()
    
    def test_quota_enforcement_flow(self, framework):
        """Test quota enforcement flow"""
        framework._test_quota_enforcement_flow()
    
    def test_error_recovery_flow(self, framework):
        """Test error recovery flow"""
        framework._test_error_recovery_flow()


@pytest.mark.smoke
class TestSmoke(TestIntegrationFramework):
    """Smoke tests - basic functionality verification"""
    
    def test_api_health(self, framework):
        """Test API health endpoint"""
        framework._test_health_endpoint()
    
    def test_api_version(self, framework):
        """Test API version endpoint"""
        framework._test_version_endpoint()
    
    def test_authentication_basic(self, framework):
        """Test basic authentication"""
        framework._test_user_authentication()
    
    def test_query_basic(self, framework):
        """Test basic query functionality"""
        framework._test_query_endpoint()


@pytest.mark.load
class TestLoad(TestIntegrationFramework):
    """Load tests"""
    
    @pytest.mark.slow
    def test_sustained_load(self, framework):
        """Test sustained load handling"""
        if framework.config.enable_load_testing:
            # This would implement sustained load testing
            # For now, just test concurrent requests
            framework._test_concurrent_requests()
        else:
            pytest.skip("Load testing disabled")
    
    @pytest.mark.slow
    def test_peak_load(self, framework):
        """Test peak load handling"""
        if framework.config.enable_load_testing:
            # This would implement peak load testing
            # For now, just test concurrent requests
            framework._test_concurrent_requests()
        else:
            pytest.skip("Load testing disabled")


class TestFrameworkIntegration:
    """Test the integration framework itself"""
    
    def test_framework_initialization(self):
        """Test framework initialization"""
        config = TestConfig()
        framework = IntegrationTestFramework(config)
        assert framework.config is not None
        assert framework.authenticator is not None
        assert framework.failure_simulator is not None
    
    def test_framework_setup_teardown(self):
        """Test framework setup and teardown"""
        config = TestConfig()
        framework = IntegrationTestFramework(config)
        
        # Test setup
        framework.setup()
        assert framework.test_data is not None
        assert 'test_user_id' in framework.test_data
        
        # Test teardown
        framework.teardown()
    
    def test_mock_aws_services(self):
        """Test mock AWS services"""
        with MockAWSServices() as aws:
            assert aws.dynamodb is not None
            assert aws.s3 is not None
            assert aws.sqs is not None
            assert aws.sns is not None
            
            # Test table creation
            assert aws.usage_table is not None
            assert aws.error_table is not None
            assert aws.rate_limit_table is not None
    
    def test_failure_simulator(self):
        """Test failure simulator"""
        config = TestConfig()
        framework = IntegrationTestFramework(config)
        simulator = framework.failure_simulator
        
        # Test failure activation
        simulator.activate_failure('bedrock_throttling', 10)
        assert simulator.is_failure_active('bedrock_throttling')
        
        # Test failure deactivation
        simulator.deactivate_failure('bedrock_throttling')
        assert not simulator.is_failure_active('bedrock_throttling')
    
    def test_test_result_format(self):
        """Test test result format"""
        config = TestConfig()
        framework = IntegrationTestFramework(config)
        
        # Run a simple test
        framework.setup()
        try:
            results = framework.run_all_tests()
            
            # Verify result structure
            assert 'summary' in results
            assert 'test_results' in results
            assert 'failed_tests' in results
            assert 'performance_metrics' in results
            
            summary = results['summary']
            assert 'total_tests' in summary
            assert 'passed' in summary
            assert 'failed' in summary
            assert 'success_rate' in summary
            
        finally:
            framework.teardown()


# Custom pytest markers
def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line("markers", "auth: Authentication tests")
    config.addinivalue_line("markers", "api: API functionality tests")
    config.addinivalue_line("markers", "security: Security tests")
    config.addinivalue_line("markers", "performance: Performance tests")
    config.addinivalue_line("markers", "error_handling: Error handling tests")
    config.addinivalue_line("markers", "failure_scenarios: Failure scenario tests")
    config.addinivalue_line("markers", "e2e: End-to-end tests")
    config.addinivalue_line("markers", "slow: Slow running tests")
    config.addinivalue_line("markers", "load: Load tests")
    config.addinivalue_line("markers", "chaos: Chaos engineering tests")
    config.addinivalue_line("markers", "smoke: Smoke tests")


# Test collection customization
def pytest_collection_modifyitems(config, items):
    """Modify test collection"""
    
    # Add slow marker to tests that take a long time
    slow_tests = [
        'test_sustained_load',
        'test_peak_load',
        'test_complete_voice_query_flow',
        'test_manual_upload_and_query'
    ]
    
    for item in items:
        if any(slow_test in item.name for slow_test in slow_tests):
            item.add_marker(pytest.mark.slow)
        
        # Add integration marker to all tests
        item.add_marker(pytest.mark.integration)


# Test reporting
def pytest_html_report_title(report):
    """Customize HTML report title"""
    report.title = "Manuel Backend Integration Test Report"


def pytest_html_results_summary(prefix, summary, postfix):
    """Customize HTML report summary"""
    prefix.extend([
        "<p>Manuel Backend Integration Tests</p>",
        "<p>Test Environment: Integration</p>"
    ])