# Manuel Project - Session Context for Claude Code

## Project Overview
Manuel is an enterprise-grade voice assistant for product manuals using AWS Bedrock and React Native. The project has been successfully implemented with comprehensive backend architecture, security, testing, and remote repository setup.

## Repository Information
- **Repository**: https://github.com/a1o1/manuel
- **Type**: Public GitHub repository
- **Description**: "Voice Assistant for product manuals"
- **Current State**: Fully functional backend with remote repository, conventional commits configured

## Project Architecture

### Backend (AWS Serverless)
- **Framework**: AWS SAM (Serverless Application Model)
- **Runtime**: Python 3.11
- **Region**: eu-west-1 (Dublin, Ireland)
- **AI/ML**: AWS Bedrock (Claude 3.5 Sonnet + Titan Embeddings)
- **Authentication**: AWS Cognito
- **Storage**: S3 (manuals), DynamoDB (usage tracking)
- **Monitoring**: CloudWatch Dashboard, Alarms, Custom Metrics

### Frontend (React Native)
- **Framework**: React Native with Expo
- **Platform**: iOS (primary target)
- **Authentication**: Integration with AWS Cognito
- **Features**: Voice recording, manual querying, offline capability

## Current Implementation Status

### ✅ Completed (Backend)
1. **Enterprise Security Framework**
   - Multi-layer WAF protection with OWASP Top 10 rules
   - Advanced security middleware with input validation
   - Rate limiting (IP-based and user-based)
   - Security headers (HSTS, CSP, X-Frame-Options)
   - HMAC signature validation

2. **Performance Optimization**
   - Multi-layer caching (L1 memory, L2 Redis)
   - Connection pooling for AWS services
   - Intelligent cache promotion/demotion
   - Redis ElastiCache cluster integration

3. **Advanced Error Handling**
   - Sophisticated retry strategies (exponential, linear, jittered)
   - Dead letter queue processing
   - Error classification and tracking
   - SNS notifications for critical errors

4. **Comprehensive Testing Framework**
   - 7 test categories: Auth, API, Security, Performance, Error Handling, Failure Scenarios, E2E
   - Chaos engineering with failure simulation
   - Mock AWS services for isolated testing
   - Pytest integration with custom markers

5. **Monitoring & Observability**
   - CloudWatch dashboards with custom metrics
   - Structured logging with correlation IDs
   - Real-time alerting and notifications
   - Cost tracking and optimization

6. **Configuration Management**
   - Environment-specific parameters (dev, staging, production)
   - Parameter files for easy deployment
   - Support for Claude 4 model upgrades

### 🔄 In Progress
- React Native mobile application development
- Voice recording and playback functionality
- Authentication integration with Cognito

### 📋 Planned
- Multi-language support
- Advanced analytics dashboard
- Custom model fine-tuning
- Enterprise SSO integration

## Key File Locations

### Backend Structure
```
backend/
├── src/
│   ├── functions/              # Lambda functions
│   │   ├── query/app.py       # RAG queries with Claude
│   │   ├── transcribe/app.py  # Audio transcription
│   │   ├── usage/app.py       # Usage tracking
│   │   ├── manuals/app.py     # Manual management
│   │   └── [other functions]
│   └── shared/                # Shared utilities
│       ├── security_middleware.py
│       ├── advanced_error_handler.py
│       ├── performance_optimizer.py
│       ├── logger.py
│       └── utils.py
├── tests/integration/         # Integration testing framework
│   ├── test_framework.py     # Main test framework
│   ├── test_runner.py        # CLI test runner
│   ├── pytest_tests.py       # Pytest integration
│   └── Makefile              # Test automation
├── template.yaml             # SAM template
├── parameters*.json          # Environment configurations
└── [documentation files]
```

### Frontend Structure
```
frontend/
├── src/
├── assets/
├── App.js
└── package.json
```

## Development Workflow

### Git & Conventional Commits
- **Branch**: `main` (default)
- **Commit Standard**: Conventional Commits with Commitizen
- **Pre-commit Hooks**: Configured for code quality
- **Remote**: git@github.com:a1o1/manuel.git

### Deployment Commands
```bash
# Backend deployment
cd backend
sam build
sam deploy --parameter-overrides-file parameters.json          # Development
sam deploy --parameter-overrides-file parameters-production.json # Production
sam deploy --parameter-overrides-file parameters-claude4.json    # Claude 4 testing

# Frontend development
cd frontend
npm install
expo start

# Testing
cd backend/tests/integration
make test-smoke      # Basic functionality
make test-security   # Security validation
make test-performance # Performance tests
make test-chaos      # Chaos engineering
```

### Key Configuration Files
- **Backend**: `template.yaml`, `parameters*.json`, `pyproject.toml`
- **Testing**: `test_config.json`, `pytest.ini`, `Makefile`
- **Git**: `.gitignore`, `.pre-commit-config.yaml`, `.cz.json`
- **GitHub**: `.github/workflows/backend-ci.yml`, issue templates, PR template

## Technical Specifications

### AWS Services Used
- **Lambda**: Python 3.11 functions (configurable memory: 256MB-512MB)
- **API Gateway**: RESTful API with Cognito authorizer
- **DynamoDB**: Usage tracking with TTL cleanup
- **S3**: Manual storage with lifecycle policies
- **Cognito**: User authentication and management
- **Bedrock**: Claude 3.5 Sonnet and Titan Embeddings
- **CloudWatch**: Monitoring, logging, and alerting
- **WAF**: Web application firewall protection
- **ElastiCache**: Redis for performance optimization

