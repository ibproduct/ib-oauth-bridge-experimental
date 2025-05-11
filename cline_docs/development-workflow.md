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
   # Start local development server
   npm run dev
   ```
   - Uses serverless-offline for API Gateway/Lambda simulation
   - Local DynamoDB for development
   - Hot reloading enabled

2. **Testing Endpoints**
   - Use Postman collection in `tests/postman`
   - Environment variables in `tests/postman/environments`
   - Local endpoints:
     * http://localhost:3000/authorize
     * http://localhost:3000/token
     * http://localhost:3000/userinfo

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

## Deployment Process

### Development Deployment
```bash
# Deploy to dev environment
npm run deploy:dev
```

### Production Deployment
```bash
# Deploy to production
npm run deploy:prod
```

### Post-Deployment Verification
1. Run health check script
2. Verify CloudWatch logs
3. Check API endpoints
4. Run integration tests

## Monitoring & Debugging

### Local Debugging
1. Use VS Code launch configurations in `.vscode/launch.json`
2. CloudWatch Logs insights locally via AWS Toolkit
3. DynamoDB local explorer

### Production Monitoring
1. CloudWatch Dashboards
   - Access via AWS Console
   - Custom metrics and alarms
   - Log insights queries

2. X-Ray Tracing
   - Trace request flows
   - Identify bottlenecks
   - Debug errors

## Troubleshooting

### Common Issues

1. **DynamoDB Connectivity**
   - Check AWS credentials
   - Verify table exists
   - Check IAM permissions

2. **Lambda Execution**
   - Check CloudWatch logs
   - Verify environment variables
   - Check timeout settings

3. **API Gateway**
   - Verify API key if required
   - Check CORS settings
   - Validate request/response mappings

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