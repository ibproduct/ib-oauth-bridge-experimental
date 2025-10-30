/**
 * Well-Known Client Configuration
 * 
 * This module defines pre-configured OAuth clients that can be used without
 * Dynamic Client Registration. This approach is recommended by the MCP
 * specification for authorization servers that don't support DCR.
 * 
 * MCP clients should use the documented client_id: "mcp-public-client"
 */

export interface WellKnownClient {
  client_id: string;
  client_type: 'public' | 'confidential';
  allowed_redirect_patterns: RegExp[];
  grant_types: string[];
  response_types: string[];
  requires_pkce: boolean;
  token_endpoint_auth_method: string;
  description?: string;
}

/**
 * Well-known OAuth clients configuration
 * 
 * These clients are pre-configured and don't require registration.
 * MCP clients should use "mcp-public-client" for zero-configuration integration.
 */
export const WELL_KNOWN_CLIENTS: Record<string, WellKnownClient> = {
  'mcp-public-client': {
    client_id: 'mcp-public-client',
    client_type: 'public',
    description: 'Public client for MCP (Model Context Protocol) integrations',
    
    // Allowed redirect URI patterns
    // These patterns are validated using regex for security
    allowed_redirect_patterns: [
      // Production MCP servers on connectingib.com domain
      /^https:\/\/.*\.connectingib\.com\/callback$/,
      
      // Specific MCP endpoint
      /^https:\/\/mcp\.connectingib\.com\/callback$/,
      
      // Claude Desktop callback URLs (official MCP client)
      /^https:\/\/claude\.ai\/api\/mcp\/auth_callback$/,
      /^https:\/\/claude\.com\/api\/mcp\/auth_callback$/,
      
      // Local development - standard callback (any port)
      /^http:\/\/localhost:\d+\/callback$/,
      /^http:\/\/127\.0\.0\.1:\d+\/callback$/,
      
      // MCP Inspector patterns (official testing tool)
      /^http:\/\/localhost:\d+\/oauth\/callback$/,
      /^http:\/\/localhost:\d+\/oauth\/callback\/debug$/,
      /^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback$/,
      /^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback\/debug$/,
    ],
    
    // OAuth grant types supported
    grant_types: ['authorization_code', 'refresh_token'],
    
    // OAuth response types supported
    response_types: ['code'],
    
    // PKCE is required for public clients (OAuth 2.1 best practice)
    requires_pkce: true,
    
    // Public clients don't use client_secret
    token_endpoint_auth_method: 'none',
  },
};

/**
 * Get a well-known client configuration by client_id
 * 
 * @param clientId - The client identifier
 * @returns The client configuration or null if not found
 */
export function getWellKnownClient(clientId: string): WellKnownClient | null {
  return WELL_KNOWN_CLIENTS[clientId] || null;
}

/**
 * Validate that a redirect URI matches one of the client's allowed patterns
 * 
 * @param clientId - The client identifier
 * @param redirectUri - The redirect URI to validate
 * @returns true if the redirect URI is allowed, false otherwise
 */
export function validateRedirectUri(
  clientId: string,
  redirectUri: string
): boolean {
  const client = getWellKnownClient(clientId);
  if (!client) {
    return false;
  }

  // Test the redirect URI against all allowed patterns
  return client.allowed_redirect_patterns.some(pattern => 
    pattern.test(redirectUri)
  );
}

/**
 * Check if a client_id is a well-known client
 * 
 * @param clientId - The client identifier to check
 * @returns true if the client_id is well-known, false otherwise
 */
export function isWellKnownClient(clientId: string): boolean {
  return clientId in WELL_KNOWN_CLIENTS;
}

/**
 * Get all well-known client IDs
 * 
 * @returns Array of well-known client identifiers
 */
export function getWellKnownClientIds(): string[] {
  return Object.keys(WELL_KNOWN_CLIENTS);
}