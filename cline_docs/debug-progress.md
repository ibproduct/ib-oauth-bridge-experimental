# Debugging Progress

## Common Issues and Solutions

### 1. IB Token Expiration
- **Symptom**: 404 error from IB API with "resource has expired"
- **Cause**: IB tokens have a short lifespan
- **Solution**: 
  - Implement token refresh mechanism
  - Handle expired tokens gracefully
  - Clear expired state entries

### 2. State Management
- **Symptom**: Invalid authorization code errors
- **Cause**: State entries not persisting between Lambda invocations
- **Solution**:
  - Implemented DynamoDB storage service
  - State table with 'state' partition key and TTL
  - Proper state handling in authorize/token functions
  - Environment variables and IAM permissions

#### Implementation Details
- Storage Service:
  ```typescript
  // DynamoDB state entry
  interface StateEntry {
    state: string;      // Partition key
    clientId: string;
    redirectUri: string;
    scope: string;
    ibToken: IBAuthResponse;
    platformUrl: string;
    oauthState?: string;
    createdAt: number;
    expires: number;    // TTL attribute
  }
  ```

- State Flow:
  1. Store initial state with poll token
  2. Store session info with auth code after successful login
  3. Clean up state after token exchange
  4. TTL for automatic cleanup of expired entries

- Environment Configuration:
  ```typescript
  // Lambda environment variables
  environment: {
    STATE_TABLE: stateTable.tableName,
    TOKEN_TABLE: tokenTable.tableName,
    STAGE: props.stage
  }
  ```

### 3. API Gateway Integration
- **Symptom**: CORS or routing issues
- **Cause**: Misconfigured API Gateway
- **Solution**:
  - Verify CORS headers
  - Check Lambda integrations
  - Validate endpoint paths

## Error Handling Implementation

### 1. OAuth Errors
```typescript
// Standard OAuth error responses
{
  error: 'invalid_request' | 'server_error' | 'authorization_pending',
  error_description: string
}
```

### 2. State Management
```typescript
// State entry structure
{
  clientId: string,
  redirectUri: string,
  scope: string,
  ibToken?: {
    sid: string,
    content: {
      apiV3url: string,
      clientid: string
    }
  }
}
```

### 3. Logging Strategy
- Request details
- State operations
- IB API interactions
- Error conditions

## Testing Procedures

### 1. Authorization Flow
```bash
# Test initial authorization
curl -X GET "https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/authorize?response_type=code&client_id=test-client&redirect_uri=https://d3p9mz3wmmolll.cloudfront.net/callback&scope=profile"

# Test polling
curl -X GET "https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/authorize/poll?token={token}"
```

### 2. Token Exchange
```bash
# Exchange code for tokens
curl -X POST "https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code={code}&redirect_uri={redirect_uri}"
```

## Monitoring

### CloudWatch Metrics
- Lambda invocations
- API Gateway requests
- Error rates
- Latency

### Log Groups
- `/aws/lambda/ib-oauth-authorize-dev`
- `/aws/lambda/ib-oauth-token-dev`
- `/aws/lambda/ib-oauth-callback-dev`

## Next Steps

1. Implement token refresh mechanism
2. Add better error handling for IB API failures
3. Improve state cleanup for expired entries
4. Add monitoring alerts for error spikes