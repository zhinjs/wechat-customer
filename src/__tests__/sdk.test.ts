import { WeChatSDK } from '../sdk/index';
import { QClawCredentials, WorkBuddyCredentials, ConnectionState } from '../sdk/types';

// Mock the channel implementations
jest.mock('../sdk/channels/qclaw/client', () => ({
  QClawChannel: jest.fn().mockImplementation(() => ({
    on: jest.fn().mockReturnThis(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    getState: jest.fn().mockReturnValue(ConnectionState.CONNECTED),
    sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id', timestamp: Date.now() }),
    refreshCredentials: jest.fn().mockResolvedValue(undefined),
    getCredentials: jest.fn().mockReturnValue({ mode: 'qclaw', guid: 'test', channelToken: 'token', jwtToken: 'jwt' }),
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
      const sdk = new WeChatSDK({ mode: 'qclaw' });
      await expect(sdk.connect()).rejects.toThrow();
    });

    it('should throw ConfigurationError for unsupported mode', async () => {
      const sdk = new WeChatSDK({ mode: 'auto' });
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
});
