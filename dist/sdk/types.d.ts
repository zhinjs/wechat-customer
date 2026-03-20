/**
 * @file src/sdk/types.ts
 * @description SDK 通用类型定义
 */
/**
 * 支持的通信模式
 */
export type CommunicationMode = 'qclaw' | 'workbuddy' | 'auto';
/**
 * 连接状态
 */
export declare enum ConnectionState {
    DISCONNECTED = "disconnected",
    CONNECTING = "connecting",
    CONNECTED = "connected",
    RECONNECTING = "reconnecting",
    CLOSING = "closing"
}
/**
 * 消息类型
 */
export declare enum MessageType {
    TEXT = "text",
    IMAGE = "image",
    FILE = "file",
    CARD = "card",
    COMMAND = "command"
}
/**
 * 消息方向
 */
export declare enum MessageDirection {
    INBOUND = "inbound",// 接收
    OUTBOUND = "outbound"
}
/**
 * 消息状态
 */
export declare enum MessageStatus {
    PENDING = "pending",// 待发送
    SENDING = "sending",// 发送中
    SENT = "sent",// 已发送
    DELIVERED = "delivered",// 已送达
    FAILED = "failed",// 发送失败
    READ = "read"
}
/**
 * 统一消息格式
 */
export interface Message {
    /** 消息ID（唯一标识） */
    id: string;
    /** 消息类型 */
    type: MessageType;
    /** 消息方向（收/发） */
    direction: MessageDirection;
    /** 消息内容 */
    content: string;
    /** 发送者ID */
    from: string;
    /** 接收者ID */
    to: string;
    /** 发送时间戳（毫秒） */
    timestamp: number;
    /** 消息状态 */
    status: MessageStatus;
    /** 元数据（灵活扩展字段） */
    metadata?: Record<string, any>;
    /** 关联的会话ID */
    sessionId?: string;
    /** 回复的消息ID */
    replyTo?: string;
}
/**
 * 发送消息的请求参数
 */
export interface SendMessageRequest {
    /** 接收者ID */
    to: string;
    /** 消息内容 */
    content: string;
    /** 消息类型（默认：文本） */
    type?: MessageType;
    /** 是否需要已读回执 */
    needReceipt?: boolean;
    /** 元数据 */
    metadata?: Record<string, any>;
    /** 超时时间（毫秒） */
    timeout?: number;
}
/**
 * 发送消息的响应
 */
export interface SendMessageResponse {
    /** 是否成功 */
    success: boolean;
    /** 消息ID */
    messageId?: string;
    /** 错误信息 */
    error?: string;
    /** 时间戳 */
    timestamp: number;
}
/**
 * SDK事件映射
 */
export interface SDKEventMap {
    'connected': void;
    'disconnected': {
        reason?: string;
    };
    'message': Message;
    'error': Error;
    'tokenRefreshed': void;
    'reconnecting': {
        attempt: number;
        nextRetryIn: number;
    };
}
/**
 * 事件监听器类型
 */
export type EventListener<K extends keyof SDKEventMap> = (data: SDKEventMap[K]) => Promise<void> | void;
/**
 * 核心SDK配置
 */
export interface SDKConfig {
    /** 通信模式 */
    mode?: CommunicationMode;
    /** 凭证信息 */
    credentials?: ChannelCredentials;
    /** 连接配置 */
    connection?: ConnectionConfig;
    /** 消息配置 */
    message?: MessageConfig;
    /** 日志配置 */
    logger?: LoggerConfig;
    /** 存储配置 */
    storage?: StorageConfig;
}
/**
 * 通道凭证（支持QClaw和WorkBuddy） */
export type ChannelCredentials = QClawCredentials | WorkBuddyCredentials;
/**
 * QClaw凭证
 */
export interface QClawCredentials {
    mode: 'qclaw';
    /** 设备GUID */
    guid: string;
    /** 渠道Token */
    channelToken: string;
    /** JWT Token */
    jwtToken: string;
    /** API Key（模型调用用） */
    apiKey?: string;
    /** 用户ID */
    userId?: string;
    /** WebSocket URL */
    wsUrl?: string;
    /** 用户信息 */
    userInfo?: Record<string, any>;
}
/**
 * WorkBuddy凭证
 */
export interface WorkBuddyCredentials {
    mode: 'workbuddy';
    /** 用户ID */
    userId: string;
    /** 访问Token */
    accessToken: string;
    /** 刷新Token */
    refreshToken?: string;
    /** 主机ID */
    hostId?: string;
    /** 基础URL */
    baseUrl?: string;
    /** 用户信息 */
    userInfo?: Record<string, any>;
}
/**
 * 连接配置
 */
export interface ConnectionConfig {
    /** 连接超时时间（毫秒，默认5000） */
    timeout?: number;
    /** 重连间隔（毫秒，默认3000） */
    reconnectInterval?: number;
    /** 最大重连次数（默认10） */
    maxReconnectAttempts?: number;
    /** 心跳间隔（毫秒，默认30000） */
    heartbeatInterval?: number;
}
/**
 * 消息配置
 */
export interface MessageConfig {
    /** 消息发送超时（毫秒，默认30000） */
    timeout?: number;
    /** 重试次数（默认3） */
    retryAttempts?: number;
    /** 队列大小（默认1000） */
    queueSize?: number;
    /** 是否持久化未送达消息 */
    persistUndelivered?: boolean;
}
/**
 * 日志配置
 */
export interface LoggerConfig {
    /** 日志级别（默认info） */
    level?: LogLevel;
    /** 自定义输出函数 */
    output?: (log: LogEntry) => void;
    /** 是否输出到控制台 */
    console?: boolean;
}
/**
 * 日志级别
 */
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
/**
 * 日志条目
 */
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    context?: Record<string, any>;
}
/**
 * 存储配置
 */
export interface StorageConfig {
    /** 存储目录（默认~/.wechat-sdk） */
    dir?: string;
    /** 是否启用持久化 */
    enablePersist?: boolean;
}
/**
 * 通道选择结果
 */
export interface ChannelSelectionResult {
    /** 选中的通道类型 */
    mode: 'qclaw' | 'workbuddy';
    /** 优先级（高=更合适） */
    priority: number;
    /** 选择原因 */
    reason: string;
}
