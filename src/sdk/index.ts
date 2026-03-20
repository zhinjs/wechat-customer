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
  LoginRequiredPayload,
} from './types.js';
import {
  WeChatSDKError,
  ConnectionError,
  ConfigurationError,
  ValidationError,
  LoginRequiredError,
} from './error.js';
import { Channel } from './channels/base.js';
import { QClawChannel } from './channels/qclaw/client.js';
import { WorkBuddyChannel } from './channels/workbuddy/client.js';
import { Logger } from './utils/logger.js';
import { Storage } from './utils/storage.js';

/** Key used when persisting session credentials to the mode-specific storage directory. */
const SESSION_KEY = 'session';

/**
 * Key used when persisting device-level info (guid) for QClaw.
 * Mirrors the oicq pattern: device.json never expires; session.json may be cleared on re-login.
 */
const DEVICE_KEY = 'device';

/**
 * WeChat 通信SDK
 * 
 * 统一的微信通信接口，支持 QClaw 和 WorkBuddy 两种通信方式。
 * mode 为必填，会话凭证自动从 `~/.wechat-sdk/{mode}/session.json` 加载。
 * 
 * 首次启动示例（QClaw）：
 * ```typescript
 * const sdk = new WeChatSDK({ mode: 'qclaw' });
 * 
 * sdk.on('loginRequired', ({ guid }) => {
 *   // 用 guid 发起扫码登录，拿到 channelToken/jwtToken 后：
 *   sdk.updateCredentials({ mode: 'qclaw', channelToken, jwtToken });
 *   sdk.connect();
 * });
 * 
 * await sdk.connect(); // 首次：触发 loginRequired；此后：自动从会话文件恢复
 * ```
 * 
 * 二次启动示例：
 * ```typescript
 * const sdk = new WeChatSDK({ mode: 'qclaw' });
 * await sdk.connect(); // 自动加载 ~/.wechat-sdk/qclaw/session.json
 * ```
 */
export class WeChatSDK extends EventEmitter {
  private config: Required<SDKConfig>;
  private channel: Channel | null = null;
  private logger: Logger;
  private isConnected = false;
  private storage: Storage;
  
  constructor(config: SDKConfig) {
    super();
    this.config = this.normalizeConfig(config);
    this.logger = new Logger('WeChatSDK', this.config.logger);
    // Per-mode storage: ~/.wechat-sdk/qclaw/ or ~/.wechat-sdk/workbuddy/
    const baseDir = this.config.storage.dir ?? '~/.wechat-sdk';
    this.storage = new Storage(`${baseDir}/${this.config.mode}`);
    this.setupEventForwarding();
  }

  // ────────────── 生命周期方法 ──────────────

