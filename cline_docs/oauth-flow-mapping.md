# OAuth 2.0 Flow Mapping

## Overview
This document explains how the IntelligenceBank Browser Login API flow is mapped to a standard OAuth 2.0 Authorization Code flow.

## Flow Comparison

### Standard OAuth 2.0 Flow
1. Client requests authorization
2. User authenticates and authorizes
3. Authorization code returned
4. Client exchanges code for tokens
5. Access token used for API access

### IB Browser Login Flow
1. Get initial token
2. Redirect to browser login
3. Exchange token for session info

## Implementation Details

### 1. Authorization Endpoint (/authorize)
```typescript
async function handleAuthorize(req: AuthorizeRequest): Promise<AuthorizeResponse> {
  // 1. Validate OAuth parameters
  validateOAuthParams(req.client_id, req.redirect_uri, req.scope);

  // 2. Generate OAuth state if not provided
  const state = req.state || generateState();

  // 3. Call IB Step 1 to get token
  const ibResponse = await ibClient.getToken();
  const { SID, content: ibToken } = ibResponse;

  // 4. Store mapping in DynamoDB
  await storeAuthState({
    state,
    ibToken,
    sid: SID,
    clientId: req.client_id,
    redirectUri: req.redirect_uri,
    scope: req.scope,
    codeChallenge: req.code_challenge,
    codeChallengeMethod: req.code_challenge_method
  });

  // 5. Construct IB login URL
  const loginUrl = constructIBLoginUrl(ibToken);

  // 6. Redirect to IB login
  return {
    redirectUrl: loginUrl,
    state
  };
}
```

### 2. IB Login Callback Handler (/callback)
```typescript
async function handleCallback(req: CallbackRequest): Promise<CallbackResponse> {
  // 1. Extract IB token from callback
  const { token: ibToken } = req.query;

  // 2. Retrieve stored state from DynamoDB
  const authState = await getAuthState(ibToken);

  // 3. Call IB Step 3 to get session info
  const sessionInfo = await ibClient.getSessionInfo(ibToken);

  // 4. Generate OAuth authorization code
  const code = generateAuthCode();

  // 5. Store code mapping in DynamoDB
  await storeAuthCode({
    code,
    ibToken,
    sessionInfo,
    clientId: authState.clientId,
    scope: authState.scope
  });

  // 6. Redirect to client with code
  return redirectToClient(authState.redirectUri, {
    code,
    state: authState.state
  });
}
```

### 3. Token Endpoint (/token)
```typescript
async function handleToken(req: TokenRequest): Promise<TokenResponse> {
  // 1. Validate OAuth parameters
  validateTokenRequest(req);

  // 2. Retrieve stored code data
  const codeData = await getAuthCode(req.code);

  // 3. Validate client credentials
  validateClient(req.client_id, req.client_secret);

  // 4. Generate OAuth tokens
  const accessToken = generateAccessToken({
    sub: codeData.sessionInfo.session.userUuid,
    scope: codeData.scope
  });

  const refreshToken = generateRefreshToken();

  // 5. Store token mapping in DynamoDB
  await storeTokens({
    accessToken,
    refreshToken,
    ibToken: codeData.ibToken,
    sessionInfo: codeData.sessionInfo
  });

  // 6. Return OAuth tokens
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 3600
  };
}
```

## State Management

### DynamoDB Schema

#### Auth State Table
```typescript
interface AuthState {
  state: string;          // OAuth state parameter
  ibToken: string;        // IB token from Step 1
  sid: string;           // IB session ID
  clientId: string;      // OAuth client ID
  redirectUri: string;   // OAuth redirect URI
  scope: string;         // OAuth requested scope
  codeChallenge?: string; // PKCE code challenge
  expires: number;       // TTL for cleanup
}
```

#### Auth Code Table
```typescript
interface AuthCode {
  code: string;          // OAuth authorization code
  ibToken: string;       // IB token
  sessionInfo: object;   // IB session information
  clientId: string;      // OAuth client ID
  scope: string;         // OAuth scope
  expires: number;       // TTL for cleanup
}
```

#### Token Table
```typescript
interface TokenMapping {
  accessToken: string;   // OAuth access token
  refreshToken: string;  // OAuth refresh token
  ibToken: string;       // IB token
  sessionInfo: object;   // IB session information
  expires: number;       // TTL for cleanup
}
```

## Session Management

### Token Refresh Flow
```typescript
async function handleRefresh(req: RefreshRequest): Promise<TokenResponse> {
  // 1. Validate refresh token
  const tokenMapping = await getTokenMapping(req.refresh_token);

  // 2. Check IB session validity
  const sessionValid = await validateIBSession(tokenMapping.ibToken);

  if (!sessionValid) {
    // 3a. If IB session expired, require new login
    throw new OAuthError('invalid_grant');
  }

  // 3b. Generate new OAuth tokens
  const newAccessToken = generateAccessToken({
    sub: tokenMapping.sessionInfo.session.userUuid,
    scope: tokenMapping.scope
  });

  const newRefreshToken = generateRefreshToken();

  // 4. Update token mapping
  await updateTokenMapping({
    oldRefreshToken: req.refresh_token,
    newAccessToken,
    newRefreshToken
  });

  // 5. Return new tokens
  return {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    token_type: 'Bearer',
    expires_in: 3600
  };
}
```

## Error Handling

### OAuth Error Mapping
```typescript
const IB_TO_OAUTH_ERRORS = {
  'token_expired': 'invalid_grant',
  'invalid_token': 'invalid_grant',
  'session_expired': 'invalid_grant',
  'unauthorized': 'unauthorized_client',
  'rate_limited': 'temporarily_unavailable'
};

function mapIBErrorToOAuth(ibError: IBError): OAuthError {
  const oauthCode = IB_TO_OAUTH_ERRORS[ibError.code] || 'server_error';
  return new OAuthError(oauthCode);
}
```

## Security Considerations

### Token Security
1. All tokens (IB and OAuth) are encrypted at rest
2. Access tokens have short lifetimes (1 hour)
3. Refresh tokens are single-use
4. PKCE support for public clients

### Session Validation
1. Regular IB session checks
2. Automatic token revocation on session expiry
3. Concurrent session handling

### Rate Limiting
1. Per-client limits
2. Global API limits
3. Automatic throttling

## Monitoring

### Key Metrics
1. Token conversion success rate
2. Session validity duration
3. Refresh token usage
4. Error rates by type

### Alerts
1. High token failure rate
2. Session validation issues
3. Database operation errors
4. Rate limit breaches