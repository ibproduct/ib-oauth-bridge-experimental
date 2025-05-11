# OAuth Flow Mapping

## Current Implementation

### 1. Authorization Flow
```
GET /authorize
  ├── No platform_url → Show platform URL form
  └── With platform_url → Start IB Browser Login
      ├── Step 1: GET /v1/auth/app/token - Get initial token ✅
      ├── Step 2: Redirect to /auth/?login=0&token={content} ✅
      └── Step 3: GET /v1/auth/app/info?token={content} - Poll session status ✅
```

### 2. Token Exchange
```
POST /token
  ├── Validate code & state
  ├── Validate code & state ✅
  ├── Return stored session info ✅
  └── Generate OAuth tokens
      ├── Access token: dev.{base64(user-info)} ✅
      └── Refresh token: UUID v4 ✅
```

### 3. Token Service (Not Started ❌)
```
- JWT token generation
- Token validation
- Refresh token handling
```

### 4. UserInfo Endpoint (Not Started ❌)
```
GET /userinfo
  ├── Validate access token
  ├── Extract user info
  └── Return OAuth claims
```

## Flow Details

### Authorization Flow
1. Client requests `/authorize` ✅
   ```
   GET /authorize?
     response_type=code
     &client_id=test-client
     &redirect_uri=http://localhost:8081/callback
     &scope=profile
     &state=random
   ```

2. Server shows platform URL form if needed ✅
   ```html
   <form>
     <input type="url" name="platform_url" required>
     <!-- Hidden OAuth params -->
   </form>
   ```

3. Server starts IB Browser Login ✅
   - GET /v1/auth/app/token to get initial token
   - Store token and platform URL
   - Redirect to /auth/?login=0&token={content}

4. After IB login ✅
   - Poll GET /v1/auth/app/info?token={content}
   - When session is ready, generate authorization code
   - Redirect to client callback with code and original state

### Token Exchange
1. Client requests tokens 🔄
   ```
   POST /token
   {
     grant_type: "authorization_code",
     code: "auth_code",
     redirect_uri: "callback_url",
     client_id: "client_id"
   }
   ```

2. Server validates and exchanges code ✅
   - Validate request parameters
   - Check authorization code
   - Generate JWT tokens
   - Return token response

### Token Response
```json
{
  "access_token": "dev.{base64-encoded-jwt}",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "uuid-v4",
  "platform_url": "https://company.intelligencebank.com",
  "client_id": "client-id",
  "sid": "session-id"  // Important: This is the IB session ID needed for API calls
}
```

### Session ID Handling
- The `sid` from successful IB login response is used for API calls
- Must be passed in lowercase `sid` header when making IB API calls
- Different from the initial SID received in Step 1 of Browser Login

## Next Steps
1. ✅ Complete polling implementation
2. ✅ Add basic token generation
3. ✅ Add refresh token handling
4. 🔄 Implement proper JWT token validation
5. ❌ Build userinfo endpoint
6. 🔄 Add proper error handling
7. ❌ Deploy to production server
8. ❌ Implement database storage

## Security Considerations
1. 🔄 Need proper token encryption
2. ❌ Need secure database storage
3. 🔄 Need proper error handling
4. ❌ Need rate limiting
5. ✅ Basic request validation implemented
6. ❌ Need proper CORS configuration
7. ❌ Need SSL/TLS configuration