/**
 * QClaw login example.
 * This file is for documentation purposes only.
 */
import { WeChatSDK } from '../sdk/index.js';
import type { QClawCredentials } from '../sdk/types.js';

const credentials: QClawCredentials = {
  mode: 'qclaw',
  guid: 'your-device-guid',
  channelToken: 'your-channel-token',
  jwtToken: 'your-jwt-token',
  userId: 'your-user-id',
};

async function loginWithQClaw() {
  const sdk = new WeChatSDK({
    mode: 'qclaw',
    credentials,
    connection: {
      timeout: 10000,
      maxReconnectAttempts: 5,
      reconnectInterval: 3000,
    },
  });

  sdk.on('connected', () => console.log('[QClaw] Connected successfully'));
  sdk.on('message', (msg) => {
    console.log(`[QClaw] Message from ${msg.from}: ${msg.content}`);
  });

  await sdk.connect();
  console.log('[QClaw] Ready to send/receive messages');
}

loginWithQClaw().catch(console.error);
