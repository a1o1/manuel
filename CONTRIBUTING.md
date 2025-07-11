# Contributing to Manuel

Welcome to Manuel! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 18+ (for frontend and build tools)
- Python 3.11+ (for backend development)
- AWS CLI configured with appropriate permissions
- SAM CLI for serverless development
- Git for version control

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/manuel.git
cd manuel

# Install commitizen globally
pipx install commitizen
# or
npm install -g commitizen cz-conventional-changelog

# Backend setup
cd backend
pip install -r requirements.txt
pip install -r tests/integration/fixtures/requirements.txt

# Frontend setup
cd ../frontend
npm install
```

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages to ensure consistency and enable automated versioning.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without functional changes
- **perf**: Performance improvements
- **test**: Adding or modifying tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI/CD configuration
- **chore**: Maintenance tasks, dependency updates
- **revert**: Reverting previous commits

### Scopes

For backend changes:
- **auth**: Authentication and authorization
- **api**: API endpoints and gateway
- **security**: Security middleware and features
- **performance**: Performance optimizations
- **error-handling**: Error handling and retry logic
- **testing**: Test framework and test cases
- **monitoring**: Monitoring and observability
- **config**: Configuration management
- **infra**: Infrastructure and deployment
- **bedrock**: AWS Bedrock integration
- **transcribe**: AWS Transcribe integration
- **cognito**: AWS Cognito integration
- **dynamodb**: DynamoDB operations
- **s3**: S3 operations
- **lambda**: Lambda functions
- **api-gateway**: API Gateway configuration
- **cloudwatch**: CloudWatch integration
- **waf**: WAF configuration
- **redis**: Redis caching
- **sqs**: SQS operations
- **sns**: SNS operations

For frontend changes:
- **ui**: User interface components
- **navigation**: Navigation and routing
- **audio**: Audio recording and playback
- **auth**: Authentication flows
- **api**: API integration
- **state**: State management
- **style**: Styling and themes

### Examples

```bash
# Feature addition
feat(auth): implement JWT token refresh mechanism

Add automatic token refresh for expired JWT tokens.
Integrates with AWS Cognito for seamless user experience.

Closes #123

# Bug fix
fix(api): resolve timeout issue in transcribe endpoint

Increase timeout from 30s to 60s for long audio files.
Add proper error handling for timeout scenarios.

Fixes #456

# Performance improvement
perf(caching): implement multi-layer caching strategy

- Add L1 memory cache for frequently accessed data
- Add L2 Redis cache for distributed caching
- Implement cache promotion/demotion logic
- Reduce average response time by 40%

# Security enhancement
feat(security): add advanced input validation middleware

- Implement SQL injection protection
- Add XSS prevention patterns
- Configure request size limits
- Add rate limiting per IP address

BREAKING CHANGE: Request validation is now stricter and may reject previously valid requests

# Testing
test(integration): add chaos engineering test suite

Add comprehensive failure scenario testing including:
- Bedrock API throttling simulation
- Network timeout scenarios
- Database connection failures
- Circuit breaker testing

# Documentation
docs(api): update API documentation with new security endpoints

Add documentation for:
- Authentication endpoints
- Security configuration
- Rate limiting behavior
- Error response formats

# Infrastructure
build(ci): add automated security scanning pipeline

Configure security scanning with:
- SAST analysis using CodeQL
- Dependency vulnerability scanning
- Container image scanning
- Infrastructure security validation
```

### Using Commitizen

We recommend using commitizen for consistent commit messages:

```bash
# Interactive commit creation
cz commit

# Or use the shorthand
git cz

# Bump version based on conventional commits
cz bump

# Generate changelog
cz changelog
```

### Manual Commit Guidelines

If not using commitizen, ensure your commits follow this pattern:

```bash
# Good examples
git commit -m "feat(auth): implement OAuth 2.0 integration"
git commit -m "fix(api): resolve memory leak in query processing"
git commit -m "docs(readme): update installation instructions"

# Bad examples
git commit -m "fix bug"
git commit -m "update code"
git commit -m "WIP"
```

## Code Quality Guidelines

### Pre-commit Hooks

We use pre-commit hooks to ensure code quality:

```bash
# Install pre-commit hooks
pre-commit install

