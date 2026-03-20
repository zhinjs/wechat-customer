/**
 * @file src/sdk/utils/logger.ts
 * @description 日志管理工具
 */

import { LogLevel, LogEntry, LoggerConfig } from '../types.js';

/**
 * 日志管理器
 * 
 * 提供统一的日志接口，支持多个日志级别和自定义输出。
 */
export class Logger {
  private level: LogLevel;
  private console: boolean;
  private customOutput?: (log: LogEntry) => void;
  private context: string;

  constructor(context: string, config?: LoggerConfig) {
    this.context = context;
    this.level = config?.level ?? LogLevel.INFO;
    this.console = config?.console ?? true;
    this.customOutput = config?.output;
  }

  /**
   * 日志级别优先级
   */
  private static LEVEL_PRIORITY: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  };

  /**
   * 是否应该输出此日志
   */
  private shouldLog(level: LogLevel): boolean {
    return Logger.LEVEL_PRIORITY[level] >= Logger.LEVEL_PRIORITY[this.level];
  }

  /**
   * 输出日志
   */
  private emit(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: context ? { ...context, logger: this.context } : { logger: this.context },
    };

    // 自定义输出
    if (this.customOutput) {
      this.customOutput(entry);
    }

    // 控制台输出
    if (this.console) {
      this.consoleLog(entry);
    }
  }

  /**
   * 控制台输出
   */
  private consoleLog(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.context?.logger || 'SDK'}]`;
    const message = entry.context ? `${prefix} ${entry.message} ${JSON.stringify(entry.context)}` : `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.log(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
        console.error(message);
        break;
    }
  }

  /**
   * DEBUG级别日志
   */
  debug(message: string, context?: Record<string, any>): void {
    this.emit(LogLevel.DEBUG, message, context);
  }

  /**
   * INFO级别日志
   */
  info(message: string, context?: Record<string, any>): void {
    this.emit(LogLevel.INFO, message, context);
  }

  /**
   * WARN级别日志
   */
  warn(message: string, context?: Record<string, any>): void {
    this.emit(LogLevel.WARN, message, context);
  }

  /**
   * ERROR级别日志
   */
  error(message: string, error?: any): void {
    const context = error instanceof Error ? { error: error.message, stack: error.stack } : { error };
    this.emit(LogLevel.ERROR, message, context);
  }

  /**
   * 创建子Logger（用于子模块）
   */
  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, { level: this.level });
  }
}
