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
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable'
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

// Authorization request parameter validation schema
export const AuthorizeParamsSchema = z.object({
  response_type: z.literal(ResponseType.CODE),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().min(1),
  state: z.string().optional()
});

// Token request parameter validation schema
export const TokenParamsSchema = z.object({
  grant_type: z.enum([GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN]),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  client_id: z.string().min(1)
}).refine(data => {
  // Ensure code is present for authorization_code grant
  if (data.grant_type === GrantType.AUTHORIZATION_CODE) {
    return !!data.code && !!data.redirect_uri;
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
  return AuthorizeParamsSchema.parse(params);
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