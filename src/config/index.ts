import { z } from 'zod';

// URL validation schema
const urlSchema = z.string().url().refine(
  (url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'URL must use HTTPS protocol' }
);

// Platform URL validation schema with security checks
const platformUrlSchema = urlSchema.refine(
  (url) => {
    try {
      const parsed = new URL(url);
      // Ensure URL is well-formed and uses HTTPS
      return parsed.protocol === 'https:' &&
             parsed.hostname.length > 0 &&
             !parsed.hostname.includes('localhost') &&
             !parsed.hostname.includes('127.0.0.1');
    } catch {
      return false;
    }
  },
  { message: 'Invalid platform URL. Must be a valid HTTPS URL.' }
);

export interface Config {
  stage: string;
  stateTable: string;
  tokenTable: string;
  apiBaseUrl: string;
}

class ConfigService {
  private config: Config;

  constructor() {
    this.config = {
      stage: process.env.STAGE || 'dev',
      stateTable: process.env.STATE_TABLE || '',
      tokenTable: process.env.TOKEN_TABLE || '',
      apiBaseUrl: process.env.API_BASE_URL || '',
    };
  }

  public getConfig(): Config {
    return this.config;
  }

  /**
   * Validate and sanitize platform URL
   */
  public validatePlatformUrl(url: string): string {
    const validatedUrl = platformUrlSchema.parse(url);
    // Remove any trailing slashes
    return validatedUrl.replace(/\/$/, '');
  }

  /**
   * Validate and sanitize redirect URI
   */
  public validateRedirectUri(uri: string): string {
    return urlSchema.parse(uri);
  }

  /**
   * Validate and sanitize API URL
   */
  public validateApiUrl(url: string): string {
    return urlSchema.parse(url);
  }

  /**
   * Get table name with stage
   */
  public getTableName(baseName: string): string {
    return `${baseName}-${this.config.stage}`;
  }
}

// Export singleton instance
export const configService = new ConfigService();