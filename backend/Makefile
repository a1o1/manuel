# Manuel Backend - Development Makefile
# Convenient commands for development workflow

.PHONY: help install clean lint format test security build deploy docs

# Default target
.DEFAULT_GOAL := help

# Variables
PYTHON := python3
PIP := pip3
VENV := .venv
VENV_BIN := $(VENV)/bin
PYTHON_VENV := $(VENV_BIN)/python
PIP_VENV := $(VENV_BIN)/pip

# Colors for output
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
MAGENTA := \033[35m
CYAN := \033[36m
WHITE := \033[37m
RESET := \033[0m

help: ## Show this help message
	@echo "$(CYAN)Manuel Backend - Development Commands$(RESET)"
	@echo ""
	@echo "$(YELLOW)Setup:$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "(install|clean|setup)"
	@echo ""
	@echo "$(YELLOW)Development:$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "(lint|format|test|check)"
	@echo ""
	@echo "$(YELLOW)Build & Deploy:$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "(build|deploy|package)"
	@echo ""
	@echo "$(YELLOW)Security & Quality:$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "(security|safety|bandit)"

# Setup and Installation
$(VENV):
	@echo "$(CYAN)Creating virtual environment...$(RESET)"
	$(PYTHON) -m venv $(VENV)
	@echo "$(GREEN)✓ Virtual environment created$(RESET)"

install: $(VENV) ## Install development dependencies
	@echo "$(CYAN)Installing Manuel Backend dependencies...$(RESET)"
	$(PIP_VENV) install --upgrade pip
	$(PIP_VENV) install -e ".[dev]"
	@echo "$(GREEN)✓ Dependencies installed$(RESET)"

install-pre-commit: install ## Install and setup pre-commit hooks
	@echo "$(CYAN)Setting up pre-commit hooks...$(RESET)"
	$(VENV_BIN)/pre-commit install --install-hooks
	$(VENV_BIN)/pre-commit install --hook-type commit-msg
	@echo "$(GREEN)✓ Pre-commit hooks installed$(RESET)"

setup: install install-pre-commit ## Complete development setup
	@echo "$(GREEN)✓ Development environment ready!$(RESET)"

clean: ## Clean build artifacts and caches
	@echo "$(CYAN)Cleaning build artifacts...$(RESET)"
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	rm -rf build/ dist/ .coverage htmlcov/
	rm -rf .aws-sam/
	rm -f bandit-report.json safety-report.json
	@echo "$(GREEN)✓ Cleaned$(RESET)"

# Code Quality
lint: install ## Run all linting tools
	@echo "$(CYAN)Running linting tools...$(RESET)"
	@echo "$(YELLOW)→ Running flake8...$(RESET)"
	$(VENV_BIN)/flake8 src/
	@echo "$(YELLOW)→ Running pylint...$(RESET)"
	$(VENV_BIN)/pylint src/ --exit-zero
	@echo "$(YELLOW)→ Running mypy...$(RESET)"
	$(VENV_BIN)/mypy src/ --ignore-missing-imports
	@echo "$(GREEN)✓ Linting complete$(RESET)"

format: install ## Format code with black and isort
	@echo "$(CYAN)Formatting code...$(RESET)"
	@echo "$(YELLOW)→ Running isort...$(RESET)"
	$(VENV_BIN)/isort src/ tests/
	@echo "$(YELLOW)→ Running black...$(RESET)"
	$(VENV_BIN)/black src/ tests/
	@echo "$(GREEN)✓ Code formatted$(RESET)"

format-check: install ## Check code formatting without making changes
	@echo "$(CYAN)Checking code formatting...$(RESET)"
	$(VENV_BIN)/black --check --diff src/ tests/
	$(VENV_BIN)/isort --check-only --diff src/ tests/

type-check: install ## Run type checking with mypy
	@echo "$(CYAN)Running type checking...$(RESET)"
	$(VENV_BIN)/mypy src/ --ignore-missing-imports --show-error-codes
	@echo "$(GREEN)✓ Type checking complete$(RESET)"

docstring-check: install ## Check docstring coverage
	@echo "$(CYAN)Checking docstring coverage...$(RESET)"
	$(VENV_BIN)/interrogate src/ --ignore-init-method --ignore-init-module --ignore-magic --ignore-nested-functions --ignore-private --ignore-property-decorators --ignore-semiprivate --fail-under=70
	@echo "$(GREEN)✓ Docstring check complete$(RESET)"

check: format-check lint type-check docstring-check ## Run all code quality checks

# Security
security: bandit safety ## Run all security checks

bandit: install ## Run bandit security scanner
	@echo "$(CYAN)Running bandit security scan...$(RESET)"
	$(VENV_BIN)/bandit -r src/ -f json -o bandit-report.json
	$(VENV_BIN)/bandit -r src/ -f screen
	@echo "$(GREEN)✓ Security scan complete$(RESET)"

safety: install ## Check for known security vulnerabilities
	@echo "$(CYAN)Running safety vulnerability check...$(RESET)"
	$(VENV_BIN)/safety check --short-report
	@echo "$(GREEN)✓ Vulnerability check complete$(RESET)"

# Testing
test: install ## Run unit tests
	@echo "$(CYAN)Running unit tests...$(RESET)"
	$(VENV_BIN)/pytest tests/unit/ -v --tb=short
	@echo "$(GREEN)✓ Unit tests complete$(RESET)"

test-cov: install ## Run tests with coverage report
	@echo "$(CYAN)Running tests with coverage...$(RESET)"
	$(VENV_BIN)/pytest tests/unit/ --cov=src --cov-report=html --cov-report=term --cov-report=xml
	@echo "$(GREEN)✓ Coverage report generated$(RESET)"

test-integration: ## Run integration tests
	@echo "$(CYAN)Running integration tests...$(RESET)"
	cd tests/integration && make test-smoke
	@echo "$(GREEN)✓ Integration tests complete$(RESET)"

test-all: test test-integration ## Run all tests

# Build and Deploy
validate: ## Validate SAM template
	@echo "$(CYAN)Validating SAM template...$(RESET)"
	sam validate --template template.yaml
	@echo "$(GREEN)✓ Template validation complete$(RESET)"

build: validate ## Build SAM application
	@echo "$(CYAN)Building SAM application...$(RESET)"
	sam build --use-container
	@echo "$(GREEN)✓ Build complete$(RESET)"

package: build ## Package SAM application
	@echo "$(CYAN)Packaging SAM application...$(RESET)"
	sam package --s3-bucket manuel-deployment-artifacts --output-template-file packaged-template.yaml
	@echo "$(GREEN)✓ Package complete$(RESET)"

deploy-dev: build ## Deploy to development environment
	@echo "$(CYAN)Deploying to development...$(RESET)"
	sam deploy --parameter-overrides-file parameters.json
	@echo "$(GREEN)✓ Development deployment complete$(RESET)"

deploy-staging: build ## Deploy to staging environment
	@echo "$(CYAN)Deploying to staging...$(RESET)"
	sam deploy --parameter-overrides-file parameters-staging.json
	@echo "$(GREEN)✓ Staging deployment complete$(RESET)"

deploy-prod: build ## Deploy to production environment
	@echo "$(CYAN)Deploying to production...$(RESET)"
	sam deploy --parameter-overrides-file parameters-production.json
	@echo "$(GREEN)✓ Production deployment complete$(RESET)"

# Pre-commit and Git Hooks
pre-commit: install ## Run pre-commit hooks on all files
	@echo "$(CYAN)Running pre-commit hooks...$(RESET)"
	$(VENV_BIN)/pre-commit run --all-files
	@echo "$(GREEN)✓ Pre-commit hooks complete$(RESET)"

pre-commit-update: install ## Update pre-commit hook versions
	@echo "$(CYAN)Updating pre-commit hooks...$(RESET)"
	$(VENV_BIN)/pre-commit autoupdate
	@echo "$(GREEN)✓ Pre-commit hooks updated$(RESET)"

# Development Workflow
dev-check: format lint security test ## Complete development check (format, lint, security, test)
	@echo "$(GREEN)✓ All development checks passed!$(RESET)"

ci-check: format-check lint security test ## CI-friendly checks (no formatting changes)
	@echo "$(GREEN)✓ All CI checks passed!$(RESET)"

# Documentation
docs-serve: ## Serve documentation locally
	@echo "$(CYAN)Serving documentation...$(RESET)"
	@echo "Open http://localhost:8000 in your browser"
	python -m http.server 8000 --directory docs/

# Utility
info: $(VENV) ## Show development environment information
	@echo "$(CYAN)Development Environment Information$(RESET)"
	@echo "$(YELLOW)Python Version:$(RESET) $(shell $(PYTHON_VENV) --version 2>/dev/null || echo 'Virtual environment not found')"
	@echo "$(YELLOW)Pip Version:$(RESET) $(shell $(PIP_VENV) --version 2>/dev/null || echo 'Virtual environment not found')"
	@echo "$(YELLOW)Current Directory:$(RESET) $(shell pwd)"
	@echo "$(YELLOW)Git Branch:$(RESET) $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'Not a git repository')"
	@echo "$(YELLOW)Git Status:$(RESET) $(shell git status --porcelain 2>/dev/null | wc -l | sed 's/^ *//' || echo '0') modified files"

requirements: ## Generate requirements.txt from pyproject.toml
	@echo "$(CYAN)Generating requirements.txt...$(RESET)"
	pip-compile pyproject.toml --output-file requirements.txt
	@echo "$(GREEN)✓ Requirements updated$(RESET)"

# Quick commands for daily development
quick-check: format lint ## Quick development check (format + lint)
	@echo "$(GREEN)✓ Quick check complete!$(RESET)"

commit-ready: dev-check ## Ensure code is ready for commit
	@echo "$(GREEN)✓ Code is ready for commit!$(RESET)"
