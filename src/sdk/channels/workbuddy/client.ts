import WebSocket from 'ws';
import { Channel } from '../base.js';
import {
  WorkBuddyCredentials,
  ConnectionConfig,
  MessageConfig,
  LoggerConfig,
  Message,
  MessageType,
  MessageDirection,
  MessageStatus,
  SendMessageRequest,
  SendMessageResponse,
  ConnectionState,
} from '../../types.js';
import { WorkBuddyAuth } from './auth.js';
import {
  WORKBUDDY_BASE_URL,
  CENTRIFUGE_METHOD,
  WorkBuddyCentrifugePush,
  WorkBuddyPushData,
} from './types.js';
import { MessageAdapter } from '../../message/adapter.js';

export class WorkBuddyChannel extends Channel {
  private ws: WebSocket | null = null;
  private auth: WorkBuddyAuth;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isClosing = false;
  private msgIdCounter = 1;

  constructor(
    credentials: WorkBuddyCredentials,
    connectionConfig?: ConnectionConfig,
    messageConfig?: MessageConfig,
    loggerConfig?: LoggerConfig,
  ) {
    super(credentials, connectionConfig, messageConfig, loggerConfig);
    this.auth = new WorkBuddyAuth();
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('WorkBuddy channel initialized');
  }

  protected async onConnect(): Promise<void> {
    const creds = this.credentials as WorkBuddyCredentials;
    const baseUrl = creds.baseUrl ?? WORKBUDDY_BASE_URL;
    const wsUrl = baseUrl.replace(/^https?:\/\//, (match) =>
      match.startsWith('https') ? 'wss://' : 'ws://',
    ) + '/centrifuge';

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WorkBuddy WebSocket connection timeout'));
      }, this.connectionConfig.timeout ?? 5000);

      this.ws = new WebSocket(wsUrl);

      this.ws.once('open', () => {
        clearTimeout(timeout);
        this.logger.info('WorkBuddy WebSocket connected, sending centrifuge connect');
        const connectMsg = {
          id: this.msgIdCounter++,
          method: CENTRIFUGE_METHOD.CONNECT,
          params: { token: creds.accessToken },
        };
        this.ws!.send(JSON.stringify(connectMsg));
        resolve();
      });

      this.ws.once('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    this.setupWebSocketHandlers();
    this.startHeartbeat();
  }

  protected async onDisconnect(): Promise<void> {
    this.isClosing = true;
    this.stopHeartbeat();
    this.stopReconnectTimer();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.isClosing = false;
  }

  protected async onSendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const creds = this.credentials as WorkBuddyCredentials;
    const baseUrl = creds.baseUrl ?? WORKBUDDY_BASE_URL;
    const url = `${baseUrl}/api/workbuddy/send`;
    const msgId = `wb-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.accessToken}`,
        },
        body: JSON.stringify({
          toUser: request.to,
          content: request.content,
          msgId,
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        return MessageAdapter.createSuccessResponse(msgId);
      }
      return MessageAdapter.createErrorResponse(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return MessageAdapter.createErrorResponse(msg);
    }
  }

  protected async onSendRaw(data: unknown): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    await new Promise<void>((resolve, reject) => {
      this.ws!.send(raw, (err?: Error) => (err ? reject(err) : resolve()));
    });
  }

  protected async onRefreshCredentials(): Promise<void> {
    const creds = this.credentials as WorkBuddyCredentials;
    const updated = await this.auth.refreshAccessToken(creds);
    this.updateCredentials(updated);
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.on('message', (data: Buffer | string) => {
      try {
        const text = data instanceof Buffer ? data.toString('utf-8') : String(data);
        const parsed = JSON.parse(text);
        this.handleCentrifugeMessage(parsed);
      } catch {
        this.logger.warn('Failed to parse WorkBuddy message');
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.info('WorkBuddy WebSocket closed', { code, reason: reason?.toString() });
      this.stopHeartbeat();
      if (!this.isClosing && this.state !== ConnectionState.CLOSING) {
        this.handleDisconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
    });
  }

  private handleCentrifugeMessage(msg: Record<string, unknown>): void {
    if (msg.push) {
      const push = msg.push as WorkBuddyCentrifugePush;
      if (push.pub?.data) {
        this.handlePushData(push.pub.data);
      }
    }
  }

  private handlePushData(data: WorkBuddyPushData): void {
    if (!data.content) return;
    const creds = this.credentials as WorkBuddyCredentials;
    const message: Message = {
      id: (data.msgId as string) ?? `wb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: MessageType.TEXT,
      direction: MessageDirection.INBOUND,
      content: data.content,
      from: (data.from as string) ?? 'unknown',
      to: creds.userId,
      timestamp: (data.timestamp as number) ?? Date.now(),
      status: MessageStatus.DELIVERED,
    };
    this.dispatchMessage(message);
  }

  private handleDisconnect(): void {
    const maxAttempts = this.connectionConfig.maxReconnectAttempts ?? 10;
    if (this.reconnectAttempts >= maxAttempts) {
      this.setState(ConnectionState.DISCONNECTED);
      this.emit('disconnected', 'max reconnect attempts reached');
      return;
    }

    this.setState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;
    const interval = this.connectionConfig.reconnectInterval ?? 3000;
    this.logger.info('Scheduling WorkBuddy reconnect', { attempt: this.reconnectAttempts, interval });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.onConnect();
        this.setState(ConnectionState.CONNECTED);
        this.reconnectAttempts = 0;
        this.emit('connected');
      } catch (err) {
        this.logger.error('WorkBuddy reconnect failed', err);
        this.handleDisconnect();
      }
    }, interval);
  }

  private startHeartbeat(): void {
    const interval = this.connectionConfig.heartbeatInterval ?? 30000;
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ id: this.msgIdCounter++, method: CENTRIFUGE_METHOD.PING, params: {} }));
      }
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
