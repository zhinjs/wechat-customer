/**
 * @file src/sdk/error.ts
 * @description SDK 错误定义
 */
/**
 * SDK基础错误类
 */
export declare class WeChatSDKError extends Error {
    code: string;
    message: string;
    details?: Record<string, any> | undefined;
    constructor(code: string, message: string, details?: Record<string, any> | undefined);
}
/**
 * 连接错误
 */
export declare class ConnectionError extends WeChatSDKError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * 认证错误
 */
export declare class AuthenticationError extends WeChatSDKError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * Token过期错误
 */
export declare class TokenExpiredError extends AuthenticationError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * 消息发送错误
 */
export declare class MessageError extends WeChatSDKError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * 超时错误
 */
export declare class TimeoutError extends WeChatSDKError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * 配置错误
 */
export declare class ConfigurationError extends WeChatSDKError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * 不支持的操作错误
 */
export declare class UnsupportedOperationError extends WeChatSDKError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * 验证错误
 */
export declare class ValidationError extends WeChatSDKError {
    constructor(message: string, details?: Record<string, any>);
}
