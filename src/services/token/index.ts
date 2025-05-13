import { randomUUID } from 'crypto';
import { TokenEntry } from '../storage';

export interface TokenClaims {
  sub: string;          // Subject (user ID)
  iss: string;          // Issuer
  aud: string;          // Audience
  exp: number;          // Expiration time
  iat: number;          // Issued at
  scope?: string;       // OAuth scopes
  email?: string;       // User email
  name?: string;        // User name
  sid?: string;         // IB Session ID
  sidExp?: number;      // Session expiry time
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
  private readonly maxRefreshCount: number;

  constructor() {
    this.tokenExpiry = parseInt(process.env.TOKEN_EXPIRY || '3600', 10);
    this.refreshTokenExpiry = parseInt(process.env.REFRESH_TOKEN_EXPIRY || '2592000', 10);
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.maxRefreshCount = parseInt(process.env.MAX_REFRESH_COUNT || '1000', 10);
  }

  /**
   * Check if session needs refresh based on expiry and refresh count
   */
  async needsSessionRefresh(tokenEntry: TokenEntry): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    
    // Check if session is expired
    if (now >= tokenEntry.sidExpiry) {
      return true;
    }

    // Check if we're approaching expiry (within 5 minutes)
    if (tokenEntry.sidExpiry - now < 300) {
      return true;
    }

    return false;
  }

  /**
   * Validate session refresh attempt
   */
  async validateRefreshAttempt(tokenEntry: TokenEntry): Promise<void> {
    // Check refresh count limit
    if (tokenEntry.refreshCount >= this.maxRefreshCount) {
      throw new Error('Maximum refresh attempts exceeded');
    }

    const now = Math.floor(Date.now() / 1000);
    
    // Check absolute session timeout
    const sessionAge = now - tokenEntry.sidCreatedAt;
    const maxSessionAge = (tokenEntry.ibToken.logintimeoutperiod || 24) * 3600;
    
    if (sessionAge >= maxSessionAge) {
      throw new Error('Session maximum age exceeded');
    }
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
  async refreshTokens(
    refreshToken: string,
    originalClaims: Omit<TokenClaims, 'iss' | 'aud' | 'exp' | 'iat'>,
    tokenEntry: TokenEntry
  ): Promise<TokenResponse> {
    // Validate refresh attempt
    await this.validateRefreshAttempt(tokenEntry);

    // Generate new tokens with updated session info
    return this.generateTokens({
      ...originalClaims,
      sid: tokenEntry.ibToken.sid,
      sidExp: tokenEntry.sidExpiry
    });
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