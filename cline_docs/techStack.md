# Technical Stack Documentation

## AWS Configuration

### Region & Resource Naming
- Region: `us-west-1` (mandatory)
- Resource prefix: `ib-oauth-` (mandatory)
- Use current AWS profile
- All resources must follow naming convention in general-instructions.md

## Backend Services

### AWS Services
- **API Gateway**
  * Name: `ib-oauth-{stage}-api`
  * REST API with OpenAPI/Swagger specification
  * Custom domain support
  * API key management
  * Request/response mapping templates

- **Lambda Functions (Node.js 20.x)**
  * Names: `ib-oauth-{function-name}`
  * TypeScript for type safety
  * AWS SDK v3 for AWS services
  * JWT handling with jose library
  * Axios for HTTP requests

- **DynamoDB**
  * Names: `ib-oauth-{table-name}`
  * Single-table design
  * GSIs for token lookups
  * TTL for automatic cleanup
  * On-demand capacity

### Security & Authentication
- **JWT Handling**
  * jose library for JWT operations
  * RS256 signing algorithm
  * JWK key rotation support

- **TLS/HTTPS**
  * TLS 1.2+ requirement
  * AWS Certificate Manager for SSL/TLS
  * Strict security headers

## Development Tools

### Infrastructure as Code
- **AWS CDK (TypeScript)**
  * Infrastructure defined in code
  * Environment-specific configurations
  * Automated deployments
  * Region locked to us-west-1

### Testing
- **Jest**
  * Unit tests for Lambda functions
  * Integration tests for API endpoints
  * Mock AWS services

- **Postman/Newman**
  * API testing collections
  * Environment-specific variables
  * CI/CD integration

### Monitoring & Logging
- **CloudWatch**
  * Log groups: `/aws/lambda/ib-oauth-{function-name}`
  * Structured logging
  * Custom metrics
  * Alerts and dashboards

- **X-Ray**
  * Distributed tracing
  * Performance monitoring
  * Error tracking

## Dependencies

### Production Dependencies
```json
{
  "@aws-sdk/client-dynamodb": "^3.x",
  "@aws-sdk/lib-dynamodb": "^3.x",
  "axios": "^1.x",
  "jose": "^5.x",
  "uuid": "^9.x",
  "zod": "^3.x"
}
```

### Development Dependencies
```json
{
  "@types/aws-lambda": "^8.x",
  "@types/jest": "^29.x",
  "@types/node": "^20.x",
  "aws-cdk-lib": "^2.x",
  "esbuild": "^0.19.x",
  "jest": "^29.x",
  "ts-jest": "^29.x",
  "typescript": "^5.x"
}
```

## Environment Configuration

### Required Environment Variables
```bash
# AWS Configuration
AWS_REGION=us-west-1  # Mandatory
STAGE=dev|prod

# IntelligenceBank Configuration
IB_PLATFORM_URL=https://example.intelligencebank.com
IB_API_KEY=your-api-key

# OAuth Configuration
OAUTH_ISSUER=https://oauth.yourdomain.com
OAUTH_AUDIENCE=your-audience
JWT_PRIVATE_KEY=base64-encoded-private-key
JWT_PUBLIC_KEY=base64-encoded-public-key

# Security Configuration
TOKEN_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=2592000
```

## Deployment Architecture

### Development Environment
- Region: us-west-1
- Stage: dev
- Stack name: IBOAuthDevStack
- Domain: oauth-dev.yourdomain.com

### Production Environment
- Region: us-west-1
- Stage: prod
- Stack name: IBOAuthProdStack
- Domain: oauth.yourdomain.com

## Scaling & Performance

### DynamoDB Capacity
- On-demand capacity mode
- Auto-scaling enabled
- Provisioned capacity for production

### Lambda Configuration
- Memory: 256MB
- Timeout: 10 seconds
- Concurrent executions: 100

### API Gateway
- Throttling: 1000 requests/second
- Burst: 2000 requests
- Cache enabled for production

## Security Measures

### API Security
- WAF rules enabled
- Rate limiting per IP
- Request size limits

### Data Protection
- At-rest encryption (DynamoDB)
- In-transit encryption (TLS)
- Key rotation policy

### Access Control
- IAM roles per function
- Least privilege principle
- Resource-based policies

## Monitoring & Alerting

### CloudWatch Alarms
- Error rate threshold: 1%
- Latency threshold: p95 < 1s
- 4xx/5xx rate threshold: 5%

### Health Checks
- API endpoint monitoring
- DynamoDB health
- Lambda execution monitoring

## Resource Tags
All resources must have these tags:
```json
{
  "Project": "ib-oauth",
  "Environment": "dev|prod",
  "ManagedBy": "cdk"
}