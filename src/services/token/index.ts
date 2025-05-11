import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';

export interface TokenClaims {
  sub: string;          // Subject (user ID)
  iss: string;          // Issuer
  aud: string;          // Audience
  exp: number;          // Expiration time
  iat: number;          // Issued at
  scope?: string;       // OAuth scopes
  email?: string;       // User email
  name?: string;        // User name
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
}

export class TokenService {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly tokenExpiry: number;
  private readonly refreshTokenExpiry: number;

  constructor() {
    // Load configuration from environment variables
    this.privateKey = process.env.JWT_PRIVATE_KEY || '';
    this.publicKey = process.env.JWT_PUBLIC_KEY || '';
    this.issuer = process.env.OAUTH_ISSUER || '';
    this.audience = process.env.OAUTH_AUDIENCE || '';
    this.tokenExpiry = parseInt(process.env.TOKEN_EXPIRY || '3600', 10);
    this.refreshTokenExpiry = parseInt(process.env.REFRESH_TOKEN_EXPIRY || '2592000', 10);

    if (!this.privateKey || !this.publicKey || !this.issuer || !this.audience) {
      throw new Error('Missing required environment variables for token service');
    }
  }

  /**
   * Generate JWT access token and refresh token
   */
  async generateTokens(claims: Omit<TokenClaims, 'iss' | 'aud' | 'exp' | 'iat'>): Promise<TokenResponse> {
    const now = Math.floor(Date.now() / 1000);
    
    // Create access token
    const accessToken = await new SignJWT({
      ...claims,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp: now + this.tokenExpiry
    })
      .setProtectedHeader({ alg: 'RS256' })
      .sign(Buffer.from(this.privateKey, 'base64'));

    // Generate refresh token (cryptographically secure random string)
    const refreshToken = randomUUID();

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.tokenExpiry,
      refresh_token: refreshToken
    };
  }

  /**
   * Validate JWT access token
   */
  async validateToken(token: string): Promise<TokenClaims> {
    try {
      const { payload } = await jwtVerify(
        token,
        Buffer.from(this.publicKey, 'base64'),
        {
          issuer: this.issuer,
          audience: this.audience
        }
      );

      return payload as TokenClaims;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Token validation failed: ${error.message}`);
      }
      throw new Error('Token validation failed');
    }
  }

  /**
   * Generate new tokens using refresh token
   */
  async refreshTokens(refreshToken: string, originalClaims: Omit<TokenClaims, 'iss' | 'aud' | 'exp' | 'iat'>): Promise<TokenResponse> {
    // Note: Validation of refresh token against storage should be done by the caller
    return this.generateTokens(originalClaims);
  }

  /**
   * Get token expiry times
   */
  getExpiryTimes(): { accessTokenExpiry: number; refreshTokenExpiry: number } {
    return {
      accessTokenExpiry: this.tokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry
    };
  }
}