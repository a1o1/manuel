# Manuel Backend - Code Quality Guide

## Overview

This guide covers the comprehensive code quality standards and tools used in the Manuel backend project. All code must pass these quality gates before being committed or deployed.

## Quick Start

```bash
# Complete setup
make setup

# Daily development check
make dev-check

# Pre-commit check
make commit-ready
```

## Code Quality Tools

### 🎨 Code Formatting

#### Black
- **Purpose**: Automatic Python code formatting
- **Configuration**: `.pyproject.toml` - line length 88, Python 3.11 target
- **Command**: `make format` or `black src/ tests/`
- **IDE Integration**: Install Black extension for auto-formatting

#### isort
- **Purpose**: Automatic import sorting
- **Configuration**: `.pyproject.toml` - Black-compatible profile
- **Command**: `make format` or `isort src/ tests/`
- **Features**: Groups imports by type, handles relative imports

### 🔍 Linting & Static Analysis

#### Ruff (Primary Linter)
- **Purpose**: Fast Python linter (modern flake8 replacement)
- **Configuration**: `.pyproject.toml` - comprehensive rule set
- **Command**: `ruff check src/ tests/`
- **Features**: 
  - 50+ rule categories enabled
  - Auto-fixes for many issues
  - Very fast execution
  - Modern Python patterns

#### flake8 (Traditional Linter)
- **Purpose**: Traditional Python linting with plugins
- **Configuration**: `.flake8`
- **Command**: `flake8 src/`
- **Plugins Enabled**:
  - `flake8-docstrings`: Docstring validation
  - `flake8-bugbear`: Bug and design problems
  - `flake8-comprehensions`: List/dict comprehension improvements
  - `flake8-pytest-style`: Pytest best practices
  - `flake8-simplify`: Code simplification suggestions

#### pylint (Advanced Analysis)
- **Purpose**: Advanced static analysis and code quality
- **Configuration**: `.pylintrc`
- **Command**: `pylint src/`
- **Features**:
  - Code smell detection
  - Design issue identification
  - Complexity analysis
  - AWS-specific configurations

### 🧭 Type Checking

#### mypy
- **Purpose**: Static type checking
- **Configuration**: `.pyproject.toml` - strict mode enabled
- **Command**: `mypy src/`
- **Features**:
  - Strict type checking
  - AWS boto3 type stubs
  - Gradual typing support
  - Error codes and context

### 🔒 Security Scanning

#### bandit
- **Purpose**: Security vulnerability scanner
- **Configuration**: `.pyproject.toml`
- **Command**: `bandit -r src/`
- **Features**:
  - OWASP security patterns
  - JSON report generation
  - Configurable severity levels

#### safety
- **Purpose**: Dependency vulnerability scanning
- **Command**: `safety check`
- **Features**:
  - Known vulnerability database
  - CVE tracking
  - JSON reporting

#### semgrep (Advanced Security)
- **Purpose**: Advanced security pattern detection
- **Command**: `semgrep --config=auto src/`
- **Features**:
  - Advanced pattern matching
  - Security rule sets
  - Custom rule support

### 📚 Documentation

#### interrogate
- **Purpose**: Docstring coverage analysis
- **Configuration**: `.pyproject.toml` - 70% minimum coverage
- **Command**: `interrogate src/`
- **Features**:
  - Google-style docstring support
  - Coverage reports
  - Configurable exclusions

#### pydocstyle
- **Purpose**: Docstring style validation
- **Configuration**: `.pyproject.toml` - Google convention
- **Command**: `pydocstyle src/`

## Development Workflow

### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/manuel.git
cd manuel/backend

# Install development environment
make setup

# Verify installation
make info
```

### 2. Daily Development

```bash
# Start development
git checkout -b feature/your-feature

# Make changes to code
# ...

# Format code
make format

# Quick quality check
make quick-check

# Full development check
make dev-check

# Commit changes (pre-commit hooks run automatically)
git add .
git commit -m "feat(api): add new endpoint"

# Push changes
git push -u origin feature/your-feature
```

### 3. Pre-commit Workflow

Pre-commit hooks run automatically and check:

1. **Code Formatting**: Black and isort
2. **Linting**: flake8, ruff, pylint
3. **Type Checking**: mypy
4. **Security**: bandit, safety
5. **Documentation**: docstring coverage
6. **General**: trailing whitespace, file size, merge conflicts
7. **AWS**: SAM template validation
8. **Commits**: Conventional commit format

```bash
# Run pre-commit manually
make pre-commit

# Skip hooks (emergency only)
git commit --no-verify

# Update hook versions
make pre-commit-update
```

## Configuration Files

### `.pyproject.toml`
Central configuration for most tools:
- Black formatting
- isort import sorting
- mypy type checking
- ruff linting
- bandit security
- pytest testing
- interrogate documentation

### `.flake8`
Traditional flake8 configuration:
- Line length and complexity
- Error code selection
- Plugin configuration
- Per-file ignores

### `.pylintrc`
Comprehensive pylint configuration:
- Message control
- Code analysis rules
- AWS-specific patterns
- Performance tuning

### `.pre-commit-config.yaml`
Pre-commit hook configuration:
- Tool versions and settings
- Hook execution order
- File patterns and exclusions

## Quality Gates

### Minimum Requirements

1. **Code Formatting** ✅
   - All code formatted with Black
   - Imports sorted with isort
   - No formatting warnings

2. **Linting** ✅
   - Zero flake8 errors
   - Zero critical ruff issues
   - Pylint score > 8.0 (warning only)

3. **Type Checking** ✅
   - Zero mypy errors
   - All functions type-annotated
   - Return types specified

4. **Security** ✅
   - Zero high/critical bandit issues
   - Zero known vulnerabilities in dependencies
   - Security patterns validated

5. **Documentation** ✅
   - Minimum 70% docstring coverage
   - Google-style docstrings
   - Public APIs documented

6. **Testing** ✅
   - All tests passing
   - Minimum 80% code coverage
   - No test failures

### CI/CD Integration

GitHub Actions automatically runs all quality checks:

- **On Push**: Full quality suite
- **On PR**: Quality checks + conventional commits
- **Quality Gates**: Must pass to merge

## IDE Integration

### VS Code

Install recommended extensions:
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.black-formatter",
    "ms-python.isort",
    "ms-python.flake8",
    "ms-python.pylint",
    "ms-python.mypy-type-checker",
    "ms-python.bandit",
    "charliermarsh.ruff",
    "ms-vscode.vscode-json"
  ]
}
```

