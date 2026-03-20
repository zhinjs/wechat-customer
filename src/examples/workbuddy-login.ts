/**
 * WorkBuddy login example.
 *
 * Demonstrates two startup modes:
 *   1. First run  – pass credentials explicitly; they are saved automatically.
 *   2. Later runs – call connect() with no credentials; they are restored from disk.
 *
 * See docs/CREDENTIALS.md for a full explanation of every WorkBuddy credential field.
 */
import { WeChatSDK } from '../sdk/index.js';
import type { WorkBuddyCredentials } from '../sdk/types.js';

// ─── First-run helper ────────────────────────────────────────────────────────
// In a real application these values come from your OAuth 2.0 flow
// (CodeBuddy authorization → exchange code → receive accessToken + refreshToken).
// You can also supply them via environment variables:
//   WORKBUDDY_USER_ID, WORKBUDDY_ACCESS_TOKEN, WORKBUDDY_REFRESH_TOKEN
function getCredentialsFromEnv(): WorkBuddyCredentials | null {
  const userId = process.env.WORKBUDDY_USER_ID;
  const accessToken = process.env.WORKBUDDY_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    return null;
  }

  return {
    mode: 'workbuddy',
    userId,
    accessToken,
    refreshToken: process.env.WORKBUDDY_REFRESH_TOKEN, // strongly recommended
    baseUrl: process.env.WORKBUDDY_BASE_URL,            // defaults to https://copilot.tencent.com
  };
}

async function loginWithWorkBuddy() {
  // Create an SDK instance without credentials first.
  // If a session file already exists (~/.wechat-sdk/session.json) it will be
  // used automatically when connect() is called.
  const sdk = new WeChatSDK({
    mode: 'workbuddy',
    connection: {
      timeout: 10000,
      heartbeatInterval: 25000,
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
        '[WorkBuddy] No saved session found and no credentials in environment.\n' +
        'Set the following environment variables and restart:\n' +
        '  WORKBUDDY_USER_ID       – user ID from the OAuth response\n' +
        '  WORKBUDDY_ACCESS_TOKEN  – access token from the OAuth response\n' +
        '  WORKBUDDY_REFRESH_TOKEN – (recommended) refresh token from the OAuth response\n' +
        '  WORKBUDDY_BASE_URL      – (optional) API base URL (default: https://copilot.tencent.com)\n' +
        '\nSee docs/CREDENTIALS.md for details.',
      );
      process.exit(1);
    }

    // Attach the credentials so connect() can use them and save them.
    sdk.updateCredentials(creds);
    console.log('[WorkBuddy] Using credentials from environment (will be saved after connect)');
  } else {
    console.log('[WorkBuddy] Found saved session – restoring credentials automatically');
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  sdk.on('connected', () => console.log('[WorkBuddy] Connected successfully'));
  sdk.on('tokenRefreshed', () => console.log('[WorkBuddy] Token refreshed and persisted'));
  sdk.on('message', (msg) => {
    console.log(`[WorkBuddy] Message from ${msg.from}: ${msg.content}`);
  });
  sdk.on('error', (err) => console.error('[WorkBuddy] Error:', err.message));
  sdk.on('disconnected', ({ reason }) => console.log('[WorkBuddy] Disconnected:', reason));

  await sdk.connect();
  console.log('[WorkBuddy] Ready to send/receive messages');
  console.log('[WorkBuddy] Session is saved – next run needs no credentials.');
}

loginWithWorkBuddy().catch(console.error);
