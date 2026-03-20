/**
 * Message handling example.
 * This file is for documentation purposes only.
 */
import { WeChatSDK } from '../sdk/index.js';
import { MessageType } from '../sdk/types.js';

async function handleMessages() {
  const sdk = new WeChatSDK({
    mode: 'qclaw',
    credentials: {
      mode: 'qclaw',
      channelToken: 'your-token',
      jwtToken: 'your-jwt',
      // guid is auto-generated and persisted on first run
    },
  });

  // Listen for all incoming messages
  sdk.on('message', async (msg) => {
    console.log(`Received [${msg.type}] from ${msg.from}: ${msg.content}`);

    // Auto-reply to text messages
    if (msg.type === MessageType.TEXT) {
      const response = await sdk.sendMessage({
        to: msg.from,
        content: `Echo: ${msg.content}`,
        type: MessageType.TEXT,
      });
      if (response.success) {
        console.log(`Replied with messageId: ${response.messageId}`);
      }
    }
  });

  sdk.on('error', (err) => {
    console.error('SDK error:', err.message);
  });

  sdk.on('disconnected', ({ reason }) => {
    console.log('Disconnected:', reason);
  });

  await sdk.connect();
  console.log('Listening for messages...');
}

handleMessages().catch(console.error);