Settings (`.vscode/settings.json`):
```json
{
  "python.defaultInterpreterPath": ".venv/bin/python",
  "python.formatting.provider": "black",
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "python.linting.pylintEnabled": true,
  "python.linting.mypyEnabled": true,
  "python.linting.banditEnabled": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

### PyCharm

1. Configure Black formatter
2. Enable flake8, pylint, mypy
3. Set up pre-commit plugin
4. Configure type checking

## Troubleshooting

### Common Issues

#### 1. Formatting Conflicts
```bash
# Fix formatting issues
make format

# Check what changed
git diff

# If conflicts persist, check .editorconfig
```

#### 2. Linting Errors
```bash
# View detailed errors
flake8 src/ --show-source
ruff check src/ --show-source

# Fix auto-fixable issues
ruff check src/ --fix
```

#### 3. Type Checking Issues
```bash
# Detailed mypy output
mypy src/ --show-error-codes --show-traceback

# Common fixes:
# - Add type annotations
# - Import types from typing
# - Add # type: ignore[error-code] comments
```

#### 4. Security Issues
```bash
# Detailed security scan
bandit -r src/ -f screen -v

# View vulnerability details
safety check --full-report

# Common fixes:
# - Update vulnerable dependencies
# - Add security exceptions with justification
# - Refactor insecure patterns
```

#### 5. Documentation Issues
```bash
# Check specific coverage
interrogate src/ --verbose

# Generate coverage report
interrogate src/ --generate-badge

# Add missing docstrings using Google style
```

#### 6. Pre-commit Hook Failures
```bash
# See what failed
pre-commit run --all-files --verbose

# Fix issues manually
make format
make lint

# Update hooks if needed
pre-commit autoupdate
```

### Performance Tips

1. **Use Ruff instead of flake8** for faster linting
2. **Run mypy incrementally** with `--cache-dir`
3. **Parallelize tools** where possible
4. **Use pre-commit hooks** to catch issues early
5. **Configure IDE integration** for real-time feedback

## Best Practices

### Code Style

1. **Use Type Hints**
   ```python
   def process_data(data: Dict[str, Any]) -> List[str]:
       """Process data and return list of strings."""
       return [str(item) for item in data.values()]
   ```

2. **Write Clear Docstrings**
   ```python
   def calculate_cost(tokens: int, model: str) -> float:
       """Calculate the cost for a Bedrock API call.
       
       Args:
           tokens: Number of tokens consumed
           model: Model identifier (e.g., 'claude-3-5-sonnet')
           
       Returns:
           Cost in USD
           
       Raises:
           ValueError: If model is not supported
       """
   ```

3. **Use Descriptive Names**
   ```python
   # Good
   user_authentication_token = get_jwt_token(user_id)
   
   # Bad
   token = get_token(id)
   ```

4. **Keep Functions Small**
   - Maximum 20 lines per function
   - Single responsibility principle
   - Clear input/output contracts

5. **Handle Errors Gracefully**
   ```python
   try:
       result = dangerous_operation()
   except SpecificException as e:
       logger.error("Operation failed", exc_info=True)
       raise ProcessingError(f"Failed to process: {e}") from e
   ```

### Security Practices

1. **Never commit secrets**
2. **Validate all inputs**
3. **Use parameterized queries**
4. **Apply principle of least privilege**
5. **Regular dependency updates**

### Documentation Standards

1. **All public functions must have docstrings**
2. **Use Google docstring format**
3. **Document complex algorithms**
4. **Include usage examples**
5. **Maintain README accuracy**

## Continuous Improvement

### Regular Tasks

1. **Weekly**: Update dependencies and security scan
2. **Monthly**: Review and update quality thresholds
3. **Quarterly**: Audit and improve tooling configuration
4. **Annually**: Evaluate new tools and practices

### Metrics Tracking

Monitor these quality metrics:
- Test coverage percentage
- Docstring coverage percentage
- Linting error rates
- Security vulnerability counts
- Code complexity scores
- Technical debt ratios

### Tool Updates

Keep tools updated for:
- Security patches
- New features
- Performance improvements
- Bug fixes
- Python version compatibility

## Support

### Getting Help

1. **Documentation**: Check tool-specific docs
2. **Team Guidelines**: Follow team conventions
3. **IDE Integration**: Use IDE extensions for real-time feedback
4. **Community**: Consult tool communities for advanced usage

### Reporting Issues

If you encounter issues with code quality tools:

1. Check tool documentation
2. Verify configuration files
3. Test with minimal examples
4. Report to tool maintainers if needed
5. Document workarounds for team

## Conclusion

Code quality is a team responsibility. These tools and processes ensure:

- **Consistent Code Style**: Everyone follows the same standards
- **Early Bug Detection**: Issues caught before production
- **Security**: Vulnerabilities identified and fixed
- **Maintainability**: Code is readable and well-documented
- **Reliability**: Comprehensive testing and validation

Follow these guidelines to maintain high-quality, secure, and maintainable code in the Manuel backend project.