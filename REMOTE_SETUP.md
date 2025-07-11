# Remote Repository Setup Guide

## Quick Setup Options

### Option 1: GitHub CLI (Recommended)
```bash
# Install GitHub CLI if not already installed
brew install gh

# Authenticate with GitHub
gh auth login

# Create repository and push
gh repo create manuel --public --description "Enterprise-grade voice assistant for product manuals using AWS Bedrock"
git remote add origin https://github.com/$(gh api user --jq .login)/manuel.git
git push -u origin main
```

### Option 2: Manual GitHub Setup
1. Go to https://github.com/new
2. Repository name: `manuel`
3. Description: "Enterprise-grade voice assistant for product manuals using AWS Bedrock"
4. Choose Public/Private as needed
5. Don't initialize with README (we have one)
6. Click "Create repository"

Then run:
```bash
git remote add origin https://github.com/YOUR_USERNAME/manuel.git
git push -u origin main
```

### Option 3: GitLab Setup
```bash
# Create on GitLab.com or your GitLab instance
git remote add origin https://gitlab.com/YOUR_USERNAME/manuel.git
git push -u origin main
```

### Option 4: Azure DevOps
```bash
# Create project in Azure DevOps
git remote add origin https://dev.azure.com/YOUR_ORG/YOUR_PROJECT/_git/manuel
git push -u origin main
```

## Repository Configuration

### Branch Protection Rules
After pushing, configure branch protection:

**GitHub:**
1. Go to Settings → Branches
2. Add rule for `main` branch
3. Enable:
   - Require pull request reviews
   - Require status checks (CI/CD)
   - Require branches to be up to date
   - Require conversation resolution
   - Restrict pushes to matching branches

**GitLab:**
1. Go to Settings → Repository → Push Rules
2. Configure protected branches and merge request requirements

### Repository Settings

**GitHub Repository Settings:**
- **Description**: "Enterprise-grade voice assistant for product manuals using AWS Bedrock"
- **Topics**: `aws`, `serverless`, `voice-assistant`, `bedrock`, `rag`, `enterprise`, `lambda`, `api-gateway`
- **License**: MIT
- **Security**: Enable security advisories and automated security updates

**Repository Structure:**
```
manuel/
├── backend/                 # AWS serverless backend
├── frontend/               # React Native mobile app
├── docs/                   # Additional documentation
├── .github/                # GitHub workflows and templates
├── README.md              # Project overview
├── CONTRIBUTING.md        # Contribution guidelines
├── LICENSE               # MIT license
└── .gitignore           # Git ignore rules
```

## CI/CD Setup

### GitHub Actions Workflow
Create `.github/workflows/backend-ci.yml`:

```yaml
name: Backend CI/CD

on:
  push:
    branches: [ main, develop ]
    paths: [ 'backend/**' ]
  pull_request:
    branches: [ main ]
    paths: [ 'backend/**' ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
        pip install -r tests/integration/fixtures/requirements.txt
    
    - name: Run tests
      run: |
        cd backend/tests/integration
        make test-smoke
        make test-security
    
    - name: Run linting
      run: |
        cd backend/tests/integration
        make lint
    
    - name: Validate SAM template
      run: |
        cd backend
        sam validate
    
    - name: Security scan
      run: |
        cd backend
        bandit -r src/
        safety check -r requirements.txt

  conventional-commits:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: Conventional Commits
      uses: wagoid/commitlint-github-action@v5
```

### Issue Templates
Create `.github/ISSUE_TEMPLATE/`:

**Bug Report** (`.github/ISSUE_TEMPLATE/bug_report.md`):
```markdown
---
name: Bug report
about: Create a report to help us improve
title: 'fix: '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
- OS: [e.g. iOS]
- Browser [e.g. chrome, safari]
- Version [e.g. 22]

**Additional context**
Add any other context about the problem here.
```

**Feature Request** (`.github/ISSUE_TEMPLATE/feature_request.md`):
```markdown
---
name: Feature request
about: Suggest an idea for this project
title: 'feat: '
labels: enhancement
assignees: ''
---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
```

### Pull Request Template
Create `.github/pull_request_template.md`:

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

## Security Configuration

### GitHub Security Settings
1. **Dependabot**: Enable automated dependency updates
2. **Code scanning**: Enable CodeQL analysis
3. **Secret scanning**: Enable secret detection
4. **Security advisories**: Enable private vulnerability reporting

### Repository Secrets
Add these secrets for CI/CD:
- `AWS_ACCESS_KEY_ID`: For AWS deployments
- `AWS_SECRET_ACCESS_KEY`: For AWS deployments
- `AWS_REGION`: Default region (eu-west-1)
- `CODECOV_TOKEN`: For coverage reporting (optional)

## Documentation Updates

### Main README.md
Update the main project README:

```markdown
# Manuel - Enterprise Voice Assistant

> Enterprise-grade voice assistant for product manuals using AWS Bedrock

[![CI/CD](https://github.com/YOUR_USERNAME/manuel/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/manuel/actions/workflows/backend-ci.yml)
[![Security](https://github.com/YOUR_USERNAME/manuel/actions/workflows/security.yml/badge.svg)](https://github.com/YOUR_USERNAME/manuel/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

### Backend Deployment
```bash
cd backend
sam build
sam deploy --parameter-overrides-file parameters.json
```

### Frontend Setup
```bash
cd frontend
npm install
expo start
```

## 📚 Documentation

- [Backend Documentation](backend/README.md)
- [Frontend Documentation](frontend/README.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## 🏗️ Architecture

- **Backend**: AWS Serverless (Lambda, API Gateway, DynamoDB, S3)
- **AI/ML**: AWS Bedrock (Claude 3.5 Sonnet, Titan Embeddings)
- **Frontend**: React Native with Expo
- **Authentication**: AWS Cognito
- **Monitoring**: CloudWatch with custom dashboards

## 🔒 Security

- Multi-layer security with WAF and application middleware
- Advanced input validation and sanitization
- Rate limiting and IP allowlisting
- Comprehensive security testing

## 🧪 Testing

- Integration testing with chaos engineering
- Security testing with vulnerability scanning
- Performance testing with load simulation
- Automated CI/CD testing pipeline

## 📈 Monitoring

- Real-time CloudWatch dashboards
- Structured logging with correlation IDs
- Custom metrics and alerting
- Cost tracking and optimization

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
```

### License File
Create `LICENSE`:

```
MIT License

Copyright (c) 2025 Manuel Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Next Steps After Remote Setup

1. **Configure branch protection rules**
2. **Set up CI/CD workflows**
3. **Add team members and collaborators**
4. **Configure project boards for task management**
5. **Set up automated deployments**
6. **Configure monitoring and alerting**
7. **Add security scanning and compliance checks**

## Team Collaboration

### Repository Access Levels
- **Admin**: Full access, can modify settings
- **Maintain**: Manage repository without sensitive settings
- **Write**: Create branches, push code, create PRs
- **Triage**: Manage issues and PRs without write access
- **Read**: View and clone repository

### Development Workflow
1. Create feature branches from `main`
2. Make changes following conventional commits
3. Run tests and quality checks
4. Create pull request with template
5. Code review and approval
6. Merge to main with squash commit
7. Automated deployment to staging/production

Choose your preferred option and I'll help you execute the setup!