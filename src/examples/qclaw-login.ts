/**
 * QClaw login example.
 *
 * Demonstrates two startup modes:
 *   1. First run  – pass credentials explicitly; they are saved automatically.
 *   2. Later runs – call connect() with no credentials; they are restored from disk.
 *
 * See docs/CREDENTIALS.md for a full explanation of every QClaw credential field.
 */
import { WeChatSDK } from '../sdk/index.js';
import type { QClawCredentials } from '../sdk/types.js';

// ─── First-run helper ────────────────────────────────────────────────────────
// In a real application these values come from your external login flow
// (e.g. QR-code scan → JPRX auth API returns channelToken + jwtToken).
// You can also supply them via environment variables:
//   QCLAW_GUID, QCLAW_CHANNEL_TOKEN, QCLAW_JWT_TOKEN, QCLAW_USER_ID
function getCredentialsFromEnv(): QClawCredentials | null {
  const guid = process.env.QCLAW_GUID;
  const channelToken = process.env.QCLAW_CHANNEL_TOKEN;
  const jwtToken = process.env.QCLAW_JWT_TOKEN;

  if (!guid || !channelToken || !jwtToken) {
    return null;
  }

  return {
    mode: 'qclaw',
    guid,
    channelToken,
    jwtToken,
    userId: process.env.QCLAW_USER_ID,
  };
}

async function loginWithQClaw() {
  // Create an SDK instance without credentials first.
  // If a session file already exists (~/.wechat-sdk/session.json) it will be
  // used automatically when connect() is called.
  const sdk = new WeChatSDK({
    mode: 'qclaw',
    connection: {
      timeout: 10000,
      maxReconnectAttempts: 5,
      reconnectInterval: 3000,
    },
    // Storage settings (defaults shown – usually no need to change):
    // storage: { dir: '~/.wechat-sdk', enablePersist: true },
  });

  // ── Decide whether we already have a saved session ──────────────────────
  const hasSession = await sdk.hasSavedSession();

  if (!hasSession) {
    // No session on disk → credentials must be supplied explicitly this time.
    const creds = getCredentialsFromEnv();

    if (!creds) {
      console.error(
        '[QClaw] No saved session found and no credentials in environment.\n' +
        'Set the following environment variables and restart:\n' +
        '  QCLAW_GUID           – device GUID (generate once with crypto.randomUUID())\n' +
        '  QCLAW_CHANNEL_TOKEN  – channel token from the JPRX auth API\n' +
        '  QCLAW_JWT_TOKEN      – JWT token from the JPRX auth API\n' +
        '  QCLAW_USER_ID        – (optional) user ID returned by the auth API\n' +
        '\nSee docs/CREDENTIALS.md for details.',
      );
      process.exit(1);
    }

    // Attach the credentials so connect() can use them and save them.
    sdk.updateCredentials(creds);
    console.log('[QClaw] Using credentials from environment (will be saved after connect)');
  } else {
    console.log('[QClaw] Found saved session – restoring credentials automatically');
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  sdk.on('connected', () => console.log('[QClaw] Connected successfully'));
  sdk.on('message', (msg) => {
    console.log(`[QClaw] Message from ${msg.from}: ${msg.content}`);
  });
  sdk.on('error', (err) => console.error('[QClaw] Error:', err.message));
  sdk.on('disconnected', ({ reason }) => console.log('[QClaw] Disconnected:', reason));

  await sdk.connect();
  console.log('[QClaw] Ready to send/receive messages');
  console.log('[QClaw] Session is saved – next run needs no credentials.');
}

loginWithQClaw().catch(console.error);
