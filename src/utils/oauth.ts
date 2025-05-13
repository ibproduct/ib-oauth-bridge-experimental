import { z } from 'zod';

// OAuth 2.0 error response schema
export interface OAuthError {
  error: string;
  error_description?: string;
  state?: string;
}

// OAuth 2.0 standard error types
export const OAuthErrorType = {
  INVALID_REQUEST: 'invalid_request',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  ACCESS_DENIED: 'access_denied',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_SCOPE: 'invalid_scope',
  SERVER_ERROR: 'server_error',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',
  INVALID_TOKEN: 'invalid_token'
} as const;

// Supported response types
export const ResponseType = {
  CODE: 'code'
} as const;

// Supported grant types
export const GrantType = {
  AUTHORIZATION_CODE: 'authorization_code',
  REFRESH_TOKEN: 'refresh_token'
} as const;

// Platform URL validation schema
const PlatformUrlSchema = z.string()
  .url()
  .refine(url => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.endsWith('.intelligencebank.com');
    } catch {
      return false;
    }
  }, {
    message: "Platform URL must be a valid IntelligenceBank domain"
  });

// Base authorization request parameter validation schema
// PKCE code challenge method
export const CodeChallengeMethod = {
  S256: 'S256'
} as const;

// Base authorization request parameter validation schema
export const BaseAuthorizeParamsSchema = z.object({
  response_type: z.literal(ResponseType.CODE),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().min(1),
  state: z.string().optional(),
  // PKCE parameters
  code_challenge: z.string()
    .min(43)
    .max(128)
    .regex(/^[A-Za-z0-9\-._~]+$/),
  code_challenge_method: z.literal(CodeChallengeMethod.S256)
});

// Full authorization request parameter validation schema
export const AuthorizeParamsSchema = BaseAuthorizeParamsSchema.extend({
  platform_url: PlatformUrlSchema.optional()
});

// Token request parameter validation schema
export const TokenParamsSchema = z.object({
  grant_type: z.enum([GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN]),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  client_id: z.string().min(1),
  // PKCE parameter
  code_verifier: z.string()
    .min(43)
    .max(128)
    .regex(/^[A-Za-z0-9\-._~]+$/)
    .optional()
}).refine(data => {
  // Ensure code is present for authorization_code grant
  if (data.grant_type === GrantType.AUTHORIZATION_CODE) {
    return !!data.code && !!data.redirect_uri && !!data.code_verifier;
  }
  // Ensure refresh_token is present for refresh_token grant
  if (data.grant_type === GrantType.REFRESH_TOKEN) {
    return !!data.refresh_token;
  }
  return false;
}, {
  message: "Invalid parameters for grant type"
});

/**
 * Create OAuth error response
 */
export function createOAuthError(
  error: string,
  description?: string,
  state?: string
): OAuthError {
  return {
    error,
    ...(description && { error_description: description }),
    ...(state && { state })
  };
}

/**
 * Validate authorization request parameters
 * @throws {z.ZodError} If validation fails
 */
export function validateAuthorizeParams(params: Record<string, unknown>): z.infer<typeof AuthorizeParamsSchema> {
  // First validate base parameters
  const baseParams = BaseAuthorizeParamsSchema.parse(params);
  
  // If platform_url is present, validate it
  if (params.platform_url) {
    return AuthorizeParamsSchema.parse(params);
  }

  // Return base params if no platform_url
  return baseParams;
}

/**
 * Validate token request parameters
 * @throws {z.ZodError} If validation fails
 */
export function validateTokenParams(params: Record<string, unknown>): z.infer<typeof TokenParamsSchema> {
  return TokenParamsSchema.parse(params);
}

/**
 * Generate OAuth error redirect URI
 */
export function generateErrorRedirect(
  redirectUri: string,
  error: OAuthError
): string {
  const params = new URLSearchParams({
    error: error.error,
    ...(error.error_description && { error_description: error.error_description }),
    ...(error.state && { state: error.state })
  });

  return `${redirectUri}?${params.toString()}`;
}

/**
 * Generate successful authorization redirect URI
 */
export function generateAuthCodeRedirect(
  redirectUri: string,
  code: string,
  state?: string
): string {
  const params = new URLSearchParams({
    code,
    ...(state && { state })
  });

  return `${redirectUri}?${params.toString()}`;
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(headers: Record<string, string | undefined>): string | undefined {
  const authHeader = headers.Authorization || headers.authorization;
  if (!authHeader) return undefined;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return undefined;
  }

  return parts[1];
}