/**
 * Session management example.
 *
 * Shows how to use the built-in credential persistence API:
 *   hasSavedSession()      – check whether a session file exists
 *   loadSavedCredentials() – read credentials without connecting
 *   clearSession()         – delete the session file (force re-login)
 *
 * See docs/CREDENTIALS.md for the full credential guide.
 */
import { WeChatSDK } from '../sdk/index.js';

// ─── 1. Check for an existing session ────────────────────────────────────────

async function checkSession() {
  const sdk = new WeChatSDK(); // no credentials needed to inspect the session file

  const hasSession = await sdk.hasSavedSession();
  console.log('Has saved session:', hasSession);

  if (hasSession) {
    const creds = await sdk.loadSavedCredentials();
    if (creds) {
      console.log('Saved session mode:', creds.mode);
      if (creds.mode === 'qclaw') {
        console.log('  guid   :', creds.guid);
        console.log('  userId :', creds.userId ?? '(not set)');
      } else if (creds.mode === 'workbuddy') {
        console.log('  userId :', creds.userId);
      }
    }
  }
}

// ─── 2. Connect using a saved session (subsequent runs) ──────────────────────

async function connectFromSavedSession() {
  const sdk = new WeChatSDK();
  // connect() finds ~/.wechat-sdk/session.json and restores credentials automatically.
  await sdk.connect();

  console.log('Connected using saved session');

  sdk.on('message', (msg) => {
    console.log('Message:', msg.content);
  });

  // Disconnect after 5 seconds for this demo
  await new Promise<void>((resolve) => setTimeout(resolve, 5000));
  await sdk.disconnect();
}

// ─── 3. Clear the session (force re-login on next run) ───────────────────────

async function clearExistingSession() {
  const sdk = new WeChatSDK();
  const hasSession = await sdk.hasSavedSession();

  if (hasSession) {
    await sdk.clearSession();
    console.log('Session cleared. Next run will require explicit credentials.');
  } else {
    console.log('No session to clear.');
  }
}

// ─── 4. Full lifecycle: first run → save → restore ───────────────────────────

async function fullLifecycleDemo() {
  // ── First run: provide credentials explicitly ────────────────────────────
  console.log('\n── First run ─────────────────────────────────────');
  const sdk1 = new WeChatSDK({
    mode: 'qclaw',
    credentials: {
      mode: 'qclaw',
      guid: process.env.QCLAW_GUID ?? 'demo-guid',
      channelToken: process.env.QCLAW_CHANNEL_TOKEN ?? 'demo-token',
      jwtToken: process.env.QCLAW_JWT_TOKEN ?? 'demo-jwt',
    },
    storage: { dir: '/tmp/wechat-sdk-demo', enablePersist: true },
  });

  // In a real app sdk1.connect() would contact the real service.
  // Here we just demonstrate the session-file API without a live connection.
  console.log('Has saved session before first connect:', await sdk1.hasSavedSession());

  // ── Second run: no credentials needed ───────────────────────────────────
  console.log('\n── Subsequent run ────────────────────────────────');
  const sdk2 = new WeChatSDK({
    storage: { dir: '/tmp/wechat-sdk-demo', enablePersist: true },
  });
  console.log('Has saved session:', await sdk2.hasSavedSession());

  const saved = await sdk2.loadSavedCredentials();
  if (saved) {
    console.log('Restored credentials – mode:', saved.mode);
  }

  // Clean up demo directory
  await sdk2.clearSession();
  console.log('\nDemo session cleared.');
}

// ─── Run demo ─────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== Session Management Demo ===\n');

  console.log('── Check existing session ─────────────────────────');
  await checkSession();

  console.log('\n── Full lifecycle demo ────────────────────────────');
  await fullLifecycleDemo();
})().catch(console.error);