  /**
   * 连接到微信服务
   * 
   * 步骤：
   * 1. 若未提供凭证，尝试从本地会话文件自动恢复（~/.wechat-sdk/{mode}/session.json）
   * 2. 若仍无凭证，触发 loginRequired 事件并抛出 LoginRequiredError
   *    - QClaw：事件携带已生成的设备 GUID，供应用发起扫码登录
   *    - WorkBuddy：事件携带 mode，应用自行发起 OAuth 流程
   * 3. QClaw 模式：确保 guid 存在（自动生成并保存到 device.json）
   * 4. 创建通道并连接
   * 5. 连接成功后将凭证持久化到会话文件（enablePersist=true 时）
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.warn('已经连接，跳过重复连接');
      return;
    }

    try {
      this.logger.info('开始连接...', { mode: this.config.mode });

      // 1. 若未提供凭证，尝试从本地会话文件自动恢复
      if (!this.config.credentials && this.config.storage.enablePersist) {
        const saved = await this.storage.load<ChannelCredentials>(SESSION_KEY);
        if (saved) {
          this.logger.info('从本地会话文件恢复凭证');
          this.config.credentials = saved;
        }
      }

      // 2. 仍无凭证 → 触发初始化流程
      if (!this.config.credentials) {
        if (this.config.mode === 'qclaw') {
          // 先确保 guid 存在，以便在事件中携带
          const guid = await this.ensureDeviceGuid();
          const payload: LoginRequiredPayload = { mode: 'qclaw', guid };
          this.emit('loginRequired', payload);
          throw new LoginRequiredError('qclaw', guid);
        } else {
          const payload: LoginRequiredPayload = { mode: 'workbuddy' };
          this.emit('loginRequired', payload);
          throw new LoginRequiredError('workbuddy');
        }
      }

      // 3. QClaw：确保 guid 存在（可能已在凭证中，也可能需要从 device.json 加载/生成）
      if (this.config.mode === 'qclaw') {
        this.config.credentials = await this.ensureDeviceInfo(
          this.config.credentials as QClawCredentials,
        );
      }

      // 4. 创建通道
      this.channel = this.createChannel();

      // 5. 连接
      await this.channel.connect();
      this.isConnected = true;
      this.logger.info('连接成功');

      // 6. 持久化凭证
      if (this.config.storage.enablePersist) {
        const creds = this.channel.getCredentials();
        await this.storage.save(SESSION_KEY, creds);
        this.logger.debug('会话凭证已保存');
      }

      this.emit('connected');
    } catch (error) {
      this.isConnected = false;
      this.logger.error('连接失败', error as Error);
      const sdkError = error instanceof Error ? error : new Error(String(error));
      if (!(error instanceof LoginRequiredError)) {
        this.emit('error', sdkError);
      }
      throw sdkError;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.channel) {
      return;
    }

    try {
      await this.channel.disconnect();
      this.isConnected = false;
      this.logger.info('连接已断开');
      this.emit('disconnected', { reason: 'user' });
    } catch (error) {
      this.logger.error('断开连接失败', error as Error);
      throw error;
    }
  }

  // ────────────── 消息方法 ──────────────

  /**
   * 发送消息
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    if (!this.channel) {
      throw new ConnectionError('通道实例不存在，请先调用 connect()');
    }

    if (!this.isConnected) {
      throw new ConnectionError('未连接到服务，请先调用 connect()');
    }

    this.validateSendRequest(request);

    try {
      return await this.channel.sendMessage(request);
    } catch (error) {
      this.logger.error('发送消息失败', error as Error);
      throw error;
    }
  }

  // ────────────── 状态方法 ──────────────

  /**
   * 检查是否已连接
   */
  isConnectedState(): boolean {
    return this.isConnected;
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionState {
    return this.channel?.getState() ?? ConnectionState.DISCONNECTED;
  }

  // ────────────── 凭证管理 ──────────────

  /**
   * 刷新凭证（如token过期），刷新后自动持久化
   */
  async refreshCredentials(): Promise<void> {
    if (!this.channel) {
      throw new ConfigurationError('通道实例不存在');
    }

    try {
      this.logger.info('刷新凭证...');
      await this.channel.refreshCredentials();
      
      const updatedCreds = this.channel.getCredentials();
      this.config.credentials = updatedCreds;

      if (this.config.storage.enablePersist) {
        await this.storage.save(SESSION_KEY, updatedCreds);
        this.logger.debug('刷新后的凭证已保存');
      }
      
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
   * 用于在运行时更新凭证（例如首次登录拿到 token 后注入，或 token 刷新）。
   * 不会触发网络请求，也不会自动持久化。
   */
  updateCredentials(credentials: ChannelCredentials): void {
    this.config.credentials = credentials;
    if (this.channel) {
      // 具体实现取决于通道类型
    }
  }

  // ────────────── 会话管理 ──────────────

  /**
   * 检查是否存在本地保存的会话凭证
   */
  async hasSavedSession(): Promise<boolean> {
    return this.storage.exists(SESSION_KEY);
  }

  /**
   * 加载本地保存的会话凭证（不建立连接）
   */
  async loadSavedCredentials(): Promise<ChannelCredentials | null> {
    return this.storage.load<ChannelCredentials>(SESSION_KEY);
  }

  /**
   * 清除本地保存的会话凭证
   * 
   * 下次启动时需要重新提供凭证。
   * 注意：设备 GUID（device.json）不会被清除，如需清除请调用 clearDevice()。
   */
  async clearSession(): Promise<void> {
    await this.storage.delete(SESSION_KEY);
    this.logger.info('本地会话凭证已清除');
  }

  // ────────────── 设备管理（QClaw 专用） ──────────────

  /**
   * 检查是否存在本地持久化的设备信息（device.json）
   * 
   * QClaw 模式专用。device.json 与 session.json 分开：
   * - device.json：设备 GUID，首次生成后永久保存，clearSession() 不清除
   * - session.json：登录凭证（channelToken/jwtToken），可能过期
   */
  async hasSavedDevice(): Promise<boolean> {
    return this.storage.exists(DEVICE_KEY);
  }

  /**
   * 获取或生成设备 GUID（QClaw 模式专用）
   * 
   * 可在调用 connect() 前用于获取设备标识，以发起扫码登录流程。
   * - 若 device.json 已有 guid，直接返回
   * - 若没有，生成新 UUID 并保存
   */
  async getOrCreateDeviceGuid(): Promise<string> {
    return this.ensureDeviceGuid();
  }

  /**
   * 清除本地保存的设备信息（device.json）
   * 
   * 调用后下次 QClaw 连接时会生成新的设备 GUID（相当于换了一台设备）。
   * 通常不需要调用此方法，除非需要重置设备标识。
   */
  async clearDevice(): Promise<void> {
    await this.storage.delete(DEVICE_KEY);
    this.logger.info('本地设备信息已清除');
  }

  // ────────────── 事件方法 ──────────────

  /**
   * 监听SDK事件
   */
  override on<K extends keyof SDKEventMap>(
    event: K,
    listener: EventListener<K>,
  ): this {
    return super.on(event, listener as any);
  }

  override once<K extends keyof SDKEventMap>(
    event: K,
    listener: EventListener<K>,
  ): this {
    return super.once(event, listener as any);
  }

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
      mode: config.mode,
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
    const mode = this.config.mode;
    this.logger.info('创建通道', { mode });

    if (mode === 'qclaw') {
      return this.createQClawChannel();
    } else {
      return this.createWorkBuddyChannel();
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
   * 设置事件转发（将通道事件转发给SDK）
   */
  private setupEventForwarding(): void {
    // Channel events are forwarded via setupChannelEvents() when a channel is created
  }

  /**
   * 获取或生成设备 GUID（QClaw 内部使用）
   */
  private async ensureDeviceGuid(): Promise<string> {
    if (this.config.storage.enablePersist) {
      const device = await this.storage.load<{ guid: string }>(DEVICE_KEY);
      if (device?.guid) {
        return device.guid;
      }
    }

    const { randomUUID } = await import('crypto');
    const guid = randomUUID();
    this.logger.info('首次运行，自动生成设备 GUID', { guid });
    if (this.config.storage.enablePersist) {
      await this.storage.save(DEVICE_KEY, { guid });
    }
    return guid;
  }

  /**
   * 确保 QClaw 凭证中包含设备 GUID（oicq device.json 模式）
   * 
   * 处理逻辑：
   * 1. 若凭证中已有 guid，持久化到 device.json 后直接使用
   * 2. 若没有 guid，通过 ensureDeviceGuid() 加载或生成
   */
  private async ensureDeviceInfo(
    creds: QClawCredentials,
  ): Promise<QClawCredentials & { guid: string }> {
    if (creds.guid) {
      if (this.config.storage.enablePersist) {
        await this.storage.save(DEVICE_KEY, { guid: creds.guid });
      }
      return creds as QClawCredentials & { guid: string };
    }

    const guid = await this.ensureDeviceGuid();
    this.logger.info('从设备文件恢复或生成 GUID', { guid });
    return { ...creds, guid };
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
export { Storage } from './utils/storage.js';
