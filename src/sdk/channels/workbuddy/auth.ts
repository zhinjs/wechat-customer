import { WorkBuddyCredentials } from '../../types.js';
import { WorkBuddyTokenResponse, WORKBUDDY_BASE_URL } from './types.js';

export class WorkBuddyAuth {
  async refreshAccessToken(credentials: WorkBuddyCredentials): Promise<WorkBuddyCredentials> {
    if (!credentials.refreshToken) {
      throw new Error('No refresh token available');
    }

    const baseUrl = credentials.baseUrl ?? WORKBUDDY_BASE_URL;
    const url = `${baseUrl}/api/auth/refresh`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: credentials.refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as WorkBuddyTokenResponse;

    return {
      ...credentials,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? credentials.refreshToken,
    };
  }
}
