# Manuel Backend Testing Framework

## 🧪 Comprehensive Testing Suite

This directory contains a complete testing framework for the Manuel backend,
covering unit tests, integration tests, security testing, performance testing,
and end-to-end scenarios.

## 📁 Test Structure

```
tests/
├── unit/                     # Unit tests for individual Lambda functions
│   ├── conftest.py          # Pytest configuration and fixtures
│   ├── test_query_function.py      # Query function tests
│   ├── test_usage_function.py      # Usage function tests
│   ├── test_backup_function.py     # Backup function tests
│   └── requirements.txt     # Unit test dependencies
├── integration/             # Integration and E2E tests
│   ├── test_framework.py    # Comprehensive integration framework
│   ├── pytest_tests.py     # Pytest wrapper for integration tests
│   ├── test_config.json    # Test configuration
│   └── fixtures/            # Test data and configurations
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- AWS CLI configured
- Docker (for local testing)

### Install Dependencies

```bash
# Install unit test dependencies
pip install -r tests/unit/requirements.txt

# Install integration test dependencies
pip install -r tests/integration/fixtures/requirements.txt
```

### Run Unit Tests

```bash
# Run all unit tests
pytest tests/unit/ -v

# Run specific function tests
pytest tests/unit/test_query_function.py -v

# Run with coverage
pytest tests/unit/ --cov=src/functions --cov-report=html

# Run fast tests only (skip slow integration tests)
pytest tests/unit/ -m "not slow"
```

### Run Integration Tests

```bash
# Run all integration tests
python tests/integration/test_framework.py

# Run with pytest interface
pytest tests/integration/pytest_tests.py -v

# Run specific test categories
pytest tests/integration/ -m "auth" -v          # Authentication tests
pytest tests/integration/ -m "security" -v     # Security tests
pytest tests/integration/ -m "performance" -v  # Performance tests
```

## 🔧 Test Categories

### Unit Tests

**Location**: `tests/unit/` **Purpose**: Test individual Lambda functions in
isolation **Features**:

- AWS service mocking with moto
- Comprehensive error scenario testing
- Input validation testing
- Performance metrics validation
- Concurrent access testing

**Coverage**:

- ✅ Query function (175+ test cases)
- ✅ Usage function (120+ test cases)
- ✅ Backup function (100+ test cases)
- 🔄 Transcribe function (planned)
- 🔄 Manual processing function (planned)
- 🔄 Health/Version functions (planned)

### Integration Tests

**Location**: `tests/integration/` **Purpose**: Test complete workflows and AWS
service interactions **Features**:

- Real AWS service integration (with test environments)
- End-to-end workflow testing
- Failure scenario simulation
- Load testing capabilities
- Security vulnerability testing

**Test Categories**:

- **Authentication**: Token management, refresh, validation
- **API Functionality**: All Lambda endpoints
- **Security**: SQL injection, XSS, rate limiting, CORS
- **Performance**: Response times, concurrency, caching
- **Error Handling**: Retry logic, circuit breakers, DLQ
- **Failure Scenarios**: Service throttling, network timeouts
- **End-to-End**: Complete voice query flows

### Security Tests

**Purpose**: Validate security controls and identify vulnerabilities
**Features**:

- Input sanitization testing
- Authentication/authorization testing
- Rate limiting validation
- CORS policy testing
- Security header validation
- Injection attack prevention

### Performance Tests

**Purpose**: Ensure system meets performance requirements **Features**:

- Response time measurement
- Concurrent request handling
- Load testing with configurable parameters
- Memory and resource usage validation
- Cache performance testing

## ⚙️ Configuration

### Unit Test Configuration

Edit `tests/unit/pytest.ini` to customize:

- Test discovery patterns
- Coverage reporting
- Output formats
- Marker definitions

### Integration Test Configuration

Edit `tests/integration/test_config.json` to customize:

- API endpoints and environments
- Test user credentials
- Performance thresholds
- Security test patterns
- Failure simulation settings

### Environment-Specific Configs

```json
{
  "test_environments": {
    "dev": {
      "api_base_url": "http://localhost:3000",
      "enable_chaos_testing": false
    },
    "staging": {
      "api_base_url": "https://staging-api.manuel.com",
      "enable_chaos_testing": true
    },
    "prod": {
      "api_base_url": "https://api.manuel.com",
      "enable_chaos_testing": false
    }
  }
}
```

## 📊 Test Execution & Reporting

### Running Tests in CI/CD

```bash
# Complete test suite for CI/CD
make test-all

