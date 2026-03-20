/**
 * Session management example.
 *
 * Shows how to use the built-in credential persistence API:
 *   hasSavedSession()           – check whether a session file exists  (~/.wechat-sdk/{mode}/session.json)
 *   loadSavedCredentials()      – read credentials without connecting
 *   clearSession()              – delete the session file (force re-login next run)
 *   hasSavedDevice()            – check device.json (QClaw only)
 *   getOrCreateDeviceGuid()     – get/generate the device GUID without connecting
 *   clearDevice()               – delete device.json (new GUID on next connect)
 *
 * Sessions are stored per-mode:
 *   ~/.wechat-sdk/qclaw/session.json
 *   ~/.wechat-sdk/workbuddy/session.json
 *
 * See docs/CREDENTIALS.md for the full credential guide.
 */
import { WeChatSDK, LoginRequiredError } from '../sdk/index.js';

// ─── 1. Check for an existing session ────────────────────────────────────────

async function checkQClawSession() {
  const sdk = new WeChatSDK({ mode: 'qclaw' });

  const hasSession = await sdk.hasSavedSession();
  console.log('QClaw has saved session:', hasSession);

  if (hasSession) {
    const creds = await sdk.loadSavedCredentials();
    if (creds?.mode === 'qclaw') {
      console.log('  guid   :', creds.guid);
      console.log('  userId :', creds.userId ?? '(not set)');
    }
  }

  const hasDevice = await sdk.hasSavedDevice();
  console.log('QClaw has saved device (guid):', hasDevice);
  if (!hasDevice) {
    // getOrCreateDeviceGuid() can be called BEFORE connect() to obtain the
    // guid for a QR-code login flow without actually connecting yet.
    const guid = await sdk.getOrCreateDeviceGuid();
    console.log('Generated/loaded GUID:', guid);
  }
}

// ─── 2. Connect using a saved session (subsequent runs) ──────────────────────

async function connectFromSavedSession() {
  const sdk = new WeChatSDK({ mode: 'qclaw' });
  // connect() auto-loads ~/.wechat-sdk/qclaw/session.json
  // If no session exists, loginRequired is emitted and LoginRequiredError is thrown.
  await sdk.connect();

  console.log('Connected using saved QClaw session');

  sdk.on('message', (msg) => {
    console.log('Message:', msg.content);
  });

  await new Promise<void>((resolve) => setTimeout(resolve, 5000));
  await sdk.disconnect();
}

// ─── 3. First-run pattern: listen for loginRequired ──────────────────────────

async function firstRunPattern() {
  const sdk = new WeChatSDK({ mode: 'qclaw' });

  sdk.on('loginRequired', async ({ mode, ...rest }) => {
    // 'rest' contains { guid } for QClaw mode
    const guid = (rest as any).guid as string | undefined;
    console.log(`[loginRequired] mode=${mode}, guid=${guid ?? 'n/a'}`);
    console.log('→ Use this guid with the JPRX auth API to get channelToken/jwtToken');
    console.log('→ Then call: sdk.updateCredentials({ mode, channelToken, jwtToken })');
    console.log('→ Then call: sdk.connect()');
  });

  try {
    await sdk.connect();
  } catch (e) {
    if (e instanceof LoginRequiredError) {
      console.log('Caught LoginRequiredError – app should now trigger login flow');
    }
  }
}

// ─── 4. Clear session (login out) ────────────────────────────────────────────

async function clearQClawSession() {
  const sdk = new WeChatSDK({ mode: 'qclaw' });
  if (await sdk.hasSavedSession()) {
    await sdk.clearSession(); // clears session.json only; device.json is preserved
    console.log('QClaw session cleared. Next run will require channelToken/jwtToken.');
  } else {
    console.log('No QClaw session to clear.');
  }
}

// ─── 5. Full lifecycle: first run → save → restore ───────────────────────────

async function fullLifecycleDemo() {
  const customDir = '/tmp/wechat-sdk-demo';

  // ── First run: provide auth tokens; guid auto-generated ─────────────────
  console.log('\n── First run (QClaw) ─────────────────────────────');
  const sdk1 = new WeChatSDK({
    mode: 'qclaw',
    credentials: {
      mode: 'qclaw',
      channelToken: process.env.QCLAW_CHANNEL_TOKEN ?? 'demo-token',
      jwtToken: process.env.QCLAW_JWT_TOKEN ?? 'demo-jwt',
      // guid is NOT provided; SDK auto-generates and saves to device.json
    },
    storage: { dir: customDir, enablePersist: true },
  });
  console.log('Has saved session:', await sdk1.hasSavedSession());

  // ── Second run: no credentials needed ────────────────────────────────────
  console.log('\n── Second run (QClaw) ────────────────────────────');
  const sdk2 = new WeChatSDK({ mode: 'qclaw', storage: { dir: customDir, enablePersist: true } });
  console.log('Has saved session:', await sdk2.hasSavedSession());

  const saved = await sdk2.loadSavedCredentials();
  if (saved) {
    console.log('Restored mode:', saved.mode);
  }

  // Clean up
  await sdk2.clearSession();
  await sdk2.clearDevice();
  console.log('\nDemo files cleaned up.');
}

// ─── Run demo ─────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== Session Management Demo ===\n');
  await checkQClawSession();
  await firstRunPattern();
})().catch(console.error);


