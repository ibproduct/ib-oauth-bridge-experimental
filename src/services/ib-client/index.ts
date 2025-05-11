import axios, { AxiosInstance } from 'axios';

export interface IBAuthResponse {
  sid: string;
  content: string | {
    apiV3url: string;
    clientid: string;
  };
}

export interface IBSessionInfo {
  SID: string;
  content: {
    session: {
      sid: string;
      userUuid: string;
      loginTime: number;
    };
    info: {
      clientid: string;
      apiV3url: string;
      firstname: string;
      lastname: string;
      useruuid: string;
      email?: string;
    };
  };
}

export class IBClient {
  private client?: AxiosInstance;

  /**
   * Initialize client with platform URL
   */
  private initializeClient(platformUrl: string): void {
    this.client = axios.create({
      baseURL: platformUrl,
      headers: {
        'Content-Type': 'application/json'
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
   * @param platformUrl IntelligenceBank platform URL
   * @returns Promise<IBAuthResponse>
   */
  async getInitialToken(platformUrl: string): Promise<IBAuthResponse> {
    this.initializeClient(platformUrl);
    try {
      if (!this.client) throw new Error('Client not initialized');
      const response = await this.client.post('/v1/auth/app/token');
      return response.data;
    } catch (error) {
      throw new Error('Failed to get initial token from IntelligenceBank');
    }
  }

  /**
   * Get session information using SID
   * @param platformUrl IntelligenceBank platform URL
   * @param sid Session ID from IB
   * @returns Promise<IBSessionInfo>
   */
  async getSessionInfo(platformUrl: string, sid: string): Promise<IBSessionInfo> {
    this.initializeClient(platformUrl);
    try {
      if (!this.client) throw new Error('Client not initialized');
      const response = await this.client.get(`/v1/auth/app/info?token=${sid}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error('Authentication pending');
      }
      throw new Error('Failed to get session information from IntelligenceBank');
    }
  }

  /**
   * Generate IB login URL
   * @param platformUrl IntelligenceBank platform URL
   * @param token Initial token from getInitialToken
   * @param redirectUri OAuth redirect URI
   * @param state OAuth state parameter
   * @returns string Login URL
   */
  generateLoginUrl(
    platformUrl: string,
    token: string,
    redirectUri: string,
    state: string
  ): string {
    const params = new URLSearchParams({
      login: '0',
      token,
      redirect_uri: redirectUri,
      state
    });
    
    return `${platformUrl}/auth/?${params.toString()}`;
  }

  /**
   * Poll for session completion
   * @param platformUrl IntelligenceBank platform URL
   * @param sid Session ID to poll
   * @param maxAttempts Maximum number of polling attempts
   * @param interval Polling interval in milliseconds
   * @returns Promise<IBSessionInfo>
   */
  async pollSessionCompletion(
    platformUrl: string,
    sid: string,
    maxAttempts: number = 60,
    interval: number = 5000
  ): Promise<IBSessionInfo> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const sessionInfo = await this.getSessionInfo(platformUrl, sid);
        return sessionInfo;
      } catch (error) {
        if (error instanceof Error && error.message === 'Authentication pending') {
          if (attempt === maxAttempts - 1) {
            throw new Error('Authentication timeout');
          }
          await new Promise(resolve => setTimeout(resolve, interval));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Authentication timeout');
  }
}

// Export singleton instance
export const ibClient = new IBClient();