# Run hooks manually
pre-commit run --all-files
```

### Code Formatting

- **Python**: Use `black` with line length 88
- **JavaScript/TypeScript**: Use `prettier` with standard config
- **YAML/JSON**: Use `prettier` for consistent formatting

### Testing Requirements

- All new features must include tests
- Maintain minimum 80% test coverage
- Run integration tests before submitting PR
- Include both positive and negative test cases

### Security Guidelines

- Never commit secrets, API keys, or sensitive data
- Use parameterized queries to prevent SQL injection
- Implement proper input validation
- Follow principle of least privilege
- Use secure headers and CORS configuration

## Pull Request Process

### Before Submitting

1. **Run Tests**: Ensure all tests pass
   ```bash
   # Backend tests
   cd backend/tests/integration
   make test-smoke
   make test-security
   
   # Frontend tests
   cd frontend
   npm test
   ```

2. **Code Quality**: Run linting and formatting
   ```bash
   # Backend
   cd backend
   make lint
   make format
   
   # Frontend
   cd frontend
   npm run lint
   npm run format
   ```

3. **Security Scan**: Run security checks
   ```bash
   cd backend/tests/integration
   make test-security
   ```

### PR Requirements

- Clear, descriptive title using conventional commit format
- Detailed description explaining changes
- Link to related issues
- Test coverage for new functionality
- Documentation updates if applicable
- Security review for security-related changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Security enhancement

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Security testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added and passing
- [ ] No security vulnerabilities introduced
- [ ] Breaking changes documented

## Screenshots (if applicable)
Add screenshots for UI changes

## Additional Notes
Any additional information or context
```

## Release Process

### Version Bumping

We use semantic versioning with conventional commits:

```bash
# Bump version based on commits
cz bump

# Preview what version would be bumped
cz bump --dry-run

# Bump to specific version
cz bump --increment MAJOR|MINOR|PATCH
```

### Changelog Generation

```bash
# Generate changelog
cz changelog

# Generate changelog for specific version
cz changelog --incremental
```

### Release Workflow

1. **Feature Development**: Work on feature branches
2. **Testing**: Comprehensive testing on staging environment
3. **Version Bump**: Use commitizen to bump version
4. **Changelog**: Generate updated changelog
5. **Tag Release**: Create git tag with version
6. **Deploy**: Deploy to production environment

## Branch Strategy

### Branch Types

- **main**: Production-ready code
- **develop**: Development integration branch
- **feature/**: Feature development branches
- **hotfix/**: Critical bug fixes
- **release/**: Release preparation branches

### Branch Naming

```bash
# Feature branches
feature/auth-jwt-integration
feature/performance-optimization
feature/security-middleware

# Hotfix branches
hotfix/critical-security-fix
hotfix/memory-leak-fix

# Release branches
release/v1.2.0
release/v2.0.0
```

## Issue Guidelines

### Issue Types

- **Bug Report**: Problems with existing functionality
- **Feature Request**: New functionality proposals
- **Enhancement**: Improvements to existing features
- **Security**: Security-related issues
- **Documentation**: Documentation improvements

### Issue Templates

Use the provided issue templates for consistency:

- Bug report template
- Feature request template
- Security vulnerability template
- Documentation improvement template

## Code Review Guidelines

### Review Criteria

- **Functionality**: Does the code work as intended?
- **Code Quality**: Is the code clean, readable, and maintainable?
- **Testing**: Are there adequate tests?
- **Security**: Are there any security vulnerabilities?
- **Performance**: Are there any performance implications?
- **Documentation**: Is documentation updated?

### Review Process

1. **Automated Checks**: Ensure all CI/CD checks pass
2. **Code Review**: At least one approved review required
3. **Security Review**: Required for security-related changes
4. **Final Testing**: Manual testing in staging environment
5. **Merge**: Squash and merge with conventional commit message

## Getting Help

- **Documentation**: Check project documentation first
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Contact**: Reach out to maintainers for urgent issues

## Code of Conduct

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) in all interactions.

## License

By contributing to Manuel, you agree that your contributions will be licensed under the MIT License.