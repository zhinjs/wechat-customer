import { Channel } from '../sdk/channels/base';
import { ConnectionState, SendMessageRequest, SendMessageResponse } from '../sdk/types';
import { QClawCredentials } from '../sdk/types';

const testCreds: QClawCredentials = {
  mode: 'qclaw',
  guid: 'test-guid',
  channelToken: 'test-token',
  jwtToken: 'test-jwt',
};

// Concrete test implementation of abstract Channel
class TestChannel extends Channel {
  public connectCalled = false;
  public disconnectCalled = false;
  public initCalled = false;
  public shouldFailConnect = false;

  protected async onInitialize(): Promise<void> {
    this.initCalled = true;
  }

  protected async onConnect(): Promise<void> {
    this.connectCalled = true;
    if (this.shouldFailConnect) {
      throw new Error('Connection failed');
    }
  }

  protected async onDisconnect(): Promise<void> {
    this.disconnectCalled = true;
  }

  protected async onSendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return { success: true, messageId: 'test-msg-id', timestamp: Date.now() };
  }

  protected async onSendRaw(data: unknown): Promise<void> {
    // no-op for tests
  }

  protected async onRefreshCredentials(): Promise<void> {
    // no-op for tests
  }

  // Expose protected methods for testing
  public testDispatchMessage = this.dispatchMessage.bind(this);
  public testDispatchError = this.dispatchError.bind(this);
  public testSetState = this.setState.bind(this);
}

describe('Channel abstract base class', () => {
  let channel: TestChannel;

  beforeEach(() => {
    channel = new TestChannel(testCreds);
  });

  describe('state management', () => {
    it('should start in DISCONNECTED state', () => {
      expect(channel.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should transition to CONNECTED after connect()', async () => {
      await channel.connect();
      expect(channel.getState()).toBe(ConnectionState.CONNECTED);
    });

    it('should transition back to DISCONNECTED after disconnect()', async () => {
      await channel.connect();
      await channel.disconnect();
      expect(channel.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should report isConnected() correctly', async () => {
      expect(channel.isConnected()).toBe(false);
      await channel.connect();
      expect(channel.isConnected()).toBe(true);
      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
    });

    it('setState should only update when state changes', () => {
      channel.testSetState(ConnectionState.CONNECTING);
      expect(channel.getState()).toBe(ConnectionState.CONNECTING);
      channel.testSetState(ConnectionState.CONNECTING); // same state
      expect(channel.getState()).toBe(ConnectionState.CONNECTING);
    });
  });

  describe('lifecycle methods', () => {
    it('should call onInitialize on first connect', async () => {
      await channel.connect();
      expect(channel.initCalled).toBe(true);
    });

    it('should not re-initialize on second connect', async () => {
      await channel.connect();
      await channel.disconnect();
      channel.initCalled = false;
      await channel.connect();
      expect(channel.initCalled).toBe(false);
    });

    it('should call onConnect', async () => {
      await channel.connect();
      expect(channel.connectCalled).toBe(true);
    });

    it('should call onDisconnect', async () => {
      await channel.connect();
      await channel.disconnect();
      expect(channel.disconnectCalled).toBe(true);
    });

    it('should revert to DISCONNECTED state on connect failure', async () => {
      channel.shouldFailConnect = true;
      await expect(channel.connect()).rejects.toThrow('Connection failed');
      expect(channel.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should skip disconnect if already disconnected', async () => {
      await channel.disconnect(); // already disconnected
      expect(channel.disconnectCalled).toBe(false);
    });
  });

  describe('event emission', () => {
    it('should emit connected event on connect', async () => {
      const handler = jest.fn();
      channel.on('connected', handler);
      await channel.connect();
      expect(handler).toHaveBeenCalled();
    });

    it('should emit disconnected event on disconnect', async () => {
      const handler = jest.fn();
      channel.on('disconnected', handler);
      await channel.connect();
      await channel.disconnect();
      expect(handler).toHaveBeenCalled();
    });

    it('should emit message event via dispatchMessage', async () => {
      const handler = jest.fn();
      channel.on('message', handler);
      const msg = {
        id: 'test-id',
        type: 'text' as any,
        direction: 'inbound' as any,
        content: 'hello',
        from: 'user1',
        to: 'user2',
        timestamp: Date.now(),
        status: 'delivered' as any,
      };
      channel.testDispatchMessage(msg);
      expect(handler).toHaveBeenCalledWith(msg);
    });

    it('should emit error event via dispatchError', async () => {
      const handler = jest.fn();
      channel.on('error', handler);
      const err = new Error('test error');
      channel.testDispatchError(err);
      expect(handler).toHaveBeenCalledWith(err);
    });

    it('should emit tokenRefreshed event on refreshCredentials', async () => {
      const handler = jest.fn();
      channel.on('tokenRefreshed', handler);
      await channel.refreshCredentials();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should throw if not connected', async () => {
      await expect(channel.sendMessage({ to: 'user', content: 'hello' })).rejects.toThrow();
    });

    it('should send message when connected', async () => {
      await channel.connect();
      const response = await channel.sendMessage({ to: 'user', content: 'hello' });
      expect(response.success).toBe(true);
      expect(response.messageId).toBe('test-msg-id');
    });

    it('should throw for invalid params', async () => {
      await channel.connect();
      await expect(channel.sendMessage({ to: '', content: 'hello' })).rejects.toThrow();
    });
  });

  describe('credentials management', () => {
    it('should return a copy of credentials', () => {
      const creds = channel.getCredentials();
      expect(creds).toEqual(testCreds);
      expect(creds).not.toBe(testCreds); // should be a copy
    });
  });
});
