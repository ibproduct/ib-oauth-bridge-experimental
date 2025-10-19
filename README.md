# IntelligenceBank OAuth 2.0 Bridge

A serverless OAuth 2.0 bridge service that provides standard OAuth authentication for IntelligenceBank's platform, enabling seamless integration with any application.

## Overview

This service enables applications to integrate with IntelligenceBank using standard OAuth 2.0 flows. Key features:

- **No Pre-registration Required**: Works out of the box with any IntelligenceBank platform
- **Self-Service Integration**: Just redirect users to the OAuth server - no setup needed
- **Dynamic Platform Support**: Users can log in to any IntelligenceBank instance
- **Standard OAuth 2.0**: Uses familiar OAuth flows and token management
- **Secure by Default**: Implements best practices like PKCE and secure session handling

## Quick Start

### 1. Initialize OAuth Flow
```javascript
const clientId = 'my-app-' + Math.random().toString(36).substring(2);

const authUrl = 'https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/authorize?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: 'https://your-app.com/callback',
    scope: 'profile',
    state: 'random_state_123'
  });

window.location.href = authUrl;
```

### 2. Handle Callback
```javascript
const code = new URLSearchParams(window.location.search).get('code');
const tokens = await exchangeCode(code);
```

### 3. Make API Requests
```javascript
const response = await fetch(
  'https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/proxy/company.intelligencebank.com/api/3.0.0/clientid/user.limit(100)',
  {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  }
);
```

## Service Endpoints

**Development:**
- Base URL: `https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/`

**Production:**
- Base URL: `https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/main/`

**Available Endpoints:**
- `/authorize` - OAuth authorization endpoint
- `/token` - Token exchange endpoint
- `/userinfo` - OpenID Connect userinfo endpoint
- `/proxy/{api-path}` - IB API proxy endpoint

## Documentation

Complete guides for integration and development:

### Integration Documentation
- **[API Documentation](docs/api-documentation.md)** - Complete API reference with endpoints, parameters, and responses
- **[Client Integration Guide](docs/client-integration.md)** - Step-by-step integration examples and best practices
- **[OAuth Flow Mapping](docs/oauth-flow-mapping.md)** - Detailed OAuth flow implementation and state management

### Development Documentation
- **[Development Workflow](docs/development-workflow.md)** - Build, deployment, testing, and production procedures
- **[Architecture](docs/architecture.md)** - System architecture, components, and design decisions
- **[Tech Stack](docs/techStack.md)** - Technologies, frameworks, and dependencies

### Project Management
- **[Project Roadmap](docs/projectRoadmap.md)** - High-level goals, features, and completion criteria
- **[Current Task](docs/currentTask.md)** - Current development status and next steps
- **[Codebase Summary](docs/codebaseSummary.md)** - Project structure and recent changes

## Key Features

### Dynamic Platform Support
Users can authenticate with any IntelligenceBank instance. The service automatically handles platform URL validation and login flow.

### PKCE Support
Implements Proof Key for Code Exchange (PKCE) for enhanced security, especially important for public clients and single-page applications.

### API Proxy
Built-in proxy endpoint simplifies API access - no need to manage IB session tokens directly.

### Session Management
Automatic session refresh and expiry handling with configurable limits and clear error responses.

## Quick Links

- **Test Client**: https://d3p9mz3wmmolll.cloudfront.net
- **Complete Examples**: [examples/](examples/) directory
- **Python SDK**: [examples/python/ib_oauth_client.py](examples/python/ib_oauth_client.py)

## Architecture

This service uses a **single-stack architecture with Lambda aliases**:
- Single CloudFormation stack: `ib-oauth-stack`
- Lambda aliases for environments: `dev` (→ $LATEST) and `main` (→ published versions)
- Shared DynamoDB tables: `ib-oauth-state`, `ib-oauth-tokens`
- API Gateway stages routing to respective aliases

See [Architecture Documentation](docs/architecture.md) for complete details.

## Getting Started with Development

### Prerequisites
- Node.js 20.x
- AWS CLI configured for `us-west-1` region
- AWS CDK

### Setup
```bash
git clone <repository-url>
cd ib-oauth-bridge-experimental
npm install
npm run build
```

### Deploy
```bash
# Deploy to dev (updates $LATEST)
npm run cdk:deploy

# Promote to main (publish version)
npm run publish:main
```

See [Development Workflow](docs/development-workflow.md) for complete deployment procedures.

## Support

- **Issues**: Open an issue in this repository
- **Documentation**: Check the [docs/](docs/) directory
- **Common Issues**: See [Testing Documentation](docs/testing.md#troubleshooting)

## License

[License information]
