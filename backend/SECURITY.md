# Manuel Backend Security Implementation

## Overview

The Manuel backend now includes enterprise-grade security features that can be enabled through configuration parameters. This implementation provides multiple layers of protection including WAF, input validation, rate limiting, and advanced monitoring.

## Security Features

### 1. AWS WAF Integration
- **Purpose**: Protect API Gateway from common web attacks
- **Features**:
  - Common Rule Set (OWASP top 10 protection)
  - Known Bad Inputs protection
  - SQL injection prevention
  - Rate limiting by IP address
  - IP allowlist support
- **Configuration**: Set `EnableWAF: "true"` in parameter files

### 2. Advanced Security Middleware
- **Purpose**: Application-level security validation
- **Features**:
  - Request size validation
  - IP address allowlisting
  - Rate limiting with DynamoDB backend
  - SQL injection pattern detection
  - XSS prevention
  - HMAC signature validation for sensitive operations
  - Security headers injection
- **Configuration**: Set `EnableAdvancedSecurity: "true"` in parameter files

### 3. Input Validation
- **SQL Injection Protection**: Pattern-based detection of malicious SQL
- **XSS Prevention**: Scanning for cross-site scripting attempts
- **Request Size Limits**: Configurable maximum request sizes
- **Audio Duration Limits**: Prevent excessively long audio uploads

### 4. Rate Limiting
- **Per-IP Rate Limiting**: Configurable requests per time window
- **DynamoDB Backend**: Distributed rate limiting across Lambda instances
- **Automatic Cleanup**: TTL-based cleanup of old rate limit records

### 5. Security Headers
- **HSTS**: HTTP Strict Transport Security
- **Content Security Policy**: Prevent XSS attacks
- **X-Frame-Options**: Prevent clickjacking
- **X-Content-Type-Options**: Prevent MIME type confusion

## Configuration

### Parameter Files

#### Development (parameters.json)
```json
{
  "EnableWAF": "false",
  "EnableAdvancedSecurity": "false",
  "MaxRequestSizeMB": "10",
  "MaxAudioDurationSeconds": "300",
  "RateLimitWindowMinutes": "1",
  "RateLimitRequests": "100",
  "IPAllowlist": "",
  "HMACSigningKey": ""
}
```

#### Production (parameters-production.json)
```json
{
  "EnableWAF": "true",
  "EnableAdvancedSecurity": "true",
  "MaxRequestSizeMB": "5",
  "MaxAudioDurationSeconds": "240",
  "RateLimitWindowMinutes": "1",
  "RateLimitRequests": "50",
  "IPAllowlist": "203.0.113.0/24,198.51.100.0/24",
  "HMACSigningKey": "your-secret-key-here"
}
```

### Environment Variables

The security middleware reads these environment variables:
- `ENABLE_ADVANCED_SECURITY`: Enable/disable advanced security features
- `MAX_REQUEST_SIZE_MB`: Maximum request size in MB
- `MAX_AUDIO_DURATION_SECONDS`: Maximum audio duration in seconds
- `RATE_LIMIT_WINDOW_MINUTES`: Rate limit window in minutes
- `RATE_LIMIT_REQUESTS`: Maximum requests per window
- `IP_ALLOWLIST`: Comma-separated list of allowed IPs/CIDRs
- `HMAC_SIGNING_KEY`: HMAC signing key for sensitive operations
- `RATE_LIMIT_TABLE_NAME`: DynamoDB table for rate limiting

## Deployment

### 1. Development Deployment
```bash
# Security disabled for development
sam deploy --parameter-overrides-file backend/parameters.json
```

### 2. Production Deployment
```bash
# Security enabled for production
sam deploy --parameter-overrides-file backend/parameters-production.json
```

### 3. Security-Only Deployment
```bash
# Enable only security features
sam deploy --parameter-overrides EnableWAF=true EnableAdvancedSecurity=true
```

## Security Best Practices

### 1. IP Allowlisting
- Use specific IP ranges rather than allowing all traffic
- Format: `203.0.113.12` or `203.0.113.0/24`
- Multiple IPs: `203.0.113.12,198.51.100.0/24`

### 2. HMAC Signing Keys
- Generate secure keys: `openssl rand -base64 32`
- Store in AWS Secrets Manager for production
- Never commit keys to version control

### 3. Rate Limiting
- Set conservative limits initially
- Monitor usage patterns and adjust
- Consider different limits for different user tiers

### 4. Monitoring
- Set up CloudWatch alarms for security events
- Monitor WAF metrics and blocked requests
- Track rate limiting violations

## Architecture

### Request Flow with Security
1. **API Gateway**: Receives request
2. **WAF**: Validates request (if enabled)
3. **Lambda**: Processes request
4. **Security Middleware**: Validates request (if enabled)
   - Request size validation
   - IP allowlist check
   - Rate limiting
   - Input validation
   - HMAC signature validation
5. **Application Logic**: Processes business logic
6. **Response**: Returns response with security headers

### Security Middleware Components

#### SecurityMiddleware Class
- Main security validation logic
- Configurable security policies
- Integration with AWS services

#### Rate Limiting
- DynamoDB-based distributed rate limiting
- Per-IP tracking with TTL cleanup
- Configurable windows and limits

#### Input Validation
- Pattern-based SQL injection detection
- XSS prevention
- Request size validation
- Content type validation

## Monitoring and Alerting

### CloudWatch Metrics
- WAF blocked requests
- Rate limiting violations
- Security validation failures
- Response time impacts

### CloudWatch Alarms
- High security event rates
- WAF rule violations
- Rate limiting threshold breaches
- Failed authentication attempts

### Logging
- All security events logged to CloudWatch
- Structured JSON logging format
- Correlation IDs for request tracking
- Security-specific log groups

## Troubleshooting

### Common Issues

1. **WAF Blocking Legitimate Traffic**
   - Check WAF metrics in CloudWatch
   - Review IP allowlist configuration
   - Adjust rate limiting thresholds

2. **Rate Limiting False Positives**
   - Increase rate limit thresholds
   - Check for shared IP addresses (NAT, proxies)
   - Monitor usage patterns

3. **Performance Impact**
   - Security middleware adds ~50-100ms latency
   - Consider disabling in development
   - Monitor Lambda duration metrics

### Debug Mode
Enable debug logging by setting log level to DEBUG in environment variables.

## Security Considerations

### Production Checklist
- [ ] WAF enabled
- [ ] Advanced security enabled
- [ ] IP allowlist configured
- [ ] HMAC keys stored securely
- [ ] Rate limits configured appropriately
- [ ] Monitoring and alerts set up
- [ ] Security headers validated
- [ ] Regular security review scheduled

### Security Review Schedule
- Monthly: Review security logs and metrics
- Quarterly: Update security configurations
- Annually: Comprehensive security audit

## Support

For security-related issues or questions:
1. Check CloudWatch logs for security events
2. Review security metrics in CloudWatch dashboard
3. Consult security configuration documentation
4. Test security features in development environment first