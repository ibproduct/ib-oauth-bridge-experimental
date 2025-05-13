# Architecture Documentation

## System Overview
The OAuth bridge service facilitates authentication between client applications and IntelligenceBank using OAuth 2.0 standards. It handles the complexity of IB's authentication while providing a standard OAuth interface.

## Core Components

### 1. Lambda Functions

#### Authorize Handler (`/authorize`)
- **Purpose**: Manages OAuth authorization flow
- **Key Features**:
  - OAuth parameter validation
  - Platform URL collection
  - IB login integration via iframe
  - Login status polling
  - Auth code generation
- **State Management**:
  - Uses polling token for login state
  - Stores IB session info with auth code

#### Token Handler (`/token`)
- **Purpose**: Handles OAuth token exchange
- **Key Features**:
  - Auth code validation
  - JWT token generation
  - IB session info retrieval
  - Error handling
- **Response**:
  - OAuth tokens (JWT)
  - IB session details (apiV3url, clientid, sid)
- **Session Management**:
  - Tracks IB session timeout (1-120 hours)
  - Calculates sid expiry from logintimeoutperiod
  - Manages token refresh based on sid validity

#### API Proxy Handler (`/api/v3/*`)
- **Purpose**: Proxies requests to IB API
- **Key Features**:
  - Bearer token validation
  - Session management
  - Automatic token refresh
  - Error mapping
- **Flow**:
  1. Validate Bearer token
  2. Check token/session expiry
  3. Refresh if needed
  4. Proxy to IB API
  5. Handle errors

### 2. API Gateway
- **Base URL**: `https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev`
- **Endpoints**:
  ```
  GET  /authorize         - Start OAuth flow
  GET  /authorize/poll    - Check login status
  POST /token            - Exchange code for tokens
  *    /api/v3/*        - API proxy endpoints
  ```
- **Features**:
  - CORS support
  - Request validation
  - Lambda integration
  - Error handling
  - Rate limiting

### 3. DynamoDB Tables

#### State Table (`ib-oauth-state-${stage}`)
- **Purpose**: Manages OAuth state and login state
- **Schema**:
  ```typescript
  {
    state: string (PK),      // Poll token or auth code
    clientId: string,        // OAuth client ID
    redirectUri: string,     // Client callback URL
    scope: string,          // OAuth scope
    ibToken: {              // IB session info
      sid: string,
      content: {
        apiV3url: string,
        clientid: string
      },
      logintimeoutperiod: number // Session validity in hours (1-120)
    },
    platformUrl: string,    // IB platform URL
    oauthState?: string,    // Original OAuth state
    createdAt: number,      // Creation timestamp
    expires: number         // TTL timestamp
  }
  ```
- **State Flow**:
  1. Initial state with poll token during login
  2. Session state with auth code after successful login
  3. Automatic cleanup via TTL after token exchange

#### Token Table (`ib-oauth-tokens-${stage}`)
- **Purpose**: Stores OAuth tokens and session info
- **Schema**:
  ```typescript
  {
    accessToken: string (PK), // OAuth access token
    refreshToken: string,     // OAuth refresh token (GSI)
    clientId: string,        // OAuth client ID
    scope: string,          // OAuth scope
    ibToken: {              // IB session info
      sid: string,
      content: {
        apiV3url: string,
        clientid: string
      },
      logintimeoutperiod: number // Session validity in hours (1-120)
    },
    platformUrl: string,    // IB platform URL
    sidExpiry: number,      // Calculated from logintimeoutperiod
    sidCreatedAt: number,   // When sid was first created
    refreshCount: number,   // Number of refreshes
    createdAt: number,      // Creation timestamp
    expires: number         // TTL timestamp
  }
  ```
- **Indexes**:
  - Primary: accessToken
  - GSI: refreshToken (for refresh token lookups)
- **Token Flow**:
  1. Store tokens after successful code exchange
  2. Calculate sidExpiry from logintimeoutperiod
  3. Update on token refresh
  4. Track session expiry
  5. Automatic cleanup via TTL

## Authentication Flow

1. **Authorization Request**
   ```
   Client -> /authorize
   - Validate OAuth params
   - Display platform URL form
   ```

2. **IB Login**
   ```
   Browser -> IB Platform
   - Load login page in iframe
   - Poll for completion
   - Store session info with timeout period
   ```

3. **Auth Code Generation**
   ```
   On login success:
   - Generate auth code
   - Store session info with code
   - Store login timeout period
   - Redirect to client
   ```

4. **Token Exchange**
   ```
   Client -> /token
   - Validate auth code
   - Get session info
   - Calculate sid expiry
   - Generate JWT tokens
   - Return tokens + session info
   ```

5. **API Access**
   ```
   Client -> /api/v3/*
   - Validate Bearer token
   - Check token and sid validity
   - Refresh if needed (based on expiry)
   - Proxy to IB API
   ```

## Security Measures

### 1. OAuth Security
- State parameter for CSRF
- Short-lived auth codes
- JWT token generation
- HTTPS only
- Token binding
- Session timeout enforcement

### 2. Data Protection
- DynamoDB encryption
- TTL for state cleanup
- Secure session storage
- Rate limiting
- Session validity tracking

### 3. Access Control
- API Gateway authorization
- Lambda IAM roles
- Resource policies
- Scope enforcement
- Session timeout enforcement

## Monitoring & Logging

### CloudWatch Integration
- Lambda function logs
- API Gateway metrics
- Custom error tracking
- Performance monitoring
- Session tracking
- Timeout monitoring

### Log Structure
```typescript
{
  level: 'INFO' | 'ERROR',
  action: string,
  details: {
    sessionTimeout?: number,
    sidExpiry?: number,
    refreshCount?: number,
    ...object
  },
  timestamp: string,
  requestId: string,
  sessionId?: string
}
```

## Error Handling

### OAuth Errors
- invalid_request
- invalid_token
- server_error
- authorization_pending
- insufficient_scope
- session_expired

### System Errors
- IB API failures
- State management issues
- Token validation errors
- Session expiry
- Refresh limits exceeded

## Development Setup

### Local Development
```bash
# Install dependencies
npm install

# Build Lambda functions
npm run build:lambdas

# Deploy to dev
npm run cdk:deploy:dev
```

### Testing
```bash
# Run tests
npm test

# Test client
npm run test:client
```

## Production Environment

### Infrastructure
- Separate CloudFormation stack
- Production API Gateway
- Production DynamoDB tables
- Enhanced monitoring
- Automated scaling

### Deployment
- Zero-downtime updates
- Rollback capability
- Version control
- Audit logging

### Monitoring
- Performance metrics
- Error tracking
- Usage analytics
- Security alerts
- Session timeout tracking

## Future Improvements
1. Enhanced caching
2. Performance optimization
3. Advanced monitoring
4. Automated testing
5. Disaster recovery
6. Session management optimization