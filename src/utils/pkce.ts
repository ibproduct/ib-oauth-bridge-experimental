import { createHash, randomBytes } from 'crypto';

/**
 * Generates a random code verifier string for PKCE
 * @returns A random code verifier string of 43-128 characters
 */
export function generateCodeVerifier(): string {
  // Generate random bytes (32 bytes = 256 bits provides good security)
  const buffer = randomBytes(32);
  
  // Convert to base64URL format
  // Replace + with -, / with _, and remove =
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates a code challenge from a code verifier using SHA-256
 * @param codeVerifier The code verifier string
 * @returns The code challenge string
 */
export function generateCodeChallenge(codeVerifier: string): string {
  // Create SHA-256 hash of code verifier
  const hash = createHash('sha256')
    .update(codeVerifier)
    .digest();
  
  // Convert to base64URL format
  return hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Validates a code verifier against a code challenge
 * @param codeVerifier The code verifier string from the token request
 * @param codeChallenge The code challenge string from the authorization request
 * @returns True if the code verifier is valid for the challenge
 */
export function validateCodeVerifier(codeVerifier: string, codeChallenge: string): boolean {
  const generatedChallenge = generateCodeChallenge(codeVerifier);
  return generatedChallenge === codeChallenge;
}

/**
 * Validates that a code verifier meets the PKCE requirements
 * @param codeVerifier The code verifier string to validate
 * @returns True if the code verifier is valid
 */
export function isValidCodeVerifier(codeVerifier: string): boolean {
  // Code verifier must be between 43-128 characters
  if (codeVerifier.length < 43 || codeVerifier.length > 128) {
    return false;
  }

  // Must contain only alphanumeric or -._~ characters
  return /^[A-Za-z0-9\-._~]+$/.test(codeVerifier);
}

/**
 * Types for PKCE parameters
 */
export interface PKCEParams {
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface PKCEVerifyParams {
  codeVerifier: string;
}