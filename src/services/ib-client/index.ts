import axios, { AxiosInstance } from 'axios';

export interface IBAuthResponse {
  SID: string;
  content: string;
}

export interface IBSessionInfo {
  session: {
    id: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  };
}

export class IBClient {
  private client: AxiosInstance;
  private platformUrl: string;
  private apiKey: string;

  constructor() {
    this.platformUrl = process.env.IB_PLATFORM_URL || '';
    this.apiKey = process.env.IB_API_KEY || '';

    if (!this.platformUrl || !this.apiKey) {
      throw new Error('Missing required IB configuration');
    }

    this.client = axios.create({
      baseURL: this.platformUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        // Log error details
        console.error('IB API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        throw error;
      }
    );
  }

  /**
   * Get initial authentication token from IB
   * @returns Promise<IBAuthResponse>
   */
  async getInitialToken(): Promise<IBAuthResponse> {
    try {
      const response = await this.client.post('/api/v2/auth/token');
      return response.data;
    } catch (error) {
      throw new Error('Failed to get initial token from IntelligenceBank');
    }
  }

  /**
   * Get session information using SID
   * @param sid Session ID from IB
   * @returns Promise<IBSessionInfo>
   */
  async getSessionInfo(sid: string): Promise<IBSessionInfo> {
    try {
      const response = await this.client.get('/api/v2/auth/session', {
        headers: {
          'X-Session-ID': sid
        }
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to get session information from IntelligenceBank');
    }
  }

  /**
   * Generate IB login URL
   * @param token Initial token from getInitialToken
   * @param redirectUri OAuth redirect URI
   * @returns string Login URL
   */
  generateLoginUrl(token: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      token,
      redirect_uri: redirectUri,
      state
    });
    
    return `${this.platformUrl}/auth/login?${params.toString()}`;
  }
}

// Export singleton instance
export const ibClient = new IBClient();