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

### 4. State Management

#### DynamoDB Operations
```typescript
// Store state
await storageService.storeState(
  clientId,
  redirectUri,
  scope,
  sessionInfo,
  platformUrl,
  stateKey
);

// Retrieve state
const state = await storageService.getState(stateKey);

// Delete state
await storageService.deleteState(stateKey);
```

#### TTL Configuration
```typescript
// State entry TTL
const TTL_MINUTES = {
  AUTH_CODE: 10,
  POLL_TOKEN: 5
};
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

### 3. Manual Testing
1. Use test client at https://d3p9mz3wmmolll.cloudfront.net
2. Monitor CloudWatch logs
3. Check DynamoDB state
4. Verify error handling

## Deployment Process

### 1. Development
```bash
# Deploy to dev
npm run cdk:deploy:dev

# Verify deployment
aws cloudformation describe-stacks --stack-name ib-oauth-stack-dev
```

### 2. Production
```bash
# Deploy to prod
npm run cdk:deploy:prod

# Verify deployment
aws cloudformation describe-stacks --stack-name ib-oauth-stack-prod
```

## Monitoring & Debugging

### 1. CloudWatch Logs
```bash
# Watch authorize logs
aws logs tail /aws/lambda/ib-oauth-authorize-dev --follow

# Watch token logs
aws logs tail /aws/lambda/ib-oauth-token-dev --follow
```

### 2. DynamoDB Monitoring
```bash
# Check table status
aws dynamodb describe-table --table-name ib-oauth-state-dev

# Scan table
aws dynamodb scan --table-name ib-oauth-state-dev --limit 10
```

### 3. API Gateway Testing
```bash
# Test authorize endpoint
curl -v "https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/authorize?response_type=code&client_id=test-client"

# Test token endpoint
curl -X POST "https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=test"
```

## Error Handling

### 1. OAuth Errors
```typescript
// Create OAuth error
createOAuthError(
  OAuthErrorType.INVALID_REQUEST,
  'Invalid request parameters'
);

// Error response
{
  statusCode: 400,
  body: JSON.stringify({
    error: 'invalid_request',
    error_description: 'Invalid request parameters'
  })
}
```

### 2. System Errors
```typescript
// Log error
console.error('Handler error:', error);

// Error response
{
  statusCode: 500,
  body: JSON.stringify({
    error: 'server_error',
    error_description: 'Internal server error'
  })
}
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