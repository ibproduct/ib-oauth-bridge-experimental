# OAuth Flow Implementation

## Overview
The OAuth flow is implemented using AWS Lambda functions behind API Gateway, with state management in DynamoDB. The flow supports IntelligenceBank's authentication while maintaining OAuth 2.0 standards.

## Components

### 1. Authorize Handler (`/authorize`)
- **Purpose**: Initiates OAuth flow and handles IB login
- **Implementation**: Lambda function with embedded HTML form
- **Flow**:
  1. Validates OAuth parameters
  2. Displays platform URL form
  3. Initiates IB login in iframe
  4. Polls for login completion
  5. Redirects to client's callback URL with auth code

### 2. Token Handler (`/token`)
- **Purpose**: Exchanges auth code for tokens
- **Implementation**: Lambda function
- **Flow**:
  1. Validates token request
  2. Retrieves session info using auth code
  3. Generates OAuth tokens
  4. Returns tokens with IB session info

### 3. State Management
- **Storage**: DynamoDB state table (`ib-oauth-state-${stage}`)
- **States**:
  1. Polling state (state = polling token)
     - Stores IB initial token
     - Used during login process
     - TTL: 5 minutes
  2. Session state (state = auth code)
     - Stores IB session info
     - Used during token exchange
     - TTL: 10 minutes
- **Schema**:
  ```typescript
  {
    state: string,        // Either polling token or auth code
    clientId: string,     // OAuth client ID
    redirectUri: string,  // Client's callback URL
    scope: string,       // OAuth scope
    ibToken: {           // IB session info
      sid: string,
      content: {         // Complete session info from IB
        session: {
          sid: string,
          userUuid: string,
          loginTime: number
        },
        info: {
          clientid: string,
          apiV3url: string,
          firstname: string,
          lastname: string,
          useruuid: string,
          email?: string
        }
      }
    },
    platformUrl: string, // IB platform URL
    oauthState?: string, // Original OAuth state
    codeChallenge?: string, // PKCE code challenge
    codeChallengeMethod?: string, // PKCE challenge method
    expires: number      // TTL timestamp
  }
  ```

## API Gateway Configuration
- Base URL: `https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev`
- Endpoints:
  - `/authorize`: OAuth authorization endpoint
  - `/authorize/poll`: Login status polling endpoint
  - `/token`: Token exchange endpoint
  - `/userinfo`: OpenID Connect userinfo endpoint

## Flow Details

### 1. Authorization Flow
```
Client -> Generate PKCE parameters
  -> Store code_verifier
  -> Calculate code_challenge
  -> /authorize with code_challenge
    -> Display platform URL form
    -> User enters platform URL
    -> Initialize IB login (iframe)
    -> Poll /authorize/poll
    -> On success, redirect to client's callback URL
```

### 2. Token Exchange Flow
```
Client -> /token
  -> Include code_verifier
  -> Validate auth code and PKCE
  -> Get session info from state
  -> Generate OAuth tokens
  -> Return tokens + IB session info
```

### 3. State Management
```
1. During login:
   pollToken -> { ibToken, clientId, redirectUri, etc. }

2. After login success:
   authCode -> { sid, apiV3url, clientid, etc. }
```

### 4. Userinfo Flow
```
Client -> /userinfo with Bearer token
  -> Validate access token
  -> Get session info from token entry
  -> Return user profile from stored session info
```

Note: The userinfo endpoint uses the session information stored during the authorization flow,
avoiding the need for additional API calls to IntelligenceBank.

## Security Considerations
- CORS headers for API Gateway
- State parameter for CSRF protection
- PKCE for enhanced authorization security
- TTL for state entries
- HTTPS for all endpoints
- Input validation using Zod

## Error Handling
- OAuth 2.0 compliant error responses
- Proper error propagation
- Detailed logging for debugging
- Client-friendly error messages

## Testing
Use the test client at https://d3p9mz3wmmolll.cloudfront.net/ to verify:
1. Authorization flow
2. Token exchange
3. Error handling
4. State management