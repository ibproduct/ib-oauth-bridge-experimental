# Development Workflow

## Test Clients

### Local Development Testing
- Use `test-client.html` for local development
- Runs on http://localhost:8081
- Points to local OAuth server (http://localhost:3001)
- Basic implementation for quick testing

### Production/Staging Testing
- Use `api-test-client.html` deployed to CloudFront
- Points to actual API Gateway endpoints
- Includes full feature set:
  * Session management
  * PKCE support
  * Userinfo endpoint
  * Proxy functionality
  * Error handling

## Development Workflow

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

### New Architecture: Lambda Aliases
This project uses a **single CloudFormation stack** with Lambda function aliases to manage dev and production environments:

- **Stack name**: `ib-oauth-stack` (single stack)
- **Lambda functions**: No stage suffix (e.g., `ib-oauth-authorize`, `ib-oauth-token`)
- **DynamoDB tables**: No stage suffix (shared: `ib-oauth-state`, `ib-oauth-tokens`)
- **API Gateway stages**:
  - `dev` → points to `dev` alias (always $LATEST)
  - `main` → points to `main` alias (specific published versions)

### Lambda Alias Strategy

**Dev Alias (`dev`):**
- Always points to `$LATEST` version
- Auto-updates when you deploy code
- Used for active development and testing
- Accessed via: `https://{api-id}.execute-api.us-west-1.amazonaws.com/dev/`

**Main Alias (`main`):**
- Points to specific published versions
- Manually promoted from dev after testing
- Production-stable code
- Accessed via: `https://{api-id}.execute-api.us-west-1.amazonaws.com/main/`

### Benefits of This Architecture
1. **Single source of truth**: One function with versioned deployments
2. **Cost savings**: ~50% reduction in Lambda functions and resources
3. **Easier promotion**: Test on dev, then publish and update main alias
4. **Clear deployment**: Explicit version promotion with rollback capability
5. **Better CI/CD**: Matches standard Lambda deployment patterns

## Deployment Process

### 1. Deploy to Dev (Auto-updates $LATEST)
```bash
# Build and deploy infrastructure
npm run cdk:deploy

# This updates $LATEST automatically
# Dev alias immediately gets the new code
```

### 2. Test on Dev
```bash
# Test dev endpoints
curl https://{api-id}.execute-api.us-west-1.amazonaws.com/dev/authorize

# Run integration tests
npm run test:integration
```

### 3. Promote to Main (Publish & Update Alias)
```bash
# After testing dev, publish all functions to main
npm run publish:main

# Or publish a specific function
npm run publish:function ib-oauth-authorize
```

This script:
- Publishes a new version from $LATEST
- Updates the `main` alias to point to the new version
- Leaves `dev` alias pointing to $LATEST

### 4. Rollback Procedures
```bash
# List available versions
aws lambda list-versions-by-function \
  --function-name ib-oauth-authorize \
  --region us-west-1

# Rollback main alias to a specific version
aws lambda update-alias \
  --function-name ib-oauth-authorize \
  --name main \
  --function-version 3 \
  --region us-west-1
```

## Production Deployment

### Pre-deployment Checklist
- [ ] All tests passing
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Performance testing done
- [ ] Dev alias tested thoroughly

### Initial Production Deployment

```bash
# 1. Build Lambda functions
npm run build:lambdas

# 2. Build CDK
npm run build:cdk

# 3. Deploy stack (creates/updates $LATEST)
npm run cdk:deploy

# This creates:
# - Single CloudFormation stack: ib-oauth-stack
# - Lambda functions without stage suffix
# - dev and main aliases for each function
# - API Gateway with dev and main stages
# - Shared DynamoDB tables
```

### Production Verification
- Endpoint health checks on both stages
- Metric verification by alias
- Log inspection
- Security validation
- Performance testing

### Version Management

```bash
# List all versions
aws lambda list-versions-by-function \
  --function-name ib-oauth-authorize \
  --region us-west-1

# Delete old versions (keep last 5-10)
aws lambda delete-function \
  --function-name ib-oauth-authorize:5 \
  --region us-west-1
```

### Emergency Rollback

#### Alias Rollback (Recommended)
```bash
# List available versions
aws lambda list-versions-by-function \
  --function-name ib-oauth-authorize \
  --region us-west-1

# Update main alias to previous version
aws lambda update-alias \
  --function-name ib-oauth-authorize \
  --name main \
  --function-version 3 \
  --region us-west-1

# Repeat for all functions or use script
./scripts/publish-version.sh ib-oauth-authorize 3
```

#### Stack Rollback
```bash
# If needed, rollback entire stack
aws cloudformation rollback-stack --stack-name ib-oauth-stack

# Monitor rollback
aws cloudformation describe-stack-events \
  --stack-name ib-oauth-stack \
  --region us-west-1
```

### Emergency Procedures
1. **Identify Issue**: Check CloudWatch logs and metrics
2. **Determine Scope**: Is it dev or main alias?
3. **Immediate Action**:
   - If main is affected, rollback alias to previous version
   - If dev is affected, investigate and fix
4. **Communication**: Notify affected stakeholders
5. **Resolution**: Fix issue and redeploy
6. **Post-Mortem**: Document incident and preventive measures

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
npm run cdk:deploy

# Run integration tests
npm run test:integration

# Test client
npm run test:client
```

### 3. Production Testing
```bash
# Test main endpoints
curl https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/main/authorize

# Monitor production metrics
npm run monitor:prod
```

## Monitoring & Debugging

### 1. CloudWatch Logs
```bash
# Watch dev logs ($LATEST)
aws logs tail /aws/lambda/ib-oauth-authorize --follow

# Filter by alias using log stream
# Dev and main versions create separate log streams
```

### 2. Metrics & Alerts

#### Dev Alias Metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=ib-oauth-authorize Name=Resource,Value=ib-oauth-authorize:dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

#### Main Alias Metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=ib-oauth-authorize Name=Resource,Value=ib-oauth-authorize:main \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

#### Monitoring Best Practices
- Set up CloudWatch alarms per alias
- Monitor error rates separately for dev and main
- Track version deployment history
- Monitor DynamoDB metrics (shared tables)
- Set up cost alerts

### 3. Health Checks
```bash
# Check dev endpoints
curl -v https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/authorize

# Check main endpoints
curl -v https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/main/authorize
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
- [ ] All tests passing on dev
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Performance testing done
- [ ] Client applications ready for endpoint updates

### 2. Release Steps
1. Verify dev alias is stable
2. Publish versions: `npm run publish:main`
3. Run verification tests on main
4. Monitor main alias metrics
5. Update client documentation
6. Notify stakeholders

### 3. Post-release Tasks
- Monitor error rates by alias
- Watch performance metrics (especially main)
- Check user feedback
- Document lessons learned
- Archive old Lambda versions

## Cost Management

### Benefits of Single-Stack Architecture
- **~50% cost reduction** from single set of Lambda functions
- Shared DynamoDB tables (no duplication)
- Single API Gateway (multiple stages)
- Reduced CloudWatch log storage

### Resource Optimization
- Lambda memory/timeout configuration
- DynamoDB on-demand vs. provisioned capacity
- API Gateway caching
- CloudWatch log retention policies (default: 30 days)

### Cost Monitoring
```bash
# Tag all resources for cost tracking
# All resources tagged with: Project=ib-oauth, ManagedBy=cdk

# View costs by resource tag
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --filter file://cost-filter.json \
  --metrics BlendedCost
```

## Security Considerations

### 1. Infrastructure Security
- VPC configuration (if required)
- Security groups
- IAM roles with least privilege
- KMS encryption for DynamoDB
- WAF rules for API Gateway

### 2. Application Security
- Rate limiting at API Gateway
- Input validation with Zod
- Token security (JWT)
- Session management
- CORS configuration

### 3. Monitoring & Alerts
- Error rate monitoring by alias
- Performance alerts
- Security notifications
- Resource utilization alerts
- Cost alerts

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
   - Automated deployment with alias promotion
   - Per-alias monitoring
   - Documentation maintenance
   - Backup procedures

## Disaster Recovery

### Backup Strategy
- DynamoDB point-in-time recovery enabled
- CloudFormation template in version control
- Lambda function code in Git
- Configuration backups
- Documentation maintained

### Recovery Procedures
1. Recreate CloudFormation stack from template
2. Restore DynamoDB data if needed
3. Deploy Lambda functions
4. Verify configuration
5. Run verification tests

## Production Infrastructure Details

### API Gateway Configuration
- Custom domain with SSL certificate (optional)
- WAF integration for security
- Request throttling and rate limiting
- Usage plans and API keys
- Enhanced logging
- Two stages: dev and main

### Lambda Configuration
- Memory: 256MB (adjustable)
- Timeout: 10 seconds
- Versioning enabled
- Aliases: dev and main
- Reserved concurrency (if needed)
- VPC integration (if required)

### DynamoDB Configuration
- On-demand capacity mode
- Auto-scaling (if using provisioned)
- Point-in-time recovery enabled
- Encryption at rest
- Backup strategy configured

## Compliance & Auditing

### Audit Trails
- CloudWatch logs (all requests logged)
- CloudFormation change history
- Lambda version history
- DynamoDB item-level changes (if enabled)

### Compliance Checks
- OAuth 2.0 compliance
- Security best practices
- Data protection regulations
- AWS best practices