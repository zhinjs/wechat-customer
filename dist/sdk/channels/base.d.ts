/**
 * @file src/sdk/channels/base.ts
 * @description 通道基础接口和抽象类
 *
 * 所有具体的通信实现（QClaw、WorkBuddy等）都必须继承这个基类，
 * 从而定義統一的接口，使SDK可以通过多态来处理不同的通信方式。
 */
import { EventEmitter } from 'events';
import { ConnectionState, Message, SendMessageRequest, SendMessageResponse, ChannelCredentials, LoggerConfig, ConnectionConfig, MessageConfig } from '../types.js';
import { Logger } from '../utils/logger.js';
/**
 * 通道接口 - 定义所有通道必须实现的方法
 */
export interface IChannel extends EventEmitter {
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
    /** 发送消息 */
    sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
    /** 发送原始数据 */
    sendRaw(data: unknown): Promise<void>;
    /** 刷新凭证 */
    refreshCredentials(): Promise<void>;
    /** 获取当前凭证 */
    getCredentials(): ChannelCredentials;
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
export declare abstract class Channel extends EventEmitter implements IChannel {
    protected connectionConfig: ConnectionConfig;
    protected messageConfig: MessageConfig;
    protected state: ConnectionState;
    protected credentials: ChannelCredentials;
    protected logger: Logger;
    protected isInitialized: boolean;
    constructor(credentials: ChannelCredentials, connectionConfig?: ConnectionConfig, messageConfig?: MessageConfig, loggerConfig?: LoggerConfig);
    /**
     * 初始化通道
     *
     * 仅调用一次，用于进行必要的初始化工作。
     * 具体实现由子类提供。
     */
    initialize(): Promise<void>;
    /**
     * 连接到服务
     *
     * 建立与服务的连接，包括WebSocket、HTTP等。
     * 具体实现由子类提供。
     */
    connect(): Promise<void>;
    /**
     * 断开连接
     */
    disconnect(): Promise<void>;
    /**
     * 检查是否已连接
     */
    isConnected(): boolean;
    /**
     * 获取当前连接状态
     */
    getState(): ConnectionState;
    /**
     * 发送消息
     *
     * 模板方法：先验证，再发送，最后处理响应。
     */
    sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
    /**
     * 发送原始数据（用于高级用途）
     */
    sendRaw(data: unknown): Promise<void>;
    /**
     * 刷新凭证（如token过期）
     */
    refreshCredentials(): Promise<void>;
    /**
     * 获取凭证
     */
    getCredentials(): ChannelCredentials;
    /**
     * 更新凭证
     * @protected
     */
    protected updateCredentials(partial: Partial<ChannelCredentials>): void;
    /**
     * 分派消息事件
     * @protected
     */
    protected dispatchMessage(message: Message): void;
    /**
     * 分派错误事件
     * @protected
     */
    protected dispatchError(error: Error): void;
    /**
     * 设置连接状态
     * @protected
     */
    protected setState(state: ConnectionState): void;
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
