/**
 * @file src/sdk/index.ts
 * @description 主SDK类
 * 
 * WeChatSDK 是使用者直接交互的主入口，提供统一的API接口。
 * 它聚合了不同的通信方式（QClaw、WorkBuddy），根据配置自动选择或创建相应的通道实现。
 */

import { EventEmitter } from 'events';
import {
  SDKConfig,
  SDKEventMap,
  CommunicationMode,
  ConnectionState,
  Message,
  SendMessageRequest,
  SendMessageResponse,
  ChannelCredentials,
  QClawCredentials,
  WorkBuddyCredentials,
  EventListener,
} from './types.js';
import {
  WeChatSDKError,
  ConnectionError,
  ConfigurationError,
  ValidationError,
} from './error.js';
import { Channel } from './channels/base.js';
import { QClawChannel } from './channels/qclaw/client.js';
import { WorkBuddyChannel } from './channels/workbuddy/client.js';
import { Logger } from './utils/logger.js';

/**
 * WeChat 通信SDK
 * 
 * 统一的微信通信接口，同时支持QClaw和WorkBuddy两种通信方式。
 * 
 * 使用示例：
 * ```typescript
 * const sdk = new WeChatSDK({
 *   mode: 'auto',
 *   credentials: { ... }
 * });
 * 
 * await sdk.connect();
 * sdk.on('message', (msg) => {
 *   console.log('收到消息:', msg.content);
 * });
 * 
 * await sdk.sendMessage({ to: 'user_id', content: '你好' });
 * await sdk.disconnect();
 * ```
 */
export class WeChatSDK extends EventEmitter {
  private config: Required<SDKConfig>;
  private channel: Channel | null = null;
  private logger: Logger;
  private isConnected = false;
  
  constructor(config: SDKConfig = {}) {
    super();
    this.config = this.normalizeConfig(config);
    this.logger = new Logger('WeChatSDK', this.config.logger);
    this.setupEventForwarding();
  }

  // ────────────── 生命周期方法 ──────────────