# Unit tests only (fast)
make test-unit

# Integration tests only
make test-integration

# Security tests only
make test-security
```

### Test Reports

Tests generate multiple report formats:

- **HTML Coverage Report**: `tests/unit/htmlcov/index.html`
- **HTML Test Report**: `tests/unit/reports/test_report.html`
- **JSON Test Results**: `tests/integration/test_results.json`
- **Performance Metrics**: Included in test output

### Sample Test Output

```
=== Manuel Backend Test Results ===
Unit Tests:        485 passed, 0 failed (100% success)
Integration Tests: 127 passed, 2 skipped (98.4% success)
Security Tests:    45 passed, 0 failed (100% success)
Performance Tests: 23 passed, 0 failed (100% success)

Coverage: 94.2% (target: 90%+)
Average Response Time: 247ms (target: <500ms)
```

## 🎯 Test Markers

Use pytest markers to run specific test categories:

```bash
# Run by test type
pytest -m "unit"           # Unit tests only
pytest -m "integration"    # Integration tests only
pytest -m "e2e"           # End-to-end tests only

# Run by functionality
pytest -m "auth"          # Authentication tests
pytest -m "api"           # API functionality tests
pytest -m "security"      # Security tests
pytest -m "performance"   # Performance tests

# Run by speed
pytest -m "not slow"      # Skip slow tests
pytest -m "slow"          # Run only slow tests

# Combine markers
pytest -m "auth and not slow"  # Fast auth tests only
```

## 🔧 Writing New Tests

### Unit Test Template

```python
# tests/unit/test_new_function.py
import pytest
from unittest.mock import Mock, patch

class TestNewFunction:
    """Test the new Lambda function"""

    def test_function_success(self, mock_context, mock_env_vars):
        """Test successful function execution"""
        # Arrange
        event = {"test": "data"}

        # Act
        result = lambda_handler(event, mock_context)

        # Assert
        assert result["statusCode"] == 200

    def test_function_error(self, mock_context, mock_env_vars):
        """Test function error handling"""
        # Test error scenarios
        pass
```

### Integration Test Template

```python
# tests/integration/test_new_workflow.py
def test_new_workflow(self, framework):
    """Test new end-to-end workflow"""
    # Setup test data
    # Execute workflow steps
    # Validate results
    pass
```

## 🚨 Troubleshooting

### Common Issues

**AWS Credentials**: Ensure AWS credentials are configured

```bash
aws configure list
```

**Missing Dependencies**: Install all required packages

```bash
pip install -r tests/unit/requirements.txt
pip install -r tests/integration/fixtures/requirements.txt
```

**Test Environment**: Verify environment variables

```bash
# Check required environment variables
echo $USAGE_TABLE_NAME
echo $MANUALS_BUCKET
```

**Test Failures**: Check test configuration

- Verify API endpoints in test_config.json
- Ensure test user credentials are valid
- Check AWS service availability

### Debug Mode

```bash
# Run tests with debug output
pytest tests/unit/ -v -s --log-cli-level=DEBUG

# Run single test with detailed output
pytest tests/unit/test_query_function.py::TestQueryLambdaHandler::test_lambda_handler_success -v -s
```

## 📈 Metrics & Monitoring

### Test Metrics Tracked

- **Code Coverage**: Target 90%+ line coverage
- **Test Execution Time**: Monitor for performance regression
- **Test Success Rate**: Target 95%+ success rate
- **Security Test Coverage**: All OWASP top 10 vulnerabilities
- **Performance Benchmarks**: Response time, throughput, error rates

### Continuous Monitoring

- Daily automated test runs
- Performance regression detection
- Security vulnerability scanning
- Dependency security updates

## 🤝 Contributing

### Adding New Tests

1. Follow existing patterns and conventions
2. Include both positive and negative test cases
3. Add appropriate test markers
4. Update documentation
5. Ensure tests pass in CI/CD pipeline

### Test Review Checklist

- [ ] Tests cover both success and error scenarios
- [ ] Appropriate mocking and isolation
- [ ] Clear test names and documentation
- [ ] Performance considerations
- [ ] Security implications covered
- [ ] CI/CD pipeline compatibility

## 📚 Additional Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Moto AWS Mocking](https://github.com/spulec/moto)
- [AWS Lambda Testing Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/testing-guidelines.html)
- [Python Testing Best Practices](https://realpython.com/python-testing/)

---

For questions or issues, please refer to the main project documentation or open
an issue in the repository.
