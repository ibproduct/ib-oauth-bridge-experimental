# Codebase Summary

## Project Structure

```
ib-oauth/
├── cdk/                      # Infrastructure as Code
│   ├── bin/                  # CDK app entry point
│   │   └── ib-oauth.ts      # Stack initialization
│   ├── lib/                  # Stack definitions
│   │   └── ib-oauth-stack.ts # Main infrastructure stack
│   └── tsconfig.json        # CDK TypeScript config
├── src/                      # Lambda function source code
│   ├── handlers/            # API endpoint handlers
│   │   ├── authorize/       # Authorization endpoint
│   │   │   └── index.ts
│   │   ├── token/          # Token endpoint
│   │   │   └── index.ts
│   │   └── userinfo/       # UserInfo endpoint
│   │       └── index.ts
│   ├── services/           # Business logic (to be implemented)
│   │   ├── ib-client/      # IB API integration
│   │   ├── token/          # Token management
│   │   └── storage/        # DynamoDB operations
│   └── utils/              # Shared utilities
├── tests/                  # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/              # End-to-end tests
├── cline_docs/           # Project documentation
├── package.json          # Project dependencies
├── tsconfig.json        # Main TypeScript config
└── cdk.json            # CDK configuration
```

## Key Components and Their Interactions

### 1. Infrastructure (Implemented)
- **API Gateway**
  * REST API with three endpoints
  * Stage-based deployments (dev/prod)
  * CloudWatch logging enabled
  * X-Ray tracing configured

- **Lambda Functions**
  * Node.js 20.x runtime
  * TypeScript implementation
  * Environment variables for configuration
  * 256MB memory allocation
  * 10-second timeout

- **DynamoDB Tables**
  * State table for OAuth state management
  * Code table for authorization codes
  * Token table with refresh token GSI
  * TTL enabled for automatic cleanup

### 2. API Layer (Placeholder Implementation)
- **authorize.ts**
  * Endpoint: GET /authorize
  * Purpose: Initiate OAuth flow
  * Status: Fully implemented
  * Features:
    - OAuth parameter validation
    - State parameter generation
    - IB API integration
    - DynamoDB state storage
    - Login URL generation

- **token.ts**
  * Endpoint: POST /token
  * Purpose: Token exchange
  * Status: Basic handler structure

- **userinfo.ts**
  * Endpoint: GET /userinfo
  * Purpose: User profile data
  * Status: Basic handler structure

### 3. Business Logic
- **IB Client Service** (Implemented)
  * IB API communication with axios
  * Initial token retrieval
  * Login URL generation
  * Error handling with interceptors

- **Token Service** (To Be Implemented)
  * JWT token generation
  * Token validation
  * Refresh token handling

- **Storage Service** (Implemented)
  * DynamoDB operations for state/tokens
  * TTL-based cleanup
  * GSI for refresh tokens
  * Error handling

## Data Flow (Planned)

### Authorization Flow
1. Client requests authorization
2. System generates state and IB token
3. User redirected to IB login
4. IB redirects back with token
5. System validates and issues OAuth tokens

### Token Exchange Flow
1. Client submits authorization code
2. System validates code
3. Retrieves IB session
4. Issues access and refresh tokens

### UserInfo Flow
1. Client requests user info
2. System validates access token
3. Retrieves IB session data
4. Returns mapped user profile

## External Dependencies

### AWS Services (Configured)
- API Gateway
- Lambda
- DynamoDB
- CloudWatch
- X-Ray

### NPM Packages (Installed)
- Core Dependencies:
  * @aws-sdk/client-dynamodb
  * @aws-sdk/lib-dynamodb
  * axios
  * jose
  * uuid
  * zod

- Development Dependencies:
  * TypeScript
  * AWS CDK
  * Jest
  * ts-node
  * esbuild

## Recent Changes
1. Initial project setup
2. Infrastructure implementation
3. Basic Lambda handlers
4. Development environment configuration

## Next Development Focus
1. Implement core business logic
2. Add comprehensive testing
3. Enhance security measures
4. Complete documentation

## Development Guidelines

### Code Style
- TypeScript strict mode
- ESLint configuration (to be added)
- Prettier formatting (to be added)

### Testing Requirements
- Unit test coverage (to be implemented)
- Integration test suites (to be implemented)
- E2E test scenarios (to be implemented)

### Documentation Standards
- JSDoc comments
- README updates
- API documentation

## Deployment Process

### Environments
- Development Stack (IBOAuthDevStack)
  * Region: us-west-1
  * Resource prefix: ib-oauth-
  * Stage: dev

- Production Stack (IBOAuthProdStack)
  * Region: us-west-1
  * Resource prefix: ib-oauth-
  * Stage: prod

### Commands
```bash
# Development
npm run cdk:deploy:dev

# Production
npm run cdk:deploy:prod

# View Changes
npm run cdk:diff