  /**
   * 连接到微信服务
   * 
   * 步骤：
   * 1. 验证配置和凭证
   * 2. 选择合适的通信方式（如果是auto模式）
   * 3. 创建平台特定的通道实例
   * 4. 初始化和连接通道
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.warn('已经连接，跳过重复连接');
      return;
    }

    try {
      this.logger.info('开始连接...');

      // 验证凭证
      if (!this.config.credentials) {
        throw new ConfigurationError('缺少凭证配置');
      }

      // 创建通道
      this.channel = this.createChannel();
      if (!this.channel) {
        throw new ConfigurationError('无法创建通道实例');
      }

      // 连接
      await this.channel.connect();
      this.isConnected = true;
      this.logger.info('连接成功');
      this.emit('connected');
    } catch (error) {
      this.isConnected = false;
      this.logger.error('连接失败', error as Error);
      const sdkError = error instanceof Error ? error : new Error(String(error));
      this.emit('error', sdkError);
      throw sdkError;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('未连接，跳过断开连接');
      return;
    }

    try {
      this.logger.info('开始断开连接...');
      if (this.channel) {
        await this.channel.disconnect();
      }
      this.isConnected = false;
      this.logger.info('连接已断开');
      this.emit('disconnected', { reason: 'user' });
    } catch (error) {
      this.logger.error('断开连接时出错', error as Error);
      throw error;
    }
  }

  /**
   * 检查连接状态
   */
  isConnectedState(): boolean {
    return this.isConnected && this.channel?.isConnected() === true;
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionState {
    return this.channel?.getState() ?? ConnectionState.DISCONNECTED;
  }

  // ────────────── 消息方法 ──────────────

  /**
   * 发送消息
   * 
   * @param request 消息请求
   * @returns 发送响应
   * 
   * @example
   * ```typescript
   * const response = await sdk.sendMessage({
   *   to: 'user123',
   *   content: '你好，世界！',
   *   type: MessageType.TEXT,
   * });
   * 
   * if (response.success) {
   *   console.log('消息已发送:', response.messageId);
   * } else {
   *   console.error('消息发送失败:', response.error);
   * }
   * ```
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    if (!this.channel) {
      throw new ConnectionError('通道实例不存在，请先调用 connect()');
    }

    if (!this.isConnected) {
      throw new ConnectionError('未连接到服务，请先调用 connect()');
    }

    // 验证请求参数
    this.validateSendRequest(request);

    try {
      this.logger.debug('发送消息', { to: request.to });
      const response = await this.channel.sendMessage(request);
      
      if (response.success) {
        this.logger.debug('消息发送成功', { messageId: response.messageId });
      } else {
        this.logger.warn('消息发送失败', { error: response.error });
      }
      
      return response;
    } catch (error) {
      this.logger.error('发送消息时出错', error as Error);
      throw error;
    }
  }

  // ────────────── 凭证管理 ──────────────

  /**
   * 刷新凭证（如token过期）
   */
  async refreshCredentials(): Promise<void> {
    if (!this.channel) {
      throw new ConfigurationError('通道实例不存在');
    }

    try {
      this.logger.info('刷新凭证...');
      await this.channel.refreshCredentials();
      
      // 更新本地配置中的凭证
      const updatedCreds = this.channel.getCredentials();
      this.config.credentials = updatedCreds;
      
      this.logger.info('凭证已刷新');
    } catch (error) {
      this.logger.error('刷新凭证失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取当前凭证
   */
  getCredentials(): ChannelCredentials | undefined {
    return this.channel?.getCredentials() ?? this.config.credentials;
  }

  /**
   * 更新凭证
   * 
   * 用于在运行时更新凭证（例如刷新token）
   */
  updateCredentials(credentials: ChannelCredentials): void {
    this.config.credentials = credentials;
    if (this.channel) {
      // 通知通道更新凭证
      // 具体实现取决于通道类型
    }
  }

  // ────────────── 事件方法 ──────────────

  /**
   * 监听SDK事件
   * 
   * @example
   * ```typescript
   * sdk.on('connected', () => {
   *   console.log('已连接');
   * });
   * 
   * sdk.on('disconnected', ({ reason }) => {
   *   console.log('已断开:', reason);
   * });
   * 
   * sdk.on('message', (msg) => {
   *   console.log('收到消息:', msg.content);
   * });
   * 
   * sdk.on('error', (error) => {
   *   console.error('发生错误:', error);
   * });
   * ```
   */
  override on<K extends keyof SDKEventMap>(
    event: K,
    listener: EventListener<K>,
  ): this {
    return super.on(event, listener as any);
  }

  /**
   * 监听事件（仅一次）
   */
  override once<K extends keyof SDKEventMap>(
    event: K,
    listener: EventListener<K>,
  ): this {
    return super.once(event, listener as any);
  }

  /**
   * 移除事件监听
   */
  override off<K extends keyof SDKEventMap>(
    event: K,
    listener: EventListener<K>,
  ): this {
    return super.off(event, listener as any);
  }

  // ────────────── 私有方法 ──────────────

  /**
   * 规范化和验证SDK配置
   */
  private normalizeConfig(config: SDKConfig): Required<SDKConfig> {
    return {
      mode: config.mode ?? 'auto',
      credentials: config.credentials as ChannelCredentials,
      connection: {
        timeout: config.connection?.timeout ?? 5000,
        reconnectInterval: config.connection?.reconnectInterval ?? 3000,
        maxReconnectAttempts: config.connection?.maxReconnectAttempts ?? 10,
        heartbeatInterval: config.connection?.heartbeatInterval ?? 30000,
      },
      message: {
        timeout: config.message?.timeout ?? 30000,
        retryAttempts: config.message?.retryAttempts ?? 3,
        queueSize: config.message?.queueSize ?? 1000,
        persistUndelivered: config.message?.persistUndelivered ?? true,
      },
      logger: config.logger ?? { level: 'info' as any },
      storage: {
        dir: config.storage?.dir ?? '~/.wechat-sdk',
        enablePersist: config.storage?.enablePersist ?? true,
      },
    };
  }

  /**
   * 创建通道实例
   */
  private createChannel(): Channel {
    const mode = this.selectMode();
    this.logger.info('创建通道', { mode });

    // TODO: 根据mode创建具体的通道实例
    // 这里需要导入QClawChannel和WorkBuddyChannel
    // import { QClawChannel } from './channels/qclaw/client.js';
    // import { WorkBuddyChannel } from './channels/workbuddy/client.js';

    if (mode === 'qclaw') {
      return this.createQClawChannel();
    } else if (mode === 'workbuddy') {
      return this.createWorkBuddyChannel();
    } else {
      throw new ConfigurationError(`不支持的通信模式: ${mode}`);
    }
  }

  /**
   * 创建QClaw通道
   */
  private createQClawChannel(): Channel {
    const creds = this.config.credentials as QClawCredentials;
    const channel = new QClawChannel(creds, this.config.connection, this.config.message, this.config.logger);
    this.setupChannelEvents(channel);
    return channel;
  }

  /**
   * 创建WorkBuddy通道
   */
  private createWorkBuddyChannel(): Channel {
    const creds = this.config.credentials as WorkBuddyCredentials;
    const channel = new WorkBuddyChannel(creds, this.config.connection, this.config.message, this.config.logger);
    this.setupChannelEvents(channel);
    return channel;
  }

  /**
   * 设置通道事件转发
   */
  private setupChannelEvents(channel: Channel): void {
    channel.on('connected', () => this.emit('connected'));
    channel.on('disconnected', (reason) => {
      this.isConnected = false;
      this.emit('disconnected', { reason });
    });
    channel.on('message', (msg) => this.emit('message', msg));
    channel.on('error', (err) => this.emit('error', err));
    channel.on('tokenRefreshed', () => this.emit('tokenRefreshed'));
  }

  /**
   * 选择通信模式
   */
  private selectMode(): 'qclaw' | 'workbuddy' {
    const configMode = this.config.mode;

    if (configMode === 'auto') {
      return this.autoSelectMode();
    } else if (configMode === 'qclaw' || configMode === 'workbuddy') {
      return configMode;
    } else {
      throw new ConfigurationError(`不支持的通信模式: ${configMode}`);
    }
  }

  /**
   * 自动选择最合适的通信模式
   */
  private autoSelectMode(): 'qclaw' | 'workbuddy' {
    if (!this.config.credentials) {
      throw new ConfigurationError('缺少凭证，无法自动选择通信模式');
    }

    const mode = (this.config.credentials as any).mode;
    if (mode === 'qclaw' || mode === 'workbuddy') {
      return mode;
    }

    // 根据凭证特征推断模式
    const creds = this.config.credentials;
    if ('channelToken' in creds && 'guid' in creds) {
      this.logger.debug('自动选择: QClaw模式（检测到channelToken和guid）');
      return 'qclaw';
    } else if ('accessToken' in creds && 'userId' in creds) {
      this.logger.debug('自动选择: WorkBuddy模式（检测到accessToken和userId）');
      return 'workbuddy';
    }

    throw new ConfigurationError('无法从凭证推断通信模式，请指定mode或提供正确的凭证');
  }

  /**
   * 设置事件转发（将通道事件转发给SDK）
   */
  private setupEventForwarding(): void {
    // Channel events are forwarded via setupChannelEvents() when a channel is created
  }

  /**
   * 验证发送请求
   */
  private validateSendRequest(request: SendMessageRequest): void {
    if (!request.to || request.to.trim() === '') {
      throw new ValidationError('收件人ID不能为空');
    }

    if (!request.content || request.content.trim() === '') {
      throw new ValidationError('消息内容不能为空');
    }

    if (request.content.length > 4000) {
      throw new ValidationError('消息内容过长（最长4000字符）');
    }
  }
}

// 导出所有类型和错误
export * from './types.js';
export * from './error.js';
export { Logger } from './utils/logger.js';
export { Channel } from './channels/base.js';
