# Testing Documentation

## Test Environment

### API Endpoints
- Base URL: `https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev`
- Test Client: `https://d3p9mz3wmmolll.cloudfront.net`

### Test Credentials
- Client ID: `test-client`
- Redirect URI: `https://d3p9mz3wmmolll.cloudfront.net/callback`
- Scope: `profile`

## Test Cases

### 1. Authorization Flow

#### Initial Authorization
```bash
# Test endpoint
GET /authorize
?response_type=code
&client_id=test-client
&redirect_uri=https://d3p9mz3wmmolll.cloudfront.net/callback
&scope=profile
&state={random_state}

# Expected response
- 200 OK with HTML form
- Form contains platform URL input
```

#### Platform URL Submission
```bash
# Test endpoint
GET /authorize
?platform_url=https://company.intelligencebank.com
&client_id=test-client
&redirect_uri=https://d3p9mz3wmmolll.cloudfront.net/callback
&scope=profile
&state={random_state}

# Expected response
{
  "loginUrl": "https://company.intelligencebank.com/auth/?login=0&token={ib_token}",
  "token": "{poll_token}"
}
```

#### Login Status Polling
```bash
# Test endpoint
GET /authorize/poll?token={poll_token}

# Expected responses
1. Login pending:
{
  "error": "authorization_pending",
  "error_description": "The authorization request is still pending"
}

2. Login success:
{
  "redirect_url": "https://d3p9mz3wmmolll.cloudfront.net/callback?code={auth_code}&state={state}"
}
```

### 2. Token Exchange

#### Auth Code Exchange
```bash
# Test endpoint
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={auth_code}
&redirect_uri=https://d3p9mz3wmmolll.cloudfront.net/callback

# Expected response
{
  "access_token": "{access_token}",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "{refresh_token}",
  "apiV3url": "https://company.intelligencebank.com/api/v3",
  "clientid": "{ib_client_id}",
  "sid": "{ib_session_id}",
  "logintimeoutperiod": 24,  // Session validity in hours
  "sidExpiry": 1747234779,   // Unix timestamp
  "sidCreatedAt": 1747148379 // Unix timestamp
}
```

### 3. Session Management

#### Token Refresh
```bash
# Test endpoint
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id=test-client

# Expected response
{
  "access_token": "{new_access_token}",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "{new_refresh_token}",
  "sid": "{ib_session_id}",
  "sidExpiry": 1747234779,
  "sidCreatedAt": 1747148379
}
```

#### Session Expiry
```bash
# Test expired session
GET /proxy/{path}
Authorization: Bearer {token_with_expired_sid}

# Expected response
{
  "error": "invalid_token",
  "error_description": "Session has expired"
}
```

#### Refresh Limit
```bash
# Test exceeded refresh limit
POST /token
grant_type=refresh_token&refresh_token={token_with_max_refreshes}

# Expected response
{
  "error": "invalid_token",
  "error_description": "Session refresh limit exceeded"
}
```

### 4. Proxy Integration

#### API Request
```bash
# Test endpoint
GET /proxy/company.intelligencebank.com/api/3.0.0/users
Authorization: Bearer {access_token}

# Expected response
{
  // IB API response data
}
```

#### Error Cases
```bash
# Test invalid token
GET /proxy/{path}
Authorization: Bearer invalid-token

# Expected response
{
  "error": "invalid_token",
  "error_description": "Invalid or expired access token"
}
```

### 5. Error Cases

#### Invalid OAuth Parameters
```bash
# Test missing client_id
GET /authorize?response_type=code

# Expected response
{
  "error": "invalid_request",
  "error_description": "Invalid request parameters"
}
```

#### Invalid Platform URL
```bash
# Test invalid URL
GET /authorize?platform_url=invalid-url...

# Expected response
{
  "error": "invalid_request",
  "error_description": "Invalid platform URL"
}
```

#### Invalid Auth Code
```bash
# Test invalid code
POST /token
grant_type=authorization_code&code=invalid-code

# Expected response
{
  "error": "invalid_request",
  "error_description": "Invalid authorization code"
}
```

## Integration Testing

### Test Client
1. Open `https://d3p9mz3wmmolll.cloudfront.net`
2. Click "Login with IntelligenceBank"
3. Enter platform URL
4. Complete IB login
5. Verify redirect with code
6. Verify token exchange
7. Check session info
8. Test API proxy calls
9. Verify session refresh
10. Test session expiry

### Automated Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "Authorization Flow"
```

## Monitoring Tests

### CloudWatch Logs
```bash
# Watch authorize logs
aws logs tail /aws/lambda/ib-oauth-authorize-dev --follow

# Watch token logs
aws logs tail /aws/lambda/ib-oauth-token-dev --follow

# Watch proxy logs
aws logs tail /aws/lambda/ib-oauth-proxy-dev --follow

# Monitor session events
aws logs tail /aws/lambda/ib-oauth-proxy-dev --follow | grep -E "session|refresh|token|sid"
```

### Metrics to Monitor
1. Authorization success rate
2. Token exchange success rate
3. Session refresh rate
4. Session expiry events
5. Proxy request success rate
6. Error rates by type
7. API latency
8. State table operations

## Test Data Cleanup

### State Table
```bash
# Items are automatically cleaned up by TTL
# TTL values:
- Auth codes: 10 minutes
- Poll tokens: 5 minutes
```

### Manual Cleanup
```bash
# Delete test items
aws dynamodb delete-item \
  --table-name ib-oauth-state-dev \
  --key '{"state": {"S": "test-state"}}'
```

## Troubleshooting

### Common Issues
1. CORS errors
   - Check API Gateway CORS settings
   - Verify allowed origins

2. State not found
   - Check TTL expiration
   - Verify state parameter passing

3. IB API errors
   - Check token expiration
   - Verify platform URL
   - Check IB service status
   - Validate session state
   - Check refresh attempts

4. Session Issues
   - Check session expiry time
   - Verify refresh count
   - Validate session age
   - Monitor refresh rate
   - Check token claims

### Debug Tools
1. CloudWatch Logs
2. API Gateway Test Console
3. DynamoDB Console
4. Test Client Console