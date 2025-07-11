# Manuel Backend Integration Tests Makefile

# Variables
PYTHON := python3
PIP := pip3
PYTEST := pytest
TEST_DIR := tests/integration
CONFIG_FILE := test_config.json
RESULTS_DIR := results
VENV_DIR := .venv

# Default target
.PHONY: help
help:
	@echo "Manuel Backend Integration Tests"
	@echo "================================"
	@echo ""
	@echo "Available targets:"
	@echo "  install          Install test dependencies"
	@echo "  setup            Setup test environment"
	@echo "  test             Run all integration tests"
	@echo "  test-smoke       Run smoke tests only"
	@echo "  test-auth        Run authentication tests"
	@echo "  test-api         Run API functionality tests"
	@echo "  test-security    Run security tests"
	@echo "  test-performance Run performance tests"
	@echo "  test-e2e         Run end-to-end tests"
	@echo "  test-chaos       Run chaos engineering tests"
	@echo "  test-load        Run load tests"
	@echo "  test-custom      Run custom framework tests"
	@echo "  test-pytest      Run pytest-based tests"
	@echo "  test-dev         Run tests for development environment"
	@echo "  test-staging     Run tests for staging environment"
	@echo "  test-prod        Run tests for production environment"
	@echo "  report           Generate HTML test report"
	@echo "  coverage         Run tests with coverage"
	@echo "  clean            Clean test artifacts"
	@echo "  lint             Run linting on test code"
	@echo "  format           Format test code"
	@echo "  requirements     Update requirements.txt"
	@echo ""

# Setup and installation
.PHONY: install
install:
	$(PIP) install -r fixtures/requirements.txt

.PHONY: setup
setup:
	mkdir -p $(RESULTS_DIR)
	mkdir -p fixtures
	@echo "Test environment setup complete"

.PHONY: venv
venv:
	$(PYTHON) -m venv $(VENV_DIR)
	$(VENV_DIR)/bin/pip install --upgrade pip
	$(VENV_DIR)/bin/pip install -r fixtures/requirements.txt

# Test execution
.PHONY: test
test: setup
	$(PYTHON) test_runner.py --config $(CONFIG_FILE) --output $(RESULTS_DIR)/results.json --verbose

.PHONY: test-smoke
test-smoke: setup
	$(PYTEST) -m smoke -v --tb=short

.PHONY: test-auth
test-auth: setup
	$(PYTEST) -m auth -v --tb=short

.PHONY: test-api
test-api: setup
	$(PYTEST) -m api -v --tb=short

.PHONY: test-security
test-security: setup
	$(PYTEST) -m security -v --tb=short

.PHONY: test-performance
test-performance: setup
	$(PYTEST) -m performance -v --tb=short

.PHONY: test-e2e
test-e2e: setup
	$(PYTEST) -m e2e -v --tb=short

.PHONY: test-chaos
test-chaos: setup
	$(PYTHON) test_runner.py --config $(CONFIG_FILE) --chaos --output $(RESULTS_DIR)/chaos_results.json

.PHONY: test-load
test-load: setup
	$(PYTEST) -m load -v --tb=short

.PHONY: test-custom
test-custom: setup
	$(PYTHON) test_runner.py --framework --config $(CONFIG_FILE) --output $(RESULTS_DIR)/custom_results.json

.PHONY: test-pytest
test-pytest: setup
	$(PYTEST) pytest_tests.py -v --tb=short

# Environment-specific tests
.PHONY: test-dev
test-dev: setup
	$(PYTHON) test_runner.py --environment dev --config $(CONFIG_FILE) --output $(RESULTS_DIR)/dev_results.json

.PHONY: test-staging
test-staging: setup
	$(PYTHON) test_runner.py --environment staging --config $(CONFIG_FILE) --chaos --load --security --output $(RESULTS_DIR)/staging_results.json

.PHONY: test-prod
test-prod: setup
	$(PYTHON) test_runner.py --environment prod --config $(CONFIG_FILE) --security --output $(RESULTS_DIR)/prod_results.json

# Reporting and coverage
.PHONY: report
report: setup
	$(PYTEST) pytest_tests.py --html=$(RESULTS_DIR)/report.html --self-contained-html -v

.PHONY: coverage
coverage: setup
	$(PYTEST) pytest_tests.py --cov=test_framework --cov-report=html:$(RESULTS_DIR)/coverage --cov-report=term -v

.PHONY: json-report
json-report: setup
	$(PYTEST) pytest_tests.py --json-report --json-report-file=$(RESULTS_DIR)/pytest_results.json -v

# Code quality
.PHONY: lint
lint:
	flake8 test_framework.py test_runner.py pytest_tests.py
	pylint test_framework.py test_runner.py pytest_tests.py

.PHONY: format
format:
	black test_framework.py test_runner.py pytest_tests.py
	isort test_framework.py test_runner.py pytest_tests.py

.PHONY: type-check
type-check:
	mypy test_framework.py test_runner.py pytest_tests.py

# Maintenance
.PHONY: clean
clean:
	rm -rf $(RESULTS_DIR)
	rm -rf __pycache__
	rm -rf .pytest_cache
	rm -rf .coverage
	rm -rf htmlcov
	rm -rf *.egg-info
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete

.PHONY: requirements
requirements:
	$(PIP) freeze > fixtures/requirements.txt

# Parallel test execution
.PHONY: test-parallel
test-parallel: setup
	$(PYTEST) pytest_tests.py -n auto -v --tb=short

# Continuous integration
.PHONY: ci
ci: setup lint test-smoke test-auth test-api coverage
	@echo "CI pipeline completed successfully"

# Development workflow
.PHONY: dev
dev: setup test-dev test-smoke
	@echo "Development tests completed"

# Staging workflow
.PHONY: staging
staging: setup test-staging
	@echo "Staging tests completed"

# Production workflow
.PHONY: prod
prod: setup test-prod
	@echo "Production tests completed"

# Debug targets
.PHONY: debug
debug: setup
	$(PYTHON) test_runner.py --config $(CONFIG_FILE) --verbose --output $(RESULTS_DIR)/debug_results.json

.PHONY: debug-pytest
debug-pytest: setup
	$(PYTEST) pytest_tests.py -v --tb=long --capture=no

# Performance profiling
.PHONY: profile
profile: setup
	$(PYTHON) -m cProfile -o $(RESULTS_DIR)/profile.stats test_runner.py --config $(CONFIG_FILE)

# Test specific functions
.PHONY: test-function
test-function: setup
	$(PYTEST) -k "$(FUNCTION)" -v --tb=short

# Custom test execution
.PHONY: test-custom-url
test-custom-url: setup
	$(PYTHON) test_runner.py --api-url "$(API_URL)" --output $(RESULTS_DIR)/custom_url_results.json

.PHONY: test-timeout
test-timeout: setup
	$(PYTHON) test_runner.py --timeout $(TIMEOUT) --config $(CONFIG_FILE) --output $(RESULTS_DIR)/timeout_results.json

# Docker support
.PHONY: docker-build
docker-build:
	docker build -t manuel-integration-tests .

.PHONY: docker-run
docker-run:
	docker run --rm -v $(PWD)/$(RESULTS_DIR):/app/results manuel-integration-tests

# All tests
.PHONY: test-all
test-all: test-smoke test-auth test-api test-security test-performance test-e2e test-chaos test-load
	@echo "All integration tests completed"

# Quick test
.PHONY: quick
quick: test-smoke test-auth test-api
	@echo "Quick integration tests completed"