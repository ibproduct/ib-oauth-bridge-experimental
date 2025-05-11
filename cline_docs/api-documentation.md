# API Documentation

## Overview
This document describes the OAuth 2.0 bridge service API endpoints for IntelligenceBank authentication.

## Base URL
```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
```

## Endpoints

### Authorization Endpoint
Initiates the OAuth 2.0 authorization flow by redirecting the user to the IntelligenceBank login page.

```
GET /authorize
```

#### Query Parameters
| Parameter     | Required | Description                                     |
|--------------|----------|-------------------------------------------------|
| response_type| Yes      | Must be "code"                                  |
| client_id    | Yes      | OAuth client identifier                         |
| redirect_uri | Yes      | OAuth callback URL                              |
| scope        | Yes      | Requested scope                                 |
| state        | No       | Client state parameter                          |

#### Success Response
- **Status Code**: 302 Found
- **Headers**:
  ```
  Location: https://{ib-platform}/auth/login?token={ib-token}&redirect_uri={redirect_uri}&state={state}
  ```

#### Error Responses

1. Invalid Parameters
- **Status Code**: 302 Found
- **Headers**:
  ```
  Location: {redirect_uri}?error=invalid_request&error_description=Invalid request parameters&state={state}
  ```

2. Server Error
- **Status Code**: 302 Found
- **Headers**:
  ```
  Location: {redirect_uri}?error=server_error&error_description=Failed to process authorization request&state={state}
  ```

3. Invalid Request (without redirect_uri)
- **Status Code**: 400 Bad Request
- **Body**:
  ```json
  {
    "error": "invalid_request",
    "error_description": "Invalid request parameters"
  }
  ```

#### Example Request
```
GET /authorize?response_type=code
              &client_id=example-client
              &redirect_uri=https://client.example.com/callback
              &scope=profile
              &state=xyz123
```

#### Implementation Details
- Validates all OAuth parameters using zod schemas
- Generates a secure state parameter if not provided
- Retrieves initial token from IntelligenceBank API
- Stores state mapping in DynamoDB with 10-minute TTL
- Redirects to IntelligenceBank login page with required parameters

#### Security Considerations
- All requests must use HTTPS
- State parameter is required for CSRF protection
- DynamoDB entries have TTL for automatic cleanup
- Request parameters are strictly validated
- Error responses maintain OAuth 2.0 spec compliance

### Token Endpoint
(To be implemented)

### UserInfo Endpoint
(To be implemented)