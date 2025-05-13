# Development Workflow

## Environment Setup

### Prerequisites
```bash
# Required tools
- Node.js 20.x
- AWS CLI
- AWS CDK
- TypeScript

# AWS Configuration
aws configure
- Region: us-west-1 (mandatory)
- Profile: default
```

### Project Setup
```bash
# Clone repository
git clone <repository-url>
cd ib-oauth

# Install dependencies
npm install

# Build project
npm run build
```

## Development Process

### 1. Local Development
```bash
# Start development server
npm run dev

# Watch for changes
npm run build -- --watch

# Run tests
npm test
```

### 2. Lambda Development

#### Function Structure
```typescript
// src/handlers/{function}/index.ts
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handler logic
  } catch (error) {
    // Error handling
  }
};
```

#### Building Functions
```bash
# Build single function
node scripts/build-lambdas.js authorize

# Build all functions
npm run build:lambdas
```

#### Testing Functions
```bash
# Run function tests
npm test -- --grep "Authorize Handler"

# Test with coverage
npm test -- --coverage
```

### 3. Infrastructure Changes

#### CDK Development
```bash
# Synthesize stack
npm run cdk:synth

# Deploy to dev
npm run cdk:deploy:dev

# Compare changes
npm run cdk:diff
```

#### API Gateway Changes
1. Update `cdk/lib/ib-oauth-stack.ts`
2. Add routes and integrations
3. Configure CORS if needed
4. Deploy changes

## Environment Management

### Development Environment
- Stack name: `ib-oauth-stack-dev`
- API Gateway stage: `dev`
- DynamoDB tables: `*-dev`
- CloudWatch logs: `/aws/lambda/*-dev`

### Production Environment
- Stack name: `ib-oauth-stack-prod`
- API Gateway stage: `prod`
- DynamoDB tables: `*-prod`
- CloudWatch logs: `/aws/lambda/*-prod`

### Environment Isolation
1. Separate CloudFormation stacks
2. Environment-specific resources
3. Isolated logging
4. Independent scaling

## Deployment Process

### 1. Development Deployment
```bash
# Deploy to dev
npm run cdk:deploy:dev

# Verify deployment
aws cloudformation describe-stacks --stack-name ib-oauth-stack-dev

# Test endpoints
npm run test:integration
```

### 2. Production Deployment
```bash
# Pre-deployment checks
npm run test
npm run lint
npm run build

# Deploy to production
npm run cdk:deploy:prod

# Post-deployment verification
npm run test:prod
```

### 3. Rollback Procedures
```bash
# Rollback production
aws cloudformation rollback-stack --stack-name ib-oauth-stack-prod

# Verify rollback
aws cloudformation describe-stacks --stack-name ib-oauth-stack-prod
```

## Testing Process

### 1. Unit Testing
```bash
# Run unit tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### 2. Integration Testing
```bash
# Deploy to dev
npm run cdk:deploy:dev

# Run integration tests
npm run test:integration

# Test client
npm run test:client
```

### 3. Production Testing
```bash
# Run production tests
npm run test:prod

# Monitor production metrics
npm run monitor:prod
```

## Monitoring & Debugging

### 1. CloudWatch Logs
```bash
# Watch dev logs
aws logs tail /aws/lambda/ib-oauth-authorize-dev --follow

# Watch prod logs
aws logs tail /aws/lambda/ib-oauth-authorize-prod --follow
```

### 2. Metrics & Alerts
```bash
# View dev metrics
aws cloudwatch get-metric-data --metric-data-queries file://dev-metrics.json

# View prod metrics
aws cloudwatch get-metric-data --metric-data-queries file://prod-metrics.json
```

### 3. Health Checks
```bash
# Check dev endpoints
curl -v https://dev-api.example.com/health

# Check prod endpoints
curl -v https://api.example.com/health
```

## Documentation

### 1. Code Documentation
- Use JSDoc comments
- Document interfaces and types
- Explain complex logic
- Add usage examples

### 2. API Documentation
- Update OpenAPI spec
- Document endpoints
- Show request/response examples
- List error codes

### 3. Architecture Documentation
- Update flow diagrams
- Document state management
- Explain security measures
- List dependencies

## Release Process

### 1. Pre-release Checklist
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Performance testing done

### 2. Release Steps
1. Tag release version
2. Deploy to production
3. Run verification tests
4. Monitor metrics
5. Update documentation

### 3. Post-release Tasks
- Monitor error rates
- Watch performance metrics
- Check user feedback
- Document lessons learned

## Security Considerations

### 1. Access Control
- IAM roles per environment
- Least privilege principle
- Regular permission review

### 2. Data Protection
- Encryption at rest
- Secure token storage
- Data retention policies

### 3. Monitoring
- Security alerts
- Access logging
- Audit trail
- Incident response

## Best Practices

1. Code Quality
   - Follow style guide
   - Write tests
   - Regular reviews
   - Clean architecture

2. Security
   - Regular updates
   - Security scanning
   - Access control
   - Audit logging

3. Operations
   - Automated deployment
   - Monitoring
   - Documentation
   - Backup procedures