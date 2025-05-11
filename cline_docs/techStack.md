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
### Dependencies
```json
{
  "axios": "^1.x",
  "uuid": "^9.x",
  "zod": "^3.x",
  "@aws-sdk/client-dynamodb": "^3.x",
  "@aws-sdk/lib-dynamodb": "^3.x",
  "express": "^4.x"
}
```
```

### Development Dependencies
```json
{
  "@types/express": "^4.x",
  "@types/cors": "^2.x",
  "@types/node": "^20.x",
  "@types/pg": "^8.x",
  "@types/jest": "^29.x",
  "@types/aws-lambda": "^8.x",
  "aws-cdk-lib": "^2.x",
  "esbuild": "^0.19.x",
  "jest": "^29.x",
  "ts-jest": "^29.x",
  "typescript": "^5.x",
  "nodemon": "^3.x",
  "ts-node": "^10.x"
}
```

## Environment Configuration

### Required Environment Variables
```bash
# AWS Configuration
AWS_REGION=us-west-1  # Mandatory
STAGE=dev|prod

# AWS Configuration
AWS_REGION=us-west-1  # Mandatory
AWS_PROFILE=default
STAGE=dev|prod

# Server Configuration
PORT=3001  # For local development
NODE_ENV=development|production

# OAuth Configuration
OAUTH_ISSUER=https://oauth.yourdomain.com
OAUTH_AUDIENCE=your-audience
JWT_SECRET=your-secret-key

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

## Security Implementation

### Security Features
- Request validation with Zod ✅
- JWT token handling ✅
- DynamoDB encryption at rest ✅
- HTTPS via API Gateway ✅
- IAM roles and policies ✅

### Access Control
- Client application registration
- AWS IAM roles per function
- Resource-based policies

## Monitoring Implementation

### CloudWatch Integration
- Lambda function logs ✅
- API Gateway metrics ✅
- DynamoDB monitoring ✅
- Error tracking ✅
- Custom metrics ✅

## Resource Tags
All resources must have these tags:
```json
{
  "Project": "ib-oauth",
  "Environment": "dev|prod",
  "ManagedBy": "cdk"
}