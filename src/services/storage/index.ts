import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand,
  DeleteCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

interface StateEntry {
  state: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  ibToken: string;
  createdAt: number;
  expiresAt: number;
}

interface TokenEntry {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  scope: string;
  ibSid: string;
  createdAt: number;
  expiresAt: number;
}

export class StorageService {
  private docClient: DynamoDBDocumentClient;
  private stateTableName: string;
  private tokenTableName: string;
  private readonly STATE_TTL_SECONDS = 600; // 10 minutes
  private readonly TOKEN_TTL_SECONDS = 3600; // 1 hour

  constructor() {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    
    this.stateTableName = process.env.STATE_TABLE_NAME || '';
    this.tokenTableName = process.env.TOKEN_TABLE_NAME || '';

    if (!this.stateTableName || !this.tokenTableName) {
      throw new Error('Missing required DynamoDB table configuration');
    }
  }

  /**
   * Store OAuth state and associated data
   * @param clientId OAuth client ID
   * @param redirectUri OAuth redirect URI
   * @param scope OAuth scope
   * @param ibToken IntelligenceBank initial token
   * @returns state parameter
   */
  async storeState(
    clientId: string,
    redirectUri: string,
    scope: string,
    ibToken: string
  ): Promise<string> {
    const state = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    const entry: StateEntry = {
      state,
      clientId,
      redirectUri,
      scope,
      ibToken,
      createdAt: now,
      expiresAt: now + this.STATE_TTL_SECONDS
    };

    await this.docClient.send(new PutCommand({
      TableName: this.stateTableName,
      Item: entry
    }));

    return state;
  }

  /**
   * Retrieve and validate state entry
   * @param state State parameter
   * @returns StateEntry if valid
   * @throws Error if state is invalid or expired
   */
  async getState(state: string): Promise<StateEntry> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.stateTableName,
      Key: { state }
    }));

    if (!result.Item) {
      throw new Error('Invalid state parameter');
    }

    const entry = result.Item as StateEntry;
    const now = Math.floor(Date.now() / 1000);

    if (now >= entry.expiresAt) {
      await this.deleteState(state);
      throw new Error('State parameter has expired');
    }

    return entry;
  }

  /**
   * Delete state entry after use
   * @param state State parameter
   */
  async deleteState(state: string): Promise<void> {
    await this.docClient.send(new DeleteCommand({
      TableName: this.stateTableName,
      Key: { state }
    }));
  }

  /**
   * Store token information
   * @param accessToken OAuth access token
   * @param refreshToken OAuth refresh token
   * @param clientId OAuth client ID
   * @param scope OAuth scope
   * @param ibSid IntelligenceBank session ID
   */
  async storeToken(
    accessToken: string,
    refreshToken: string,
    clientId: string,
    scope: string,
    ibSid: string
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const entry: TokenEntry = {
      accessToken,
      refreshToken,
      clientId,
      scope,
      ibSid,
      createdAt: now,
      expiresAt: now + this.TOKEN_TTL_SECONDS
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tokenTableName,
      Item: entry
    }));
  }

  /**
   * Get token information by access token
   * @param accessToken OAuth access token
   * @returns TokenEntry if valid
   * @throws Error if token is invalid or expired
   */
  async getToken(accessToken: string): Promise<TokenEntry> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tokenTableName,
      Key: { accessToken }
    }));

    if (!result.Item) {
      throw new Error('Invalid access token');
    }

    const entry = result.Item as TokenEntry;
    const now = Math.floor(Date.now() / 1000);

    if (now >= entry.expiresAt) {
      await this.deleteToken(accessToken);
      throw new Error('Access token has expired');
    }

    return entry;
  }

  /**
   * Delete token entry
   * @param accessToken OAuth access token
   */
  async deleteToken(accessToken: string): Promise<void> {
    await this.docClient.send(new DeleteCommand({
      TableName: this.tokenTableName,
      Key: { accessToken }
    }));
  }

  /**
   * Get token by refresh token
   * @param refreshToken OAuth refresh token
   * @returns TokenEntry if valid
   */
  async getTokenByRefreshToken(refreshToken: string): Promise<TokenEntry> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tokenTableName,
      IndexName: 'RefreshTokenIndex',
      KeyConditionExpression: 'refreshToken = :refreshToken',
      ExpressionAttributeValues: {
        ':refreshToken': refreshToken
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      throw new Error('Invalid refresh token');
    }

    const entry = result.Items[0] as TokenEntry;
    const now = Math.floor(Date.now() / 1000);

    if (now >= entry.expiresAt) {
      await this.deleteToken(entry.accessToken);
      throw new Error('Refresh token has expired');
    }

    return entry;
  }
}

// Export singleton instance
export const storageService = new StorageService();