# Current Task: Implement Integrated Proxy and Enhanced Token Management

## Context
The OAuth server needs to be enhanced with an integrated proxy capability for IB API access, along with improved token and session management. The proxy will be implemented as part of our existing OAuth server, leveraging current infrastructure and security measures.

⚠️ IMPORTANT: Review client-integration.md for detailed examples of how clients will interact with the proxy endpoint. This document provides the target client experience we need to support.

## Current Status
- ✅ Basic OAuth flow working
- ✅ Token exchange implemented
- ✅ State management functional
- ✅ Development environment stable
- ❌ Proxy endpoint needed
- ❌ Enhanced token management needed
- ❌ Production environment pending

## Immediate Tasks

### 1. Proxy Handler Implementation
```typescript
// src/handlers/proxy/index.ts
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const token = extractBearerToken(event.headers);
    const tokenEntry = await storageService.getToken(token);
    const path = event.pathParameters?.proxy;
    
    // Validate and refresh if needed
    if (await needsSidRefresh(tokenEntry)) {
      await refreshSid(tokenEntry);
    }

    // Proxy request
    const response = await ibClient.proxyRequest({
      method: event.httpMethod,
      url: `https://${path}`,
      headers: event.headers,
      body: event.body,
      sid: tokenEntry.ibToken.sid
    });

    return {
      statusCode: response.status,
      body: JSON.stringify(response.data),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } catch (error) {
    return handleOAuthError(error);
  }
};
```

### 2. IB Client Enhancement
```typescript
// src/services/ib-client/index.ts
interface ProxyRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  sid: string;
}

export class IBClient {
  async proxyRequest(request: ProxyRequest): Promise<any> {
    return this.client.request({
      method: request.method,
      url: request.url,
      headers: {
        ...request.headers,
        Authorization: `Bearer ${request.sid}`
      },
      data: request.body
    });
  }
}
```

### 3. Token Management Enhancement
```typescript
interface TokenEntry {
  // Existing fields
  accessToken: string;
  refreshToken: string;
  clientId: string;
  scope: string;
  ibToken: {
    sid: string;
    content: {
      apiV3url: string;
      clientid: string
    };
    logintimeoutperiod: number; // Session validity in hours (1-120)
  };
  platformUrl: string;
  
  // New fields
  sidExpiry: number;      // Calculated from logintimeoutperiod
  sidCreatedAt: number;   // When sid was first created
  refreshCount: number;   // Track refresh attempts
}
```

### 4. API Gateway Configuration
- Add new proxy route:
  ```
  /{stage}/proxy/{proxy+}
  Example: /dev/proxy/company.intelligencebank.com/api/3.0.0/12345/users
  ```
- Configure CORS
- Set up request/response mappings
- Add rate limiting

## Implementation Steps

1. Token Enhancement
   - [ ] Update TokenEntry interface
   - [ ] Implement sid expiry calculation
   - [ ] Add refresh tracking
   - [ ] Update token storage service

2. Proxy Implementation
   - [ ] Create proxy handler
   - [ ] Enhance IB client service
   - [ ] Add API Gateway route
   - [ ] Implement error handling

3. Testing
   - [ ] Test proxy with various IB API endpoints
   - [ ] Verify token refresh flow
   - [ ] Test session expiry handling
   - [ ] Validate error responses

4. Documentation
   - [ ] Update API documentation
   - [ ] Create client integration guide
   - [ ] Document error responses
   - [ ] Add usage examples

## Client Integration Example
See client-integration.md for detailed examples of:
- API client setup
- Making API calls
- Error handling
- Token refresh
- Best practices
- Complete client implementation

## Security Considerations
- Token validation on every request
- Session expiry enforcement
- Rate limiting
- CORS configuration
- Error handling
- Audit logging

## Testing Requirements
1. Proxy functionality
   - Different HTTP methods
   - Various IB API endpoints
   - Request/response handling
   - Error scenarios

2. Token management
   - Session timeout handling
   - Refresh flow
   - Error cases
   - Rate limits

3. Integration testing
   - End-to-end flows
   - Error handling
   - Performance testing
   - Load testing

## References
- Architecture Details: architecture.md
- Development Guide: development-workflow.md
- Production Plan: production-deployment.md
- Project Roadmap: projectRoadmap.md
- Client Integration: client-integration.md ⚠️ MUST READ
- Implementation Plan: implementation-plan.md ⚠️ NEW - Detailed steps and tracking

## Notes
- Proxy integrated with existing OAuth server
- Leverages current infrastructure
- Maintains security context
- Simple client integration (see client-integration.md)
- Transparent session management
- See implementation-plan.md for detailed tracking of implementation progress

## Next Steps
1. Begin Phase 1: Token Enhancement
   - Start with TokenEntry interface updates
   - Implement session timeout handling
   - Add refresh tracking logic

2. Review implementation-plan.md for complete timeline and details