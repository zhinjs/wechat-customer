/**
 * WorkBuddy login example.
 * This file is for documentation purposes only.
 */
import { WeChatSDK } from '../sdk/index.js';
import type { WorkBuddyCredentials } from '../sdk/types.js';

const credentials: WorkBuddyCredentials = {
  mode: 'workbuddy',
  userId: 'your-user-id',
  accessToken: 'your-access-token',
  refreshToken: 'your-refresh-token',
};

async function loginWithWorkBuddy() {
  const sdk = new WeChatSDK({
    mode: 'workbuddy',
    credentials,
    connection: {
      timeout: 10000,
      heartbeatInterval: 25000,
    },
  });

  sdk.on('connected', () => console.log('[WorkBuddy] Connected successfully'));
  sdk.on('tokenRefreshed', () => console.log('[WorkBuddy] Token refreshed'));
  sdk.on('message', (msg) => {
    console.log(`[WorkBuddy] Message from ${msg.from}: ${msg.content}`);
  });

  await sdk.connect();
  console.log('[WorkBuddy] Ready to send/receive messages');
}

loginWithWorkBuddy().catch(console.error);