### Security Implementation
- **WAF Rules**: Common attacks, SQL injection, known bad inputs
- **Input Validation**: Pattern matching, size limits, content scanning
- **Rate Limiting**: DynamoDB-backed per-IP throttling
- **Authentication**: JWT tokens with refresh mechanism
- **Encryption**: Data at rest and in transit
- **Security Headers**: Comprehensive header implementation

### Performance Features
- **L1 Cache**: In-memory LRU cache (thread-safe)
- **L2 Cache**: Redis distributed cache with compression
- **Connection Pooling**: AWS service connection optimization
- **Cache Strategy**: Intelligent promotion/demotion between layers
- **Monitoring**: Real-time performance metrics

### Testing Capabilities
- **Unit Tests**: Component-level testing
- **Integration Tests**: End-to-end system testing
- **Security Tests**: Vulnerability scanning and penetration testing
- **Performance Tests**: Load testing and benchmarking
- **Chaos Engineering**: Failure simulation and resilience testing
- **Mock Services**: AWS service mocking for isolated testing

## Environment Configurations

### Development Environment
- Basic resource allocation (256MB Lambda memory)
- Permissive CORS settings
- No email alerts
- 14-day log retention
- Security features disabled for development ease

### Production Environment
- Enhanced performance (512MB Lambda memory)
- Restricted CORS to specific domains
- Email alerts enabled
- 90-day log retention
- X-Ray tracing enabled
- Full security features enabled

### Claude 4 Testing Environment
- Conservative quotas (30 daily, 500 monthly)
- Enhanced monitoring and alerting
- Claude 4 Sonnet model with inference profiles
- Comprehensive performance tracking

## Development Tools & Dependencies

### Backend Dependencies
- **Core**: boto3, botocore, structlog
- **Performance**: redis, hiredis, pickle-mixin
- **Security**: cryptography
- **Testing**: pytest, moto, requests, safety, bandit

### Development Tools
- **Commitizen**: Conventional commits (`cz commit`)
- **Pre-commit**: Automated quality checks
- **GitHub CLI**: Repository management (`gh`)
- **SAM CLI**: Serverless deployment
- **AWS CLI**: AWS service management

## Current Development Focus

### Immediate Next Steps
1. **Frontend Development**: Complete React Native mobile app
2. **Voice Integration**: Implement audio recording and playback
3. **Authentication Flow**: Integrate Cognito authentication in frontend
4. **Testing Enhancement**: Add more comprehensive test coverage
5. **Performance Optimization**: Fine-tune caching strategies

### Technical Debt
- None identified - project follows enterprise best practices
- Regular security updates and dependency management needed
- Performance monitoring and optimization ongoing

## Key Architectural Decisions

### Security-First Approach
- Multi-layer security implementation
- Defense in depth strategy
- Comprehensive input validation
- Regular security testing

### Performance-Focused Design
- Multi-layer caching strategy
- Connection pooling optimization
- Intelligent cache management
- Real-time performance monitoring

### Enterprise-Grade Testing
- Comprehensive test coverage
- Chaos engineering integration
- Automated testing pipeline
- Multiple testing environments

### Cost Optimization
- Real-time cost tracking
- Usage-based quotas
- Efficient resource allocation
- Cost alerting and monitoring

## Monitoring & Observability

### CloudWatch Integration
- Custom dashboards with business metrics
- Structured JSON logging with correlation IDs
- Real-time alerting for critical events
- Performance tracking and optimization

### Custom Metrics
- Request duration and count
- Quota usage percentage
- Bedrock call duration and token consumption
- Knowledge base retrieval effectiveness
- Error rates and patterns

### Alerting Configuration
- API Gateway errors (4xx/5xx thresholds)
- Lambda function errors and timeouts
- DynamoDB throttling detection
- Cost threshold alerts
- Security event notifications

## Repository Management

### Branch Strategy
- **main**: Production-ready code
- **feature/***: Feature development branches
- **hotfix/***: Critical bug fixes
- **release/***: Release preparation

### CI/CD Pipeline
- Automated testing on push/PR
- Security scanning integration
- Conventional commit validation
- Quality gate enforcement

### Documentation
- Comprehensive README with architecture diagrams
- Contributing guidelines with conventional commits
- Security policy and best practices
- API documentation and deployment guides

## Future Enhancements Planned

### Phase 2: Frontend & Mobile
- React Native mobile application
- Voice recording and playback
- Authentication integration
- Offline capability

### Phase 3: Advanced Features
- Multi-language support
- Advanced analytics dashboard
- Custom model fine-tuning
- Enterprise SSO integration

### Phase 4: Scale & Optimization
- Multi-region deployment
- Advanced caching strategies
- Performance optimization
- Cost optimization features

## Important Notes for Session Restart

1. **Project State**: Backend is fully implemented and deployed to GitHub
2. **Current Focus**: Frontend development and voice integration
3. **Development Environment**: All tools configured and ready
4. **Testing**: Comprehensive framework in place and functional
5. **Documentation**: All specifications and guides are complete and current

## Session Continuation Commands

When restarting development:

```bash
# Navigate to project
cd /Users/alanoleary/dev/personal/manuel

# Check current status
git status
git log --oneline -5

# Continue backend development
cd backend
sam build
sam local start-api --parameter-overrides-file parameters.json

# Continue frontend development
cd frontend
npm install
expo start

# Run tests
cd backend/tests/integration
make test-smoke
```

This context document provides all necessary information to seamlessly continue development on the Manuel project in future Claude Code sessions.