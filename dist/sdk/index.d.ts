/**
 * @file src/sdk/index.ts
 * @description 主SDK类
 *
 * WeChatSDK 是使用者直接交互的主入口，提供统一的API接口。
 * 它聚合了不同的通信方式（QClaw、WorkBuddy），根据配置自动选择或创建相应的通道实现。
 */
import { EventEmitter } from 'events';
import { SDKConfig, SDKEventMap, ConnectionState, SendMessageRequest, SendMessageResponse, ChannelCredentials, EventListener } from './types.js';
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
export declare class WeChatSDK extends EventEmitter {
    private config;
    private channel;
    private logger;
    private isConnected;
    constructor(config?: SDKConfig);
    /**
     * 连接到微信服务
     *
     * 步骤：
     * 1. 验证配置和凭证
     * 2. 选择合适的通信方式（如果是auto模式）
     * 3. 创建平台特定的通道实例
     * 4. 初始化和连接通道
     */
    connect(): Promise<void>;
    /**
     * 断开连接
     */
    disconnect(): Promise<void>;
    /**
     * 检查连接状态
     */
    isConnectedState(): boolean;
    /**
     * 获取连接状态
     */
    getConnectionState(): ConnectionState;
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
    sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
    /**
     * 刷新凭证（如token过期）
     */
    refreshCredentials(): Promise<void>;
    /**
     * 获取当前凭证
     */
    getCredentials(): ChannelCredentials | undefined;
    /**
     * 更新凭证
     *
     * 用于在运行时更新凭证（例如刷新token）
     */
    updateCredentials(credentials: ChannelCredentials): void;
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
    on<K extends keyof SDKEventMap>(event: K, listener: EventListener<K>): this;
    /**
     * 监听事件（仅一次）
     */
    once<K extends keyof SDKEventMap>(event: K, listener: EventListener<K>): this;
    /**
     * 移除事件监听
     */
    off<K extends keyof SDKEventMap>(event: K, listener: EventListener<K>): this;
    /**
     * 规范化和验证SDK配置
     */
    private normalizeConfig;
    /**
     * 创建通道实例
     */
    private createChannel;
    /**
     * 创建QClaw通道
     */
    private createQClawChannel;
    /**
     * 创建WorkBuddy通道
     */
    private createWorkBuddyChannel;
    /**
     * 选择通信模式
     */
    private selectMode;
    /**
     * 自动选择最合适的通信模式
     */
    private autoSelectMode;
    /**
     * 设置事件转发（将通道事件转发给SDK）
     */
    private setupEventForwarding;
    /**
     * 验证发送请求
     */
    private validateSendRequest;
}
export * from './types.js';
export * from './error.js';
export { Logger } from './utils/logger.js';
export { Channel } from './channels/base.js';
