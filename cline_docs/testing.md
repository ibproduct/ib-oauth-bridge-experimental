# Testing Documentation

## Current Testing Setup

### Manual Testing Environment
1. Test Client
   ```
   URL: http://localhost:8081
   Purpose: Simulate OAuth client application
   Features:
   - OAuth authorization flow
   - Token exchange
   - User info retrieval
   - IB API test call
   ```

2. OAuth Server
   ```
   URL: http://localhost:3001
   Endpoints:
   - GET /authorize
   - POST /token
   - GET /userinfo
   ```

### Test Flow Steps

1. Authorization Flow
   ```
   ✅ Click "Login with IntelligenceBank"
   ✅ Enter platform URL
   ✅ Redirect to IB login
   🔄 Handle login completion
   ```

2. Token Exchange
   ```
   🔄 Receive authorization code
   🔄 Exchange for tokens
   🔄 Verify token format
   ```

3. User Info
   ```
   ❌ Send access token
   ❌ Receive user info
   ❌ Verify claims
   ```

### Test Cases Needed

1. Authorization Endpoint
   ```
   - Missing platform URL -> Show form
   - Invalid platform URL -> Show error
   - Valid platform URL -> Start IB login
   - Invalid OAuth params -> Show error
   ```

2. Token Endpoint
   ```
   - Valid code -> Return tokens
   - Invalid code -> Error
   - Missing params -> Error
   - Expired code -> Error
   ```

3. UserInfo Endpoint
   ```
   - Valid token -> Return claims
   - Invalid token -> Error
   - Expired token -> Error
   ```

4. Error Cases
   ```
   - Network errors
   - IB API errors
   - Timeout errors
   - Validation errors
   ```

### Required Test Coverage

1. OAuth Flow
   ```
   - Complete authorization flow
   - Token exchange flow
   - User info retrieval
   - Error handling
   ```

2. IB Integration
   ```
   - GET /v1/auth/app/token - Initial token
   - /auth/?login=0&token={content} - Browser login
   - GET /v1/auth/app/info?token={content} - Session polling
   - State preservation through flow
   ```

3. Token Handling
   ```
   - Token generation
   - Token validation
   - Token refresh
   - Token storage
   ```

4. Security
   ```
   - Parameter validation
   - Token encryption
   - Error handling
   - Rate limiting
   ```

### Test Environment Setup

1. Local Development
   ```bash
   # Start test client
   cd tests && node server.js
   
   # Start OAuth server
   cd src && node dev-server.js
   ```

2. Required Test Data
   ```
   - Valid platform URL
   - Test client credentials
   - Test user account
   ```

### Current Test Status

1. Completed Tests
   ```
   ✅ Basic server setup
   ✅ Platform URL form
   ✅ IB login redirect
   ```

2. In Progress
   ```
   🔄 Token exchange
   🔄 Session polling
   🔄 Error handling
   ```

3. Pending Tests
   ```
   ❌ Token validation
   ❌ User info endpoint
   ❌ Security features
   ```

### Next Steps

1. Immediate
   ```
   - Test GET /v1/auth/app/token response
   - Test /auth/ redirect with token
   - Test GET /v1/auth/app/info polling
   - Verify state preservation
   ```

2. Short Term
   ```
   - Add automated tests
   - Add token validation tests
   - Test user info endpoint
   ```

3. Long Term
   ```
   - Add security tests
   - Add performance tests
   - Add integration tests
   ```

### Test Environment Notes

1. Server Requirements
   ```
   - Node.js 20.x
   - Available ports: 3001, 8081
   - Network access to IB
   ```

2. Test Data Management
   ```
   - Use in-memory storage
   - Reset between tests
   - Mock IB responses when needed
   ```

3. Known Issues
   ```
   - Server startup coordination
   - Port conflicts
   - Token persistence