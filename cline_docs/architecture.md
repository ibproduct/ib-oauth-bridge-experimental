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
  - Token generation
  - IB session info retrieval
  - Error handling
- **Response**:
  - OAuth tokens
  - IB session details (apiV3url, clientid, sid)

### 2. API Gateway
- **Base URL**: `https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev`
- **Endpoints**:
  ```
  GET  /authorize         - Start OAuth flow
  GET  /authorize/poll    - Check login status
  POST /token            - Exchange code for tokens
  ```
- **Features**:
  - CORS support
  - Request validation
  - Lambda integration
  - Error handling

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
    ibToken: IBAuthResponse, // IB session info
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
    ibToken: IBAuthResponse, // IB session info
    platformUrl: string,    // IB platform URL
    createdAt: number,      // Creation timestamp
    expires: number         // TTL timestamp
  }
  ```
- **Indexes**:
  - Primary: accessToken
  - GSI: refreshToken (for refresh token lookups)
- **Token Flow**:
  1. Store tokens after successful code exchange
  2. Update on token refresh
  3. Automatic cleanup via TTL after expiration

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
   - Store session info
   ```

3. **Auth Code Generation**
   ```
   On login success:
   - Generate auth code
   - Store session info with code
   - Redirect to client
   ```

4. **Token Exchange**
   ```
   Client -> /token
   - Validate auth code
   - Get session info
   - Generate tokens
   - Return tokens + session info
   ```

## Security Measures

### 1. OAuth Security
- State parameter for CSRF
- Short-lived auth codes
- Secure token generation
- HTTPS only

### 2. Data Protection
- DynamoDB encryption
- TTL for state cleanup
- Secure session storage

### 3. Access Control
- API Gateway authorization
- Lambda IAM roles
- Resource policies

## Monitoring & Logging

### CloudWatch Integration
- Lambda function logs
- API Gateway metrics
- Custom error tracking
- Performance monitoring

### Log Structure
```typescript
{
  level: 'INFO' | 'ERROR',
  action: string,
  details: object,
  timestamp: string
}
```

## Error Handling

### OAuth Errors
- invalid_request
- server_error
- authorization_pending

### System Errors
- IB API failures
- State management issues
- Token validation errors

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

## Future Improvements
1. Token refresh mechanism
2. Enhanced error handling
3. Monitoring alerts
4. Performance optimization
5. Session management