/**
 * Basic usage example for WeChatSDK.
 * This file is for documentation purposes only.
 */
import { WeChatSDK } from '../sdk/index.js';

async function main() {
  const sdk = new WeChatSDK({
    mode: 'qclaw',
    credentials: {
      mode: 'qclaw',
      channelToken: 'your-channel-token',
      jwtToken: 'your-jwt-token',
      // guid is auto-generated on first run
    },
  });

  sdk.on('connected', () => console.log('Connected!'));
  sdk.on('disconnected', ({ reason }) => console.log('Disconnected:', reason));
  sdk.on('message', (msg) => console.log('Message received:', msg.content));
  sdk.on('error', (err) => console.error('Error:', err));

  await sdk.connect();

  const response = await sdk.sendMessage({
    to: 'target-user-id',
    content: 'Hello from WeChatSDK!',
  });

  if (response.success) {
    console.log('Message sent:', response.messageId);
  }

  await sdk.disconnect();
}

main().catch(console.error);
