import { WeChatSDK } from '../sdk/index';
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
  WorkBuddyChannel: jest.fn().mockImplementation(() => ({
    on: jest.fn().mockReturnThis(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    getState: jest.fn().mockReturnValue(ConnectionState.CONNECTED),
    sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id', timestamp: Date.now() }),
    refreshCredentials: jest.fn().mockResolvedValue(undefined),
    getCredentials: jest.fn().mockReturnValue({ mode: 'workbuddy', userId: 'user', accessToken: 'token' }),
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
    it('should create SDK with default config', () => {
      const sdk = new WeChatSDK();
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
    it('should select qclaw mode when mode is qclaw', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', credentials: qclawCreds });
      await sdk.connect();
      expect(sdk.isConnectedState()).toBe(true);
      await sdk.disconnect();
    });

    it('should select workbuddy mode when mode is workbuddy', async () => {
      const sdk = new WeChatSDK({ mode: 'workbuddy', credentials: workbuddyCreds });
      await sdk.connect();
      expect(sdk.isConnectedState()).toBe(true);
      await sdk.disconnect();
    });

    it('should auto-select qclaw mode from credentials', async () => {
      const sdk = new WeChatSDK({ mode: 'auto', credentials: qclawCreds });
      await sdk.connect();
      expect(sdk.isConnectedState()).toBe(true);
      await sdk.disconnect();
    });

    it('should auto-select workbuddy mode from credentials', async () => {
      const sdk = new WeChatSDK({ mode: 'auto', credentials: workbuddyCreds });
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

    it('should throw ConfigurationError when no credentials', async () => {
      const sdk = new WeChatSDK({ mode: 'qclaw', storage: { enablePersist: false } });
      await expect(sdk.connect()).rejects.toThrow();
    });

    it('should throw ConfigurationError for unsupported mode', async () => {
      const sdk = new WeChatSDK({ mode: 'auto', storage: { enablePersist: false } });
      await expect(sdk.connect()).rejects.toThrow();
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
      const sdk = new WeChatSDK({ storage: { dir: tmpDir, enablePersist: false } });
      expect(await sdk.hasSavedSession()).toBe(false);
    });

    it('connect saves credentials to storage when enablePersist=true', async () => {
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

    it('connect restores credentials from storage when none provided', async () => {
      // First run – saves credentials
      const sdk1 = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk1.connect();
      await sdk1.disconnect();

      // Second run – no credentials provided
      const sdk2 = new WeChatSDK({ storage: { dir: tmpDir, enablePersist: true } });
      await sdk2.connect();
      expect(sdk2.isConnectedState()).toBe(true);
      await sdk2.disconnect();
    });

    it('connect throws when no credentials and no saved session', async () => {
      const sdk = new WeChatSDK({ storage: { dir: tmpDir, enablePersist: true } });
      await expect(sdk.connect()).rejects.toThrow();
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
      const sdk = new WeChatSDK({ storage: { dir: tmpDir, enablePersist: true } });
      expect(await sdk.hasSavedDevice()).toBe(false);
    });

    it('auto-generates guid on first connect when not provided', async () => {
      const credsWithoutGuid: QClawCredentials = {
        mode: 'qclaw',
        channelToken: 'test-token',
        jwtToken: 'test-jwt',
        // no guid
      };
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: credsWithoutGuid,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      // device.json should now exist with a generated guid
      expect(await sdk.hasSavedDevice()).toBe(true);
      await sdk.disconnect();
    });

    it('reuses the same guid on subsequent connects', async () => {
      const credsWithoutGuid: QClawCredentials = {
        mode: 'qclaw',
        channelToken: 'test-token',
        jwtToken: 'test-jwt',
      };

      // First connect – guid is generated
      const sdk1 = new WeChatSDK({
        mode: 'qclaw',
        credentials: credsWithoutGuid,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk1.connect();
      const creds1 = sdk1.getCredentials() as QClawCredentials;
      const generatedGuid = creds1.guid;
      expect(generatedGuid).toBeDefined();
      await sdk1.disconnect();

      // Second connect – same guid should be restored from device.json
      const sdk2 = new WeChatSDK({
        mode: 'qclaw',
        credentials: credsWithoutGuid,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk2.connect();
      const creds2 = sdk2.getCredentials() as QClawCredentials;
      expect(creds2.guid).toBe(generatedGuid);
      await sdk2.disconnect();
    });

    it('uses provided guid and persists it to device.json', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds, // qclawCreds has guid: 'test-guid'
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      expect(await sdk.hasSavedDevice()).toBe(true);
      const creds = sdk.getCredentials() as QClawCredentials;
      expect(creds.guid).toBe('test-guid');
      await sdk.disconnect();
    });

    it('clearDevice removes the device.json but not session.json', async () => {
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: qclawCreds,
        storage: { dir: tmpDir, enablePersist: true },
      });
      await sdk.connect();
      expect(await sdk.hasSavedDevice()).toBe(true);
      expect(await sdk.hasSavedSession()).toBe(true);

      await sdk.clearDevice();
      expect(await sdk.hasSavedDevice()).toBe(false);
      // clearDevice() does NOT touch session.json
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
      // device.json should still be there after clearing the session
      expect(await sdk.hasSavedDevice()).toBe(true);
    });

    it('does not persist device when enablePersist=false', async () => {
      const credsWithoutGuid: QClawCredentials = {
        mode: 'qclaw',
        channelToken: 'test-token',
        jwtToken: 'test-jwt',
      };
      const sdk = new WeChatSDK({
        mode: 'qclaw',
        credentials: credsWithoutGuid,
        storage: { dir: tmpDir, enablePersist: false },
      });
      await sdk.connect();
      expect(await sdk.hasSavedDevice()).toBe(false);
      await sdk.disconnect();
    });
  });
});
