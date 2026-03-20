import WebSocket from 'ws';
import { Channel } from '../base.js';
import {
  QClawCredentials,
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
import { QClawAuth } from './auth.js';
import { WS_URL, QClawIncomingMessage } from './types.js';
import { MessageAdapter } from '../../message/adapter.js';

export class QClawChannel extends Channel {
  private ws: WebSocket | null = null;
  private auth: QClawAuth;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isClosing = false;

  constructor(
    credentials: QClawCredentials,
    connectionConfig?: ConnectionConfig,
    messageConfig?: MessageConfig,
    loggerConfig?: LoggerConfig,
  ) {
    super(credentials, connectionConfig, messageConfig, loggerConfig);
    this.auth = new QClawAuth();
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('QClaw channel initialized');
  }

  protected async onConnect(): Promise<void> {
    const creds = this.credentials as QClawCredentials;
    const wsUrl = creds.wsUrl ?? WS_URL;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, this.connectionConfig.timeout ?? 5000);

      this.ws = new WebSocket(wsUrl);

      this.ws.once('open', () => {
        clearTimeout(timeout);
        this.logger.info('WebSocket connected, sending auth');
        const authPayload = this.auth.buildAuthPayload(creds);
        this.ws!.send(JSON.stringify(authPayload));
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return MessageAdapter.createErrorResponse('WebSocket not connected');
    }

    const creds = this.credentials as QClawCredentials;
    const msgId = `qclaw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = {
      type: 'message',
      toUser: request.to,
      fromUser: creds.userId ?? creds.guid!,
      content: request.content,
      msgId,
      timestamp: Date.now(),
    };

    return new Promise<SendMessageResponse>((resolve) => {
      try {
        this.ws!.send(JSON.stringify(payload), (err?: Error) => {
          if (err) {
            resolve(MessageAdapter.createErrorResponse(err.message));
          } else {
            resolve(MessageAdapter.createSuccessResponse(msgId));
          }
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        resolve(MessageAdapter.createErrorResponse(msg));
      }
    });
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
    const creds = this.credentials as QClawCredentials;
    const updated = await this.auth.refreshToken(creds);
    this.updateCredentials(updated);
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.on('message', (data: Buffer | string) => {
      try {
        const text = data instanceof Buffer ? data.toString('utf-8') : String(data);
        const parsed: QClawIncomingMessage = JSON.parse(text);
        this.handleIncomingMessage(parsed);
      } catch {
        this.logger.warn('Failed to parse incoming QClaw message');
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.info('WebSocket closed', { code, reason: reason?.toString() });
      this.stopHeartbeat();
      if (!this.isClosing && this.state !== ConnectionState.CLOSING) {
        this.handleDisconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
    });
  }

  private handleIncomingMessage(msg: QClawIncomingMessage): void {
    if (msg.type === 'message' && msg.fromUser && msg.content) {
      const creds = this.credentials as QClawCredentials;
      const message: Message = MessageAdapter.agpToMessage(
        {
          fromUser: msg.fromUser,
          toUser: msg.toUser ?? creds.userId ?? creds.guid!,
          content: msg.content,
          msgId: msg.msgId,
          timestamp: msg.timestamp,
          msgType: 'text',
        },
        creds.userId ?? creds.guid!,
      );
      this.dispatchMessage(message);
    }
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
    this.logger.info('Scheduling reconnect', { attempt: this.reconnectAttempts, interval });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.onConnect();
        this.setState(ConnectionState.CONNECTED);
        this.reconnectAttempts = 0;
        this.emit('connected');
      } catch (err) {
        this.logger.error('Reconnect failed', err);
        this.handleDisconnect();
      }
    }, interval);
  }

  private startHeartbeat(): void {
    const interval = this.connectionConfig.heartbeatInterval ?? 30000;
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
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
