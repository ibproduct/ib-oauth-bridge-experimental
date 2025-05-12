# Development Workflow

## Initial Setup

### Prerequisites
1. Node.js 20.x or later
2. AWS CLI v2 configured with appropriate credentials
3. AWS CDK CLI installed globally
4. Git for version control

### Repository Setup
```bash
# Clone the repository
git clone <repository-url>
cd ib-oauth

# Install dependencies
npm install

# Bootstrap AWS CDK (first time only)
cdk bootstrap

# Copy environment template
cp .env.example .env
```

### Environment Configuration
1. Configure `.env` file with required variables (see techStack.md)
2. Set up AWS credentials with appropriate permissions
3. Configure IntelligenceBank API credentials

## Development Process

### Local Development
1. **Start Local Development**
   ```bash
   # Start development server
   npm run dev
   
   # In another terminal, start test client
   cd tests
   npx http-server -p 8081
   ```
   - Express server on port 3001
   - Test client on port 8081
   - In-memory storage for development
   - Hot reloading with ts-node

2. **Testing Endpoints**
   - Use test client at http://localhost:8081
   - Local OAuth server endpoints:
     * http://localhost:3001/authorize
     * http://localhost:3001/token
   - Test IB API integration with proxy server
   - Verify session handling and token exchange

### Testing

1. **Unit Tests**
   ```bash
   # Run unit tests
   npm run test

   # Run with coverage
   npm run test:coverage
   ```

2. **Integration Tests**
   ```bash
   # Run integration tests against dev environment
   npm run test:integration
   ```

3. **E2E Tests**
   ```bash
   # Run end-to-end tests
   npm run test:e2e
   ```

### Code Quality

1. **Linting**
   ```bash
   # Run ESLint
   npm run lint

   # Fix auto-fixable issues
   npm run lint:fix
   ```

2. **Type Checking**
   ```bash
   # Run TypeScript compiler checks
   npm run type-check
   ```

3. **Pre-commit Hooks**
   - Husky configured for:
     * Lint-staged
     * Type checking
     * Unit tests
     * Commit message format

## AWS Deployment Steps

### 1. Test Client Deployment
```bash
# Build and deploy test client
npm run build:cdk && AWS_REGION=us-west-1 STAGE=dev cdk deploy ib-oauth-stack-dev --require-approval never

# Verify CloudFront distribution
aws cloudfront list-distributions --query 'DistributionList.Items[?Comment==`ib-oauth-client-dev`]'
```

### 2. Infrastructure Setup
```bash
# Deploy AWS infrastructure
cdk deploy

# Verify DynamoDB tables
aws dynamodb list-tables
```

### 2. Production Configuration
1. Configure AWS Lambda environment
2. Set up CloudWatch logging
3. Configure API Gateway endpoints
4. Set up SSL certificate

### 3. Deployment Process
```bash
# Build and package Lambda functions
npm run build

# Deploy to AWS
npm run deploy
```

### 4. Post-Deployment Verification
1. Test OAuth flow using CloudFront-hosted test client
2. Verify CloudWatch logs for all components
3. Check API Gateway endpoints
4. Verify CloudFront distribution and S3 bucket
5. Run integration tests

## Current Monitoring & Debugging

### Local Development
1. Use VS Code debugger with ts-node
2. Console logging for development
3. Local test client for development
4. CloudFront-hosted test client for integration testing
5. Network tab for API inspection

### Initial Production Monitoring
1. Application Logs
   - Winston logger setup
   - Error tracking
   - Request/response logging
   - Performance metrics

2. Server Monitoring
   - PM2 monitoring
   - Resource utilization
   - Error rates
   - Response times

## Troubleshooting

### Common Issues & Solutions

1. **DynamoDB Issues**
   - Check AWS credentials
   - Verify table exists
   - Check IAM permissions

2. **Lambda Issues**
   - Check CloudWatch logs
   - Verify environment variables
   - Check execution role
   - Monitor memory usage

3. **API Gateway Issues**
   - Check endpoint configuration
   - Verify Lambda integration
   - Check CloudWatch logs
   - Test with API Gateway console

### Error Handling

1. **OAuth Errors**
   - Follow OAuth 2.0 error response format
   - Log detailed errors internally
   - Return user-friendly messages

2. **IB API Errors**
   - Retry with exponential backoff
   - Circuit breaker for repeated failures
   - Fallback mechanisms

## Security Practices

### Credential Management
1. Use AWS Secrets Manager for sensitive values
2. Rotate credentials regularly
3. Use separate credentials per environment

### Code Security
1. Regular dependency updates
2. Security scanning in CI/CD
3. Code review requirements

### Access Control
1. IAM roles and policies
2. API key management
3. IP allowlisting when required

## Release Process

### Version Management
1. Semantic versioning
2. Changelog maintenance
3. Git tags for releases

### Deployment Stages
1. Development deployment
2. QA verification
3. Staging deployment
4. Production deployment

### Rollback Procedures
1. Version rollback process
2. Data recovery procedures
3. Incident response plan

## Documentation

### API Documentation
1. OpenAPI/Swagger specs
2. Postman collection updates
3. README maintenance

### Architecture Updates
1. Update architecture diagrams
2. Document design decisions
3. Update security documentation

## Support & Maintenance

### Routine Maintenance
1. Log rotation
2. Metric cleanup
3. Database maintenance

### Support Procedures
1. Issue tracking workflow
2. Escalation procedures
3. On-call rotations