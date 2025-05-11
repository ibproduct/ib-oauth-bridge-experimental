# IB OAuth Bridge Architecture

## Overview
This architecture proposes an OAuth 2.0 compatible bridge for IntelligenceBank's Browser Login API, allowing standard OAuth clients to authenticate with IB.

## Components

### 1. AWS API Gateway
- Exposes OAuth 2.0 standard endpoints:
  * `/authorize` - Initiates the OAuth flow
  * `/token` - Exchanges authorization code for tokens
  * `/userinfo` - Returns user information

### 2. AWS Lambda Functions
- **Authorization Handler**
  * Initiates IB browser login flow
  * Generates and stores state parameter
  * Maps to IB's Step 1 (get token) and Step 2 (browser redirect)

- **Token Handler**
  * Exchanges authorization code for access token
  * Validates state parameter
  * Maps to IB's Step 3 (get session info)
  * Generates JWT tokens for OAuth clients

- **UserInfo Handler**
  * Returns standardized user profile information
  * Maps IB session info to OAuth claims

### 3. Amazon DynamoDB
- **State Table**
  * Stores OAuth state parameters
  * Maps OAuth states to IB tokens
  * TTL for automatic cleanup

- **Token Table**
  * Stores issued access/refresh tokens
  * Maps tokens to IB sessions
  * TTL for token expiration

## Flow Sequence

1. **Authorization Request**
   ```
   GET /authorize?
     response_type=code&
     client_id=CLIENT_ID&
     redirect_uri=CALLBACK_URL&
     scope=openid profile&
     state=STATE
   ```
   - Lambda generates IB token via Step 1
   - Stores state mapping in DynamoDB
   - Redirects to IB login (Step 2)

2. **IB Login Callback**
   ```
   GET /callback?token=IB_TOKEN
   ```
   - Lambda validates IB token
   - Exchanges for session info (Step 3)
   - Generates authorization code
   - Redirects to client callback URL

3. **Token Exchange**
   ```
   POST /token
   grant_type=authorization_code&
   code=AUTH_CODE&
   redirect_uri=CALLBACK_URL
   ```
   - Lambda validates authorization code
   - Retrieves IB session from DynamoDB
   - Issues JWT access token
   - Returns token response

4. **UserInfo Request**
   ```
   GET /userinfo
   Authorization: Bearer ACCESS_TOKEN
   ```
   - Lambda validates access token
   - Returns mapped user profile from IB session

## Security Considerations

1. **Token Security**
   - All tokens stored in DynamoDB are encrypted
   - Short TTL for authorization codes (5 minutes)
   - Configurable access token expiration

2. **HTTPS/TLS**
   - All endpoints require HTTPS
   - Modern TLS versions only (1.2+)

3. **CORS**
   - Configurable CORS policies in API Gateway
   - Restricted to registered client domains

4. **Rate Limiting**
   - API Gateway throttling rules
   - Per-client and per-IP limits

## Implementation Notes

1. **OAuth Configuration**
   - Support for multiple client applications
   - Configurable scopes and claims
   - Standard OAuth 2.0 error responses

2. **IB Integration**
   - Environment-specific IB platform URLs
   - Configurable session timeouts
   - Error handling for IB API responses

3. **Monitoring**
   - CloudWatch metrics and logs
   - Login success/failure tracking
   - Token usage analytics

4. **Deployment**
   - Infrastructure as Code (AWS CDK)
   - Multiple environment support
   - Blue/green deployments