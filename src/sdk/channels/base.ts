/**
 * @file src/sdk/channels/base.ts
 * @description 通道基础接口和抽象类
 * 
 * 所有具体的通信实现（QClaw、WorkBuddy等）都必须继承这个基类，
 * 从而定義統一的接口，使SDK可以通过多态来处理不同的通信方式。
 */

import { EventEmitter } from 'events';
import {
  ConnectionState,
  Message,
  SendMessageRequest,
  SendMessageResponse,
  ChannelCredentials,
  LoggerConfig,
  ConnectionConfig,
  MessageConfig,
} from '../types.js';
import { Logger } from '../utils/logger.js';

/**
 * 通道接口 - 定义所有通道必须实现的方法
 */
export interface IChannel extends EventEmitter {
  // ────────────── 生命周期 ──────────────
  
  /** 初始化通道 */
  initialize(): Promise<void>;
  
  /** 连接到服务 */
  connect(): Promise<void>;
  
  /** 断开连接 */
  disconnect(): Promise<void>;
  
  /** 检查连接状态 */
  isConnected(): boolean;
  
  /** 获取当前连接状态 */
  getState(): ConnectionState;
  
  // ────────────── 消息处理 ──────────────
  
  /** 发送消息 */
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  
  /** 发送原始数据 */
  sendRaw(data: unknown): Promise<void>;
  
  // ────────────── 认证管理 ──────────────
  
  /** 刷新凭证 */
  refreshCredentials(): Promise<void>;
  
  /** 获取当前凭证 */
  getCredentials(): ChannelCredentials;
  
  // ────────────── 事件 ──────────────
  
  /** 当连接成功建立 */
  on(event: 'connected', listener: () => void): this;
  
  /** 当连接断开 */
  on(event: 'disconnected', listener: (reason?: string) => void): this;
  
  /** 当收到消息 */
  on(event: 'message', listener: (message: Message) => void): this;
  
  /** 当发生错误 */
  on(event: 'error', listener: (error: Error) => void): this;
  
  /** 当token刷新 */
  on(event: 'tokenRefreshed', listener: () => void): this;
}

/**
 * 通道抽象基类
 * 
 * 提供公共的功能实现，具体通道只需实现特定的抽象方法。
 * 这个设计遵循Template Method模式。
 */
export abstract class Channel extends EventEmitter implements IChannel {
  protected state: ConnectionState = ConnectionState.DISCONNECTED;
  protected credentials: ChannelCredentials;
  protected logger: Logger;
  protected isInitialized = false;
  
  constructor(
    credentials: ChannelCredentials,
    protected connectionConfig: ConnectionConfig = {},
    protected messageConfig: MessageConfig = {},
    loggerConfig?: LoggerConfig,
  ) {
    super();
    this.credentials = credentials;
    this.logger = new Logger('Channel', loggerConfig);
  }
  
  // ────────────── 生命周期相关 ──────────────
  
  /**
   * 初始化通道
   * 
   * 仅调用一次，用于进行必要的初始化工作。
   * 具体实现由子类提供。
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.logger.info('初始化通道...');
    await this.onInitialize();
    this.isInitialized = true;
    this.logger.info('通道初始化完成');
  }
  
  /**
   * 连接到服务
   * 
   * 建立与服务的连接，包括WebSocket、HTTP等。
   * 具体实现由子类提供。
   */
  async connect(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.state === ConnectionState.CONNECTED) {
      this.logger.warn('已经连接，跳过');
      return;
    }
    
    this.state = ConnectionState.CONNECTING;
    this.logger.info('连接中...');
    
    try {
      await this.onConnect();
      this.state = ConnectionState.CONNECTED;
      this.logger.info('连接成功');
      this.emit('connected');
    } catch (error) {
      this.state = ConnectionState.DISCONNECTED;
      this.logger.error('连接失败', error);
      throw error;
    }
  }
  
  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.state === ConnectionState.DISCONNECTED) {
      return;
    }
    
    this.state = ConnectionState.CLOSING;
    this.logger.info('断开连接中...');
    
    try {
      await this.onDisconnect();
      this.state = ConnectionState.DISCONNECTED;
      this.logger.info('连接已关闭');
      this.emit('disconnected');
    } catch (error) {
      this.state = ConnectionState.DISCONNECTED;
      this.logger.error('断开连接时出错', error);
      throw error;
    }
  }
  
  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }
  
  /**
   * 获取当前连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }
  
  // ────────────── 消息处理 ──────────────
  
  /**
   * 发送消息
   * 
   * 模板方法：先验证，再发送，最后处理响应。
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    // 验证参数
    if (!request.to || !request.content) {
      throw new Error('消息参数无效：to和content不能为空');
    }
    
    if (!this.isConnected()) {
      throw new Error('通道仍未连接');
    }
    
    this.logger.debug('发送消息', { to: request.to, contentLen: request.content.length });
    
    try {
      const response = await this.onSendMessage(request);
      this.logger.debug('消息发送成功', { messageId: response.messageId });
      return response;
    } catch (error) {
      this.logger.error('消息发送失败', error);
      throw error;
    }
  }
  
  /**
   * 发送原始数据（用于高级用途）
   */
  async sendRaw(data: unknown): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('通道仍未连接');
    }
    
    await this.onSendRaw(data);
  }
  
  // ────────────── 凭证管理 ──────────────
  
  /**
   * 刷新凭证（如token过期）
   */
  async refreshCredentials(): Promise<void> {
    this.logger.info('刷新凭证...');
    
    try {
      await this.onRefreshCredentials();
      this.logger.info('凭证刷新成功');
      this.emit('tokenRefreshed');
    } catch (error) {
      this.logger.error('凭证刷新失败', error);
      throw error;
    }
  }
  
  /**
   * 获取凭证
   */
  getCredentials(): ChannelCredentials {
    return { ...this.credentials };
  }
  
  // ────────────── 保护方法（供子类使用） ──────────────
  
  /**
   * 更新凭证
   * @protected
   */
  protected updateCredentials(partial: Partial<ChannelCredentials>): void {
    this.credentials = { ...this.credentials, ...partial } as ChannelCredentials;
  }
  
  /**
   * 分派消息事件
   * @protected
   */
  protected dispatchMessage(message: Message): void {
    this.logger.debug('分派消息事件', { messageId: message.id });
    this.emit('message', message);
  }
  
  /**
   * 分派错误事件
   * @protected
   */
  protected dispatchError(error: Error): void {
    this.logger.error('分派错误事件', error);
    this.emit('error', error);
  }
  
  /**
   * 设置连接状态
   * @protected
   */
  protected setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.logger.debug('状态变化', { from: this.state, to: state });
      this.state = state;
    }
  }
  
  // ────────────── 抽象方法（子类必须实现） ──────────────
  
  /**
   * 初始化具体实现
   * @protected
   * @abstract
   */
  protected abstract onInitialize(): Promise<void>;
  
  /**
   * 连接具体实现
   * @protected
   * @abstract
   */
  protected abstract onConnect(): Promise<void>;
  
  /**
   * 断开连接具体实现
   * @protected
   * @abstract
   */
  protected abstract onDisconnect(): Promise<void>;
  
  /**
   * 发送消息具体实现
   * @protected
   * @abstract
   */
  protected abstract onSendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  
  /**
   * 发送原始数据具体实现
   * @protected
   * @abstract
   */
  protected abstract onSendRaw(data: unknown): Promise<void>;
  
  /**
   * 刷新凭证具体实现
   * @protected
   * @abstract
   */
  protected abstract onRefreshCredentials(): Promise<void>;
}
