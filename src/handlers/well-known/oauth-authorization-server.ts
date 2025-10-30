import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * OAuth 2.0 Authorization Server Metadata Handler
 * 
 * Implements RFC 8414 - OAuth 2.0 Authorization Server Metadata
 * https://datatracker.ietf.org/doc/html/rfc8414
 * 
 * This endpoint enables MCP clients to discover:
 * - Authorization and token endpoints
 * - Supported grant types and PKCE methods
 * - Other OAuth server capabilities
 *
 * Note: This server uses a well-known client configuration approach.
 * Clients should use the documented client_id: "mcp-public-client"
 */

interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  code_challenge_methods_supported: string[];
  grant_types_supported: string[];
  response_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  scopes_supported?: string[];
  response_modes_supported?: string[];
  revocation_endpoint?: string;
  introspection_endpoint?: string;
}

/**
 * Get the base URL from the API Gateway event
 */
function getBaseUrl(event: APIGatewayProxyEvent): string {
  const stage = event.requestContext.stage;
  const apiId = event.requestContext.apiId;
  const region = process.env.AWS_REGION || 'us-west-1';
  
  return `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
}

/**
 * Generate CORS headers
 */
function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

/**
 * Lambda handler for OAuth Authorization Server Metadata endpoint
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('OAuth Authorization Server Metadata request:', {
    path: event.path,
    method: event.httpMethod,
    stage: event.requestContext.stage,
  });

  // Handle OPTIONS for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        error: 'method_not_allowed',
        error_description: 'Only GET requests are allowed',
      }),
    };
  }

  try {
    const baseUrl = getBaseUrl(event);

    // Build OAuth 2.0 Authorization Server Metadata response
    // Compliant with RFC 8414
    const metadata: AuthorizationServerMetadata = {
      // Issuer identifier (REQUIRED)
      issuer: baseUrl,

      // Authorization endpoint (REQUIRED for authorization code flow)
      authorization_endpoint: `${baseUrl}/authorize`,

      // Token endpoint (REQUIRED)
      token_endpoint: `${baseUrl}/token`,

      // PKCE code challenge methods (REQUIRED for MCP)
      // MCP requires S256 support
      code_challenge_methods_supported: ['S256'],

      // Grant types supported (REQUIRED)
      grant_types_supported: [
        'authorization_code',
        'refresh_token',
      ],

      // Response types supported (REQUIRED)
      response_types_supported: ['code'],

      // Token endpoint authentication methods (REQUIRED)
      // 'none' indicates public clients (no client secret)
      token_endpoint_auth_methods_supported: ['none'],

      // Scopes supported (RECOMMENDED)
      scopes_supported: ['profile'],

      // Response modes supported (OPTIONAL)
      response_modes_supported: ['query'],
    };

    console.log('Returning OAuth Authorization Server Metadata:', {
      issuer: metadata.issuer,
      supportsPKCE: metadata.code_challenge_methods_supported.includes('S256'),
    });

    return {
      statusCode: 200,
      headers: {
        ...getCorsHeaders(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: JSON.stringify(metadata, null, 2),
    };
  } catch (error) {
    console.error('Error generating OAuth metadata:', error);

    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Failed to generate authorization server metadata',
      }),
    };
  }
};