import { WeChatSDK, LoginRequiredError } from '../sdk/index';
import { QClawCredentials, WorkBuddyCredentials, ConnectionState } from '../sdk/types';

// Mock the channel implementations
jest.mock('../sdk/channels/qclaw/client', () => ({
  QClawChannel: jest.fn().mockImplementation((creds) => ({
    on: jest.fn().mockReturnThis(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    getState: jest.fn().mockReturnValue(ConnectionState.CONNECTED),
    sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id', timestamp: Date.now() }),
    refreshCredentials: jest.fn().mockResolvedValue(undefined),
    getCredentials: jest.fn().mockReturnValue(creds),
    emit: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

jest.mock('../sdk/channels/workbuddy/client', () => ({
  WorkBuddyChannel: jest.fn().mockImplementation((creds) => ({
    on: jest.fn().mockReturnThis(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    getState: jest.fn().mockReturnValue(ConnectionState.CONNECTED),
    sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id', timestamp: Date.now() }),
    refreshCredentials: jest.fn().mockResolvedValue(undefined),
    getCredentials: jest.fn().mockReturnValue(creds),
    emit: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

const qclawCreds: QClawCredentials = {
  mode: 'qclaw',
  guid: 'test-guid',
  channelToken: 'test-token',
  jwtToken: 'test-jwt',
};

const workbuddyCreds: WorkBuddyCredentials = {
  mode: 'workbuddy',
  userId: 'test-user',
  accessToken: 'test-access-token',
};

describe('WeChatSDK', () => {
  describe('Configuration validation', () => {
    it('should create SDK with QClaw mode', () => {
      const sdk = new WeChatSDK({ mode: 'qclaw' });
      expect(sdk).toBeDefined();
    });

    it('should create SDK with WorkBuddy mode', () => {
      const sdk = new WeChatSDK({ mode: 'workbuddy' });
      expect(sdk).toBeDefined();
    });

    it('should create SDK with QClaw credentials', () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', credentials: qclawCreds });
      expect(sdk).toBeDefined();
    });

    it('should create SDK with WorkBuddy credentials', () => {
      const sdk = new WeChatSDK({ mode: 'workbuddy', credentials: workbuddyCreds });
      expect(sdk).toBeDefined();
    });
  });

  describe('Mode selection', () => {
    it('should connect in qclaw mode', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', credentials: qclawCreds });
      await sdk.connect();
      expect(sdk.isConnectedState()).toBe(true);
      await sdk.disconnect();
    });

    it('should connect in workbuddy mode', async () => {
      const sdk = new WeChatSDK({ mode: 'workbuddy', credentials: workbuddyCreds });
      await sdk.connect();
      expect(sdk.isConnectedState()).toBe(true);
      await sdk.disconnect();
    });
  });

  describe('connect/disconnect lifecycle', () => {
    it('should connect and disconnect', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', credentials: qclawCreds });
      await sdk.connect();
      expect(sdk.isConnectedState()).toBe(true);
      await sdk.disconnect();
    });

    it('should not connect twice', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', credentials: qclawCreds });
      await sdk.connect();
      await sdk.connect(); // second call should be no-op
      expect(sdk.isConnectedState()).toBe(true);
      await sdk.disconnect();
    });

    it('throws LoginRequiredError when no credentials and no saved session', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', storage: { enablePersist: false } });
      await expect(sdk.connect()).rejects.toThrow(LoginRequiredError);
    });

    it('emits loginRequired event when no credentials (QClaw)', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', storage: { enablePersist: false } });
      const loginRequiredSpy = jest.fn();
      sdk.on('loginRequired', loginRequiredSpy);
      await expect(sdk.connect()).rejects.toThrow(LoginRequiredError);
      expect(loginRequiredSpy).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'qclaw', guid: expect.any(String) }),
      );
    });

    it('emits loginRequired event when no credentials (WorkBuddy)', async () => {
      const sdk = new WeChatSDK({ mode: 'workbuddy', storage: { enablePersist: false } });
      const loginRequiredSpy = jest.fn();
      sdk.on('loginRequired', loginRequiredSpy);
      await expect(sdk.connect()).rejects.toThrow(LoginRequiredError);
      expect(loginRequiredSpy).toHaveBeenCalledWith({ mode: 'workbuddy' });
    });

    it('LoginRequiredError carries mode and guid for QClaw', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', storage: { enablePersist: false } });
      let caughtError: LoginRequiredError | undefined;
      try {
        await sdk.connect();
      } catch (e) {
        caughtError = e as LoginRequiredError;
      }
      expect(caughtError).toBeInstanceOf(LoginRequiredError);
      expect(caughtError?.mode).toBe('qclaw');
      expect(caughtError?.guid).toBeDefined();
    });
  });

  describe('sendMessage validation', () => {
    let sdk: WeChatSDK;
    beforeEach(async () => {
      sdk = new WeChatSDK({ mode: 'qclaw', credentials: qclawCreds });
      await sdk.connect();
    });
    afterEach(async () => {
      await sdk.disconnect();
    });

    it('should send a valid message', async () => {
      const response = await sdk.sendMessage({ to: 'user123', content: 'Hello' });
      expect(response.success).toBe(true);
    });

    it('should throw ValidationError for empty to', async () => {
      await expect(sdk.sendMessage({ to: '', content: 'Hello' })).rejects.toThrow();
    });

    it('should throw ValidationError for empty content', async () => {
      await expect(sdk.sendMessage({ to: 'user123', content: '' })).rejects.toThrow();
    });

    it('should throw ValidationError for too long content', async () => {
      await expect(sdk.sendMessage({ to: 'user123', content: 'x'.repeat(4001) })).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw ConnectionError when sendMessage called without connect', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', credentials: qclawCreds });
      await expect(sdk.sendMessage({ to: 'user', content: 'hello' })).rejects.toThrow();
    });
  });

  describe('session management', () => {
    let tmpDir: string;

    beforeEach(async () => {
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs/promises');
      tmpDir = path.join(os.default.tmpdir(), `wechat-sdk-test-${Date.now()}`);
      await fs.mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
      const fs = await import('fs/promises');
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('hasSavedSession returns false when no session file exists', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', storage: { dir: tmpDir, enablePersist: false } });
      expect(await sdk.hasSavedSession()).toBe(false);
    });

    it('connect saves credentials to per-mode storage when enablePersist=true', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      expect(await sdk.hasSavedSession()).toBe(true);
      const saved = await sdk.loadSavedCredentials();
      expect(saved).not.toBeNull();
      expect((saved as any).mode).toBe('qclaw');
      await sdk.disconnect();
    });

    it('QClaw and WorkBuddy sessions are stored independently', async () => {
      const sdkQ = new WeChatSDK({ mode: 'qclaw', credentials: qclawCreds, storage: { dir: tmpDir, enablePersist: true } });
      await sdkQ.connect();
      await sdkQ.disconnect();

      const sdkW = new WeChatSDK({ mode: 'workbuddy', credentials: workbuddyCreds, storage: { dir: tmpDir, enablePersist: true } });
      await sdkW.connect();
      await sdkW.disconnect();

      // Clearing qclaw session does not affect workbuddy session
      await sdkQ.clearSession();
      expect(await sdkQ.hasSavedSession()).toBe(false);
      expect(await sdkW.hasSavedSession()).toBe(true);
    });

    it('connect does NOT save credentials when enablePersist=false', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: false },
      });
      await sdk.connect();
      expect(await sdk.hasSavedSession()).toBe(false);
      await sdk.disconnect();
    });

    it('connect restores credentials from per-mode storage when none provided', async () => {
      // First run – saves credentials
      const sdk1 = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk1.connect();
      await sdk1.disconnect();

      // Second run – mode is still required, but no credentials needed
      const sdk2 = new WeChatSDK({ mode: 'qclaw', storage: { dir: tmpDir, enablePersist: true } });
      await sdk2.connect();
      expect(sdk2.isConnectedState()).toBe(true);
      await sdk2.disconnect();
    });

    it('throws LoginRequiredError when no credentials and no saved session', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', storage: { dir: tmpDir, enablePersist: true } });
      await expect(sdk.connect()).rejects.toThrow(LoginRequiredError);
    });

    it('clearSession removes the session file', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      expect(await sdk.hasSavedSession()).toBe(true);
      await sdk.clearSession();
      expect(await sdk.hasSavedSession()).toBe(false);
      await sdk.disconnect();
    });

    it('refreshCredentials persists updated credentials', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      await sdk.refreshCredentials();
      const saved = await sdk.loadSavedCredentials();
      expect(saved).not.toBeNull();
      await sdk.disconnect();
    });
  });

  describe('device guid management (oicq pattern)', () => {
    let tmpDir: string;

    beforeEach(async () => {
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs/promises');
      tmpDir = path.join(os.default.tmpdir(), `wechat-sdk-device-test-${Date.now()}`);
      await fs.mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
      const fs = await import('fs/promises');
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('hasSavedDevice returns false before first connect', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', storage: { dir: tmpDir, enablePersist: true } });
      expect(await sdk.hasSavedDevice()).toBe(false);
    });

    it('getOrCreateDeviceGuid generates a guid before connect', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', storage: { dir: tmpDir, enablePersist: true } });
      const guid = await sdk.getOrCreateDeviceGuid();
      expect(typeof guid).toBe('string');
      expect(guid.length).toBeGreaterThan(0);
      expect(await sdk.hasSavedDevice()).toBe(true);
    });

    it('auto-generates guid on first connect when not provided', async () => {
      const credsWithoutGuid: QClawCredentials = {
        mode: 'qclaw',
        channelToken: 'test-token',
        jwtToken: 'test-jwt',
      };
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: credsWithoutGuid,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      expect(await sdk.hasSavedDevice()).toBe(true);
      await sdk.disconnect();
    });

    it('reuses the same guid on subsequent connects', async () => {
      const credsWithoutGuid: QClawCredentials = {
        mode: 'qclaw',
        channelToken: 'test-token',
        jwtToken: 'test-jwt',
      };

      const sdk1 = new WeChatSDK({
        mode: 'qclaw',
        credentials: credsWithoutGuid,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk1.connect();
      const generatedGuid = (sdk1.getCredentials() as QClawCredentials).guid;
      expect(generatedGuid).toBeDefined();
      await sdk1.disconnect();

      const sdk2 = new WeChatSDK({
        mode: 'qclaw',
        credentials: credsWithoutGuid,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk2.connect();
      expect((sdk2.getCredentials() as QClawCredentials).guid).toBe(generatedGuid);
      await sdk2.disconnect();
    });

    it('uses provided guid and persists it to device.json', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      expect(await sdk.hasSavedDevice()).toBe(true);
      expect((sdk.getCredentials() as QClawCredentials).guid).toBe('test-guid');
      await sdk.disconnect();
    });

    it('clearDevice removes device.json but not session.json', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      await sdk.clearDevice();
      expect(await sdk.hasSavedDevice()).toBe(false);
      expect(await sdk.hasSavedSession()).toBe(true);
      await sdk.disconnect();
    });

    it('clearSession does NOT remove device.json', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      await sdk.clearSession();
      expect(await sdk.hasSavedDevice()).toBe(true);
    });

    it('does not persist device when enablePersist=false', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: { mode: 'qclaw', channelToken: 'test-token', jwtToken: 'test-jwt' },
        storage: { dir: tmpDir, enablePersist: false },
      });
      await sdk.connect();
      expect(await sdk.hasSavedDevice()).toBe(false);
      await sdk.disconnect();
    });
  });
});
