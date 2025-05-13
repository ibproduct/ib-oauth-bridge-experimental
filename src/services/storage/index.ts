// For local development, use memory storage
// For production, this would be replaced with DynamoDB implementation
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { IBAuthResponse } from '../ib-client';

export interface StateEntry {
  state: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  ibToken: IBAuthResponse;
  platformUrl: string;
  oauthState?: string;
  createdAt: number;
  expires: number;
}

export interface TokenEntry {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  scope: string;
  ibToken: IBAuthResponse;
  platformUrl: string;
  createdAt: number;
  expires: number;
}

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocument.from(ddbClient);

export class DynamoDBStorageService {
  constructor(
    private stateTableName: string = process.env.STATE_TABLE || '',
    private tokenTableName: string = process.env.TOKEN_TABLE || ''
  ) {}

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
    const ttl = now + 600; // 10 minutes

    await ddb.put({
      TableName: this.stateTableName,
      Item: {
        state: key,
        clientId,
        redirectUri,
        scope,
        ibToken,
        platformUrl,
        oauthState,
        createdAt: now,
        expires: ttl
      }
    });

    return key;
  }

  async getState(key: string): Promise<StateEntry> {
    const result = await ddb.get({
      TableName: this.stateTableName,
      Key: { state: key }
    });

    if (!result.Item) {
      throw new Error('Invalid state parameter');
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= result.Item.expires) {
      await this.deleteState(key);
      throw new Error('State parameter has expired');
    }

    return result.Item as StateEntry;
  }

  async deleteState(key: string): Promise<void> {
    await ddb.delete({
      TableName: this.stateTableName,
      Key: { state: key }
    });
  }

  async storeToken(
    accessToken: string,
    refreshToken: string,
    clientId: string,
    scope: string,
    ibToken: IBAuthResponse,
    platformUrl: string
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = now + 3600; // 1 hour

    await ddb.put({
      TableName: this.tokenTableName,
      Item: {
        accessToken,
        refreshToken,
        clientId,
        scope,
        ibToken,
        platformUrl,
        createdAt: now,
        expires: ttl
      }
    });
  }

  async getToken(accessToken: string): Promise<TokenEntry> {
    const result = await ddb.get({
      TableName: this.tokenTableName,
      Key: { accessToken }
    });

    if (!result.Item) {
      throw new Error('Invalid access token');
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= result.Item.expires) {
      await this.deleteToken(accessToken);
      throw new Error('Access token has expired');
    }

    return result.Item as TokenEntry;
  }

  async deleteToken(accessToken: string): Promise<void> {
    await ddb.delete({
      TableName: this.tokenTableName,
      Key: { accessToken }
    });
  }

  async getTokenByRefreshToken(refreshToken: string): Promise<TokenEntry> {
    const result = await ddb.scan({
      TableName: this.tokenTableName,
      FilterExpression: 'refreshToken = :rt',
      ExpressionAttributeValues: {
        ':rt': refreshToken
      }
    });

    if (!result.Items || result.Items.length === 0) {
      throw new Error('Invalid refresh token');
    }

    const token = result.Items[0];
    const now = Math.floor(Date.now() / 1000);
    if (now >= token.expires) {
      await this.deleteToken(token.accessToken);
      throw new Error('Refresh token has expired');
    }

    return token as TokenEntry;
  }
}

export const storageService = new DynamoDBStorageService();