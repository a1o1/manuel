# Manuel Backend Testing Makefile

.PHONY: help install test-unit test-integration test-security test-performance test-all clean coverage

# Default target
help:
	@echo "Manuel Backend Testing Commands"
	@echo "==============================="
	@echo ""
	@echo "Setup:"
	@echo "  install              Install all test dependencies"
	@echo "  install-unit         Install unit test dependencies only"
	@echo "  install-integration  Install integration test dependencies only"
	@echo ""
	@echo "Testing:"
	@echo "  test-unit           Run unit tests"
	@echo "  test-integration    Run integration tests"
	@echo "  test-security       Run security tests"
	@echo "  test-performance    Run performance tests"
	@echo "  test-all            Run all tests"
	@echo "  test-fast           Run fast tests only (skip slow integration tests)"
	@echo ""
	@echo "Specific Tests:"
	@echo "  test-query          Run query function tests"
	@echo "  test-usage          Run usage function tests"
	@echo "  test-backup         Run backup function tests"
	@echo ""
	@echo "Reporting:"
	@echo "  coverage            Generate coverage report"
	@echo "  coverage-html       Generate HTML coverage report"
	@echo "  test-report         Generate comprehensive test report"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean               Clean test artifacts"
	@echo ""

# Installation targets
install: install-unit install-integration
	@echo "✅ All test dependencies installed"

install-unit:
	@echo "📦 Installing unit test dependencies..."
	pip install -r unit/requirements.txt

install-integration:
	@echo "📦 Installing integration test dependencies..."
	pip install -r integration/fixtures/requirements.txt

# Unit testing targets
test-unit:
	@echo "🧪 Running unit tests..."
	python -m pytest unit/ -v --tb=short

test-unit-coverage:
	@echo "🧪 Running unit tests with coverage..."
	python -m pytest unit/ -v --cov=../src/functions --cov-report=term-missing --cov-report=html:unit/htmlcov

test-query:
	@echo "🧪 Running query function tests..."
	python -m pytest unit/test_query_function.py -v

test-usage:
	@echo "🧪 Running usage function tests..."
	python -m pytest unit/test_usage_function.py -v

test-backup:
	@echo "🧪 Running backup function tests..."
	python -m pytest unit/test_backup_function.py -v

# Integration testing targets
test-integration:
	@echo "🔗 Running integration tests..."
	python integration/test_framework.py integration/test_config.json

test-integration-pytest:
	@echo "🔗 Running integration tests with pytest..."
	python -m pytest integration/pytest_tests.py -v

# Security testing targets
test-security:
	@echo "🔒 Running security tests..."
	python -m pytest integration/pytest_tests.py -m "security" -v

# Performance testing targets
test-performance:
	@echo "⚡ Running performance tests..."
	python -m pytest integration/pytest_tests.py -m "performance" -v

# Comprehensive testing targets
test-all: test-unit test-integration test-security
	@echo "✅ All tests completed"

test-fast:
	@echo "⚡ Running fast tests only..."
	python -m pytest unit/ integration/ -m "not slow" -v

test-smoke:
	@echo "💨 Running smoke tests..."
	python -m pytest integration/pytest_tests.py -m "smoke" -v

# Specific test scenarios
test-auth:
	@echo "🔐 Running authentication tests..."
	python -m pytest unit/ integration/ -m "auth" -v

test-api:
	@echo "🌐 Running API functionality tests..."
	python -m pytest unit/ integration/ -m "api" -v

test-e2e:
	@echo "🔄 Running end-to-end tests..."
	python -m pytest integration/pytest_tests.py -m "e2e" -v

# Coverage and reporting targets
coverage:
	@echo "📊 Generating coverage report..."
	python -m pytest unit/ --cov=../src/functions --cov-report=term-missing

coverage-html:
	@echo "📊 Generating HTML coverage report..."
	python -m pytest unit/ --cov=../src/functions --cov-report=html:unit/htmlcov
	@echo "📁 Coverage report available at: unit/htmlcov/index.html"

test-report:
	@echo "📋 Generating comprehensive test report..."
	python -m pytest unit/ integration/ --html=reports/test_report.html --self-contained-html
	@echo "📁 Test report available at: reports/test_report.html"

