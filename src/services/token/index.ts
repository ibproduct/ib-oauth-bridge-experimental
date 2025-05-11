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
  private readonly tokenExpiry: number;
  private readonly refreshTokenExpiry: number;
  private readonly isDevelopment: boolean;

  constructor() {
    this.tokenExpiry = parseInt(process.env.TOKEN_EXPIRY || '3600', 10);
    this.refreshTokenExpiry = parseInt(process.env.REFRESH_TOKEN_EXPIRY || '2592000', 10);
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Generate JWT access token and refresh token
   */
  async generateTokens(claims: Omit<TokenClaims, 'iss' | 'aud' | 'exp' | 'iat'>): Promise<TokenResponse> {
    const now = Math.floor(Date.now() / 1000);
    
    // For development, use a simple token format
    const accessToken = this.isDevelopment 
      ? `dev.${Buffer.from(JSON.stringify({
          ...claims,
          iss: 'dev-issuer',
          aud: 'dev-audience',
          iat: now,
          exp: now + this.tokenExpiry
        })).toString('base64')}`
      : await this.generateJWT();

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
    if (this.isDevelopment && token.startsWith('dev.')) {
      try {
        const payload = JSON.parse(Buffer.from(token.substring(4), 'base64').toString());
        const now = Math.floor(Date.now() / 1000);
        
        if (now >= payload.exp) {
          throw new Error('Token has expired');
        }
        
        return payload;
      } catch (error) {
        throw new Error('Invalid development token');
      }
    }

    throw new Error('Invalid token format');
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

  private async generateJWT(): Promise<string> {
    throw new Error('JWT generation not implemented for development');
  }
}

// Export singleton instance
export const tokenService = new TokenService();