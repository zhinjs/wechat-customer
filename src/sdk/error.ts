/**
 * @file src/sdk/error.ts
 * @description SDK 错误定义
 */

/**
 * SDK基础错误类
 */
export class WeChatSDKError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'WeChatSDKError';
    Object.setPrototypeOf(this, WeChatSDKError.prototype);
  }
}

/**
 * 连接错误
 */
export class ConnectionError extends WeChatSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super('CONNECTION_ERROR', message, details);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends WeChatSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super('AUTH_ERROR', message, details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Token过期错误
 */
export class TokenExpiredError extends AuthenticationError {
  constructor(message = 'Token已过期', details?: Record<string, any>) {
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
  constructor(message: string, details?: Record<string, any>) {
    super('MESSAGE_ERROR', message, details);
    this.name = 'MessageError';
    Object.setPrototypeOf(this, MessageError.prototype);
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends WeChatSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super('TIMEOUT', message, details);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * 配置错误
 */
export class ConfigurationError extends WeChatSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super('CONFIG_ERROR', message, details);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * 不支持的操作错误
 */
export class UnsupportedOperationError extends WeChatSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super('UNSUPPORTED', message, details);
    this.name = 'UnsupportedOperationError';
    Object.setPrototypeOf(this, UnsupportedOperationError.prototype);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends WeChatSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 需要登录错误
 * 
 * 当 SDK 在本地找不到会话文件且未提供凭证时抛出。
 * 同时会触发 SDK 的 `loginRequired` 事件。
 * 
 * 对于 QClaw 模式，错误中包含已生成的设备 GUID，供应用用于发起扫码登录。
 */
export class LoginRequiredError extends WeChatSDKError {
  readonly mode: 'qclaw' | 'workbuddy';
  /** QClaw 模式下已生成的设备 GUID */
  readonly guid?: string;

  constructor(mode: 'qclaw' | 'workbuddy', guid?: string) {
    const message =
      mode === 'qclaw'
        ? `QClaw 登录需要凭证，设备 GUID: ${guid}。请完成扫码登录后携带 channelToken/jwtToken 重新调用 connect()。`
        : 'WorkBuddy 登录需要凭证，请完成 OAuth 授权后携带 userId/accessToken 重新调用 connect()。';
    super('LOGIN_REQUIRED', message, mode === 'qclaw' ? { guid } : undefined);
    this.name = 'LoginRequiredError';
    this.mode = mode;
    this.guid = guid;
    Object.setPrototypeOf(this, LoginRequiredError.prototype);
  }
}