# Quality and validation targets
validate-tests:
	@echo "✅ Validating test quality..."
	python -m pytest unit/ --collect-only -q
	python -m pytest integration/ --collect-only -q

lint-tests:
	@echo "🔍 Linting test code..."
	python -m flake8 unit/ integration/ --max-line-length=88

type-check-tests:
	@echo "🔧 Type checking test code..."
	python -m mypy unit/ integration/ --ignore-missing-imports

# Load testing targets (requires integration environment)
test-load:
	@echo "🚀 Running load tests..."
	python -m pytest integration/pytest_tests.py -m "load" -v

test-chaos:
	@echo "🌪️ Running chaos engineering tests..."
	python -m pytest integration/pytest_tests.py -m "chaos" -v

# Continuous Integration targets
ci-test: test-unit test-integration-pytest
	@echo "🔄 CI test suite completed"

ci-test-fast: test-unit test-smoke
	@echo "⚡ CI fast test suite completed"

# Development targets
dev-test:
	@echo "🔧 Running development test suite..."
	python -m pytest unit/ -v --tb=short -x

watch-tests:
	@echo "👀 Watching for test changes..."
	python -m pytest unit/ --looponfail

# Environment setup targets
setup-test-env:
	@echo "🔧 Setting up test environment..."
	@echo "Creating test directories..."
	mkdir -p unit/reports unit/htmlcov integration/reports
	@echo "✅ Test environment setup complete"

# Database and AWS setup for integration tests
setup-aws-test:
	@echo "☁️ Setting up AWS test environment..."
	aws sts get-caller-identity
	@echo "✅ AWS test environment ready"

# Cleanup targets
clean:
	@echo "🧹 Cleaning test artifacts..."
	rm -rf unit/htmlcov/ unit/reports/ integration/reports/
	rm -rf unit/__pycache__/ integration/__pycache__/
	rm -rf unit/.pytest_cache/ integration/.pytest_cache/
	find . -name "*.pyc" -delete
	find . -name ".coverage" -delete
	@echo "✅ Test artifacts cleaned"

clean-all: clean
	@echo "🧹 Deep cleaning..."
	rm -rf unit/.coverage integration/.coverage
	rm -rf .pytest_cache/
	@echo "✅ Deep clean completed"

# Documentation targets
docs-tests:
	@echo "📚 Generating test documentation..."
	@echo "Test documentation available in README.md"

# Utility targets
list-tests:
	@echo "📋 Available tests:"
	python -m pytest unit/ integration/ --collect-only -q

count-tests:
	@echo "📊 Test statistics:"
	@echo -n "Unit tests: "
	python -m pytest unit/ --collect-only -q | grep "test session" | awk '{print $$1}'
	@echo -n "Integration tests: "
	python -m pytest integration/ --collect-only -q | grep "test session" | awk '{print $$1}'

# Debug targets
debug-unit:
	@echo "🐛 Running unit tests in debug mode..."
	python -m pytest unit/ -v -s --log-cli-level=DEBUG

debug-integration:
	@echo "🐛 Running integration tests in debug mode..."
	python -m pytest integration/ -v -s --log-cli-level=DEBUG

# Benchmark targets
benchmark:
	@echo "📈 Running performance benchmarks..."
	python -m pytest unit/ integration/ --benchmark-only

# Security scan targets
security-scan:
	@echo "🔒 Running security scans..."
	safety check -r unit/requirements.txt
	safety check -r integration/fixtures/requirements.txt
	bandit -r ../src/

# Help for specific test patterns
help-patterns:
	@echo "Test Pattern Examples:"
	@echo "====================="
	@echo ""
	@echo "Run tests by pattern:"
	@echo "  make test-unit PATTERN=test_query"
	@echo "  make test-unit PATTERN=TestAuth"
	@echo ""
	@echo "Run tests by marker:"
	@echo "  pytest -m 'auth and not slow'"
	@echo "  pytest -m 'security or performance'"
	@echo ""
	@echo "Run specific test method:"
	@echo "  pytest unit/test_query_function.py::TestQueryLambdaHandler::test_success"
	@echo ""

# Pattern-based testing (if PATTERN is provided)
ifdef PATTERN
test-unit:
	@echo "🧪 Running unit tests matching pattern: $(PATTERN)"
	python -m pytest unit/ -k "$(PATTERN)" -v
endif
