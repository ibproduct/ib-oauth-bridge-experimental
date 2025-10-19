# Current Task: OAuth Flow Fix for Third-Party Integration

## Context
The OAuth bridge had two critical issues preventing third-party integration:
1. Returning JSON instead of HTML form when `platform_url` was in the URL
2. Polling endpoint path matching failing due to stage prefix

## Problems Identified

### Problem 1: JSON Response Instead of HTML Form
When accessing:
```
GET /authorize?client_id=xyz&platform_url=https://facu.intelligencebank.com&...
```
The server returned JSON: `{"loginUrl": "...", "token": "..."}` instead of the HTML form.

**Root Cause:** The authorize handler was checking for `platform_url` in query parameters and immediately calling `handleStartLogin()` (which returns JSON), without distinguishing between:
1. Initial OAuth authorization request (browser navigation) → needs HTML form
2. Form submission (JavaScript fetch) → needs JSON response

### Problem 2: Polling Endpoint 404 Errors
The polling endpoint was returning 404 errors because the path check was too strict.

**Root Cause:** API Gateway includes the stage prefix in `event.path` (e.g., `/dev/authorize/poll`), but the handler was only checking for exact match `/authorize/poll`.

## Solution Implemented

### Changes Made to `src/handlers/authorize/index.ts`

1. **Request Type Detection** (lines 368-372)
   - Added `Accept` header check to distinguish between browser navigation and fetch requests
   - Browser: `Accept: text/html` → Show HTML form
   - JavaScript fetch: `Accept: application/json` → Return JSON

2. **Platform URL Pre-population** (lines 177-189)
   - Added `value="{{platform_url}}"` attribute to input field
   - Allows pre-populating when client provides platform_url in URL

3. **Form Submission Enhancement** (lines 257-260)
   - Updated fetch call to include `Accept: application/json` header
   - Ensures server recognizes form submission vs initial request

4. **Template Variable Replacement** (lines 431-443)
   - Updated template replacement logic to include `platform_url`
   - Supports both pre-populated and empty field scenarios

5. **Polling Endpoint Path Fix** (line 362)
   - Changed from exact match `event.path === '/authorize/poll'`
   - To suffix match `event.path.endsWith('/authorize/poll')`
   - Handles both `/authorize/poll` and `/dev/authorize/poll` or `/main/authorize/poll`

## Supported Flows

### Flow A: Client Provides platform_url (Pre-populated)
```
GET /authorize?client_id=xyz&platform_url=https://facu.intelligencebank.com&...
→ Shows HTML form with platform_url pre-populated
→ User clicks "Continue to Login"
→ Form submits with Accept: application/json
→ Returns JSON with loginUrl and token
```

### Flow B: Client Doesn't Provide platform_url (Manual Entry)
```
GET /authorize?client_id=xyz&...
→ Shows HTML form with empty platform_url field
→ User enters IB platform URL
→ User clicks "Continue to Login"
→ Form submits with Accept: application/json
→ Returns JSON with loginUrl and token
```

## Deployment Status
✅ Changes built and deployed to dev environment (2025-10-19 02:18 PM)
- Dev Endpoint: `https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/`

## Next Steps
- 🔄 Test the complete OAuth flow with MCP server integration
- 📋 Verify both pre-populated and manual entry flows work correctly
- 📝 Update API documentation to reflect dual-mode flow support
- 🚀 Promote to production if testing is successful

## Quick Reference

### Current Architecture
- **Stack**: `ib-oauth-stack` (single stack, no suffix)
- **Region**: `us-west-1`
- **API ID**: `66qz7xd2w8`
- **Dev Endpoint**: `https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/`
- **Main Endpoint**: `https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/main/`

### Key Documentation
- [Development Workflow](./development-workflow.md) - All deployment, testing, and production procedures
- [Architecture](./architecture.md) - System design and components
- [API Documentation](./api-documentation.md) - Endpoint specifications