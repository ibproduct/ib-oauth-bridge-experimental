import { IBAuthResponse } from '../ib-client';

export interface StateEntry {
  key: string;  // Used as lookup key (can be pollToken or code)
  clientId: string;
  redirectUri: string;
  scope: string;
  ibToken: IBAuthResponse;
  platformUrl: string;
  oauthState?: string; // Original OAuth state parameter
  createdAt: number;
  expiresAt: number;
}

interface TokenEntry {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  scope: string;
  ibToken: IBAuthResponse;
  platformUrl: string;
  createdAt: number;
  expiresAt: number;
}

export class MemoryStorageService {
  private states: Map<string, StateEntry> = new Map();
  private tokens: Map<string, TokenEntry> = new Map();
  private refreshTokens: Map<string, string> = new Map(); // refreshToken -> accessToken
  private readonly STATE_TTL_SECONDS = 600; // 10 minutes
  private readonly TOKEN_TTL_SECONDS = 3600; // 1 hour

  /**
   * Store OAuth state and associated data
   */
  async storeState(
    clientId: string,
    redirectUri: string,
    scope: string,
    ibToken: IBAuthResponse,
    platformUrl: string,
    pollToken?: string,
    oauthState?: string
  ): Promise<string> {
    const key = pollToken || Math.random().toString(36).substring(2, 15);
    const now = Math.floor(Date.now() / 1000);

    const entry: StateEntry = {
      key,
      clientId,
      redirectUri,
      scope,
      ibToken,
      platformUrl,
      oauthState, // Store original OAuth state
      createdAt: now,
      expiresAt: now + this.STATE_TTL_SECONDS
    };

    this.states.set(key, entry);
    return key;
  }

  /**
   * Retrieve and validate state entry
   */
  async getState(key: string): Promise<StateEntry> {
    const entry = this.states.get(key);
    if (!entry) {
      throw new Error('Invalid state parameter');
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= entry.expiresAt) {
      await this.deleteState(key);
      throw new Error('State parameter has expired');
    }

    return entry;
  }

  /**
   * Delete state entry
   */
  async deleteState(key: string): Promise<void> {
    this.states.delete(key);
  }

  /**
   * Get all state entries
   */
  async getAllStates(): Promise<Map<string, StateEntry>> {
    return this.states;
  }

  /**
   * Store token information
   */
  async storeToken(
    accessToken: string,
    refreshToken: string,
    clientId: string,
    scope: string,
    ibToken: IBAuthResponse,
    platformUrl: string
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const entry: TokenEntry = {
      accessToken,
      refreshToken,
      clientId,
      scope,
      ibToken,
      platformUrl,
      createdAt: now,
      expiresAt: now + this.TOKEN_TTL_SECONDS
    };

    this.tokens.set(accessToken, entry);
    this.refreshTokens.set(refreshToken, accessToken);
  }

  /**
   * Get token information by access token
   */
  async getToken(accessToken: string): Promise<TokenEntry> {
    const entry = this.tokens.get(accessToken);
    if (!entry) {
      throw new Error('Invalid access token');
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= entry.expiresAt) {
      await this.deleteToken(accessToken);
      throw new Error('Access token has expired');
    }

    return entry;
  }

  /**
   * Delete token entry
   */
  async deleteToken(accessToken: string): Promise<void> {
    const entry = this.tokens.get(accessToken);
    if (entry) {
      this.tokens.delete(accessToken);
      this.refreshTokens.delete(entry.refreshToken);
    }
  }

  /**
   * Get token by refresh token
   */
  async getTokenByRefreshToken(refreshToken: string): Promise<TokenEntry> {
    const accessToken = this.refreshTokens.get(refreshToken);
    if (!accessToken) {
      throw new Error('Invalid refresh token');
    }

    const entry = this.tokens.get(accessToken);
    if (!entry) {
      throw new Error('Invalid refresh token');
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= entry.expiresAt) {
      await this.deleteToken(accessToken);
      throw new Error('Refresh token has expired');
    }

    return entry;
  }
}

// Export singleton instance
export const storageService = new MemoryStorageService();