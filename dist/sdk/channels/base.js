/**
 * @file src/sdk/channels/base.ts
 * @description 通道基础接口和抽象类
 *
 * 所有具体的通信实现（QClaw、WorkBuddy等）都必须继承这个基类，
 * 从而定義統一的接口，使SDK可以通过多态来处理不同的通信方式。
 */
import { EventEmitter } from 'events';
import { ConnectionState, } from '../types.js';
import { Logger } from '../utils/logger.js';
/**
 * 通道抽象基类
 *
 * 提供公共的功能实现，具体通道只需实现特定的抽象方法。
 * 这个设计遵循Template Method模式。
 */
export class Channel extends EventEmitter {
    constructor(credentials, connectionConfig = {}, messageConfig = {}, loggerConfig) {
        super();
        this.connectionConfig = connectionConfig;
        this.messageConfig = messageConfig;
        this.state = ConnectionState.DISCONNECTED;
        this.isInitialized = false;
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
    async initialize() {
        if (this.isInitialized)
            return;
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
    async connect() {
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
        }
        catch (error) {
            this.state = ConnectionState.DISCONNECTED;
            this.logger.error('连接失败', error);
            throw error;
        }
    }
    /**
     * 断开连接
     */
    async disconnect() {
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
        }
        catch (error) {
            this.state = ConnectionState.DISCONNECTED;
            this.logger.error('断开连接时出错', error);
            throw error;
        }
    }
    /**
     * 检查是否已连接
     */
    isConnected() {
        return this.state === ConnectionState.CONNECTED;
    }
    /**
     * 获取当前连接状态
     */
    getState() {
        return this.state;
    }
    // ────────────── 消息处理 ──────────────
    /**
     * 发送消息
     *
     * 模板方法：先验证，再发送，最后处理响应。
     */
    async sendMessage(request) {
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
        }
        catch (error) {
            this.logger.error('消息发送失败', error);
            throw error;
        }
    }
    /**
     * 发送原始数据（用于高级用途）
     */
    async sendRaw(data) {
        if (!this.isConnected()) {
            throw new Error('通道仍未连接');
        }
        await this.onSendRaw(data);
    }
    // ────────────── 凭证管理 ──────────────
    /**
     * 刷新凭证（如token过期）
     */
    async refreshCredentials() {
        this.logger.info('刷新凭证...');
        try {
            await this.onRefreshCredentials();
            this.logger.info('凭证刷新成功');
            this.emit('tokenRefreshed');
        }
        catch (error) {
            this.logger.error('凭证刷新失败', error);
            throw error;
        }
    }
    /**
     * 获取凭证
     */
    getCredentials() {
        return { ...this.credentials };
    }
    // ────────────── 保护方法（供子类使用） ──────────────
    /**
     * 更新凭证
     * @protected
     */
    updateCredentials(partial) {
        this.credentials = { ...this.credentials, ...partial };
    }
    /**
     * 分派消息事件
     * @protected
     */
    dispatchMessage(message) {
        this.logger.debug('分派消息事件', { messageId: message.id });
        this.emit('message', message);
    }
    /**
     * 分派错误事件
     * @protected
     */
    dispatchError(error) {
        this.logger.error('分派错误事件', error);
        this.emit('error', error);
    }
    /**
     * 设置连接状态
     * @protected
     */
    setState(state) {
        if (this.state !== state) {
            this.logger.debug('状态变化', { from: this.state, to: state });
            this.state = state;
        }
    }
}
//# sourceMappingURL=base.js.map