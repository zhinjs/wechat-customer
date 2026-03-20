/**
 * @file src/sdk/error.ts
 * @description SDK 错误定义
 */
/**
 * SDK基础错误类
 */
export class WeChatSDKError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.message = message;
        this.details = details;
        this.name = 'WeChatSDKError';
        Object.setPrototypeOf(this, WeChatSDKError.prototype);
    }
}
/**
 * 连接错误
 */
export class ConnectionError extends WeChatSDKError {
    constructor(message, details) {
        super('CONNECTION_ERROR', message, details);
        this.name = 'ConnectionError';
        Object.setPrototypeOf(this, ConnectionError.prototype);
    }
}
/**
 * 认证错误
 */
export class AuthenticationError extends WeChatSDKError {
    constructor(message, details) {
        super('AUTH_ERROR', message, details);
        this.name = 'AuthenticationError';
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
/**
 * Token过期错误
 */
export class TokenExpiredError extends AuthenticationError {
    constructor(message = 'Token已过期', details) {
        super(message, details);
        this.code = 'TOKEN_EXPIRED';
        this.name = 'TokenExpiredError';
        Object.setPrototypeOf(this, TokenExpiredError.prototype);
    }
}
/**
 * 消息发送错误
 */
export class MessageError extends WeChatSDKError {
    constructor(message, details) {
        super('MESSAGE_ERROR', message, details);
        this.name = 'MessageError';
        Object.setPrototypeOf(this, MessageError.prototype);
    }
}
/**
 * 超时错误
 */
export class TimeoutError extends WeChatSDKError {
    constructor(message, details) {
        super('TIMEOUT', message, details);
        this.name = 'TimeoutError';
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}
/**
 * 配置错误
 */
export class ConfigurationError extends WeChatSDKError {
    constructor(message, details) {
        super('CONFIG_ERROR', message, details);
        this.name = 'ConfigurationError';
        Object.setPrototypeOf(this, ConfigurationError.prototype);
    }
}
/**
 * 不支持的操作错误
 */
export class UnsupportedOperationError extends WeChatSDKError {
    constructor(message, details) {
        super('UNSUPPORTED', message, details);
        this.name = 'UnsupportedOperationError';
        Object.setPrototypeOf(this, UnsupportedOperationError.prototype);
    }
}
/**
 * 验证错误
 */
export class ValidationError extends WeChatSDKError {
    constructor(message, details) {
        super('VALIDATION_ERROR', message, details);
        this.name = 'ValidationError';
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
//# sourceMappingURL=error.js.map