/**
 * @file src/sdk/utils/logger.ts
 * @description 日志管理工具
 */
import { LoggerConfig } from '../types.js';
/**
 * 日志管理器
 *
 * 提供统一的日志接口，支持多个日志级别和自定义输出。
 */
export declare class Logger {
    private level;
    private console;
    private customOutput?;
    private context;
    constructor(context: string, config?: LoggerConfig);
    /**
     * 日志级别优先级
     */
    private static LEVEL_PRIORITY;
    /**
     * 是否应该输出此日志
     */
    private shouldLog;
    /**
     * 输出日志
     */
    private emit;
    /**
     * 控制台输出
     */
    private consoleLog;
    /**
     * DEBUG级别日志
     */
    debug(message: string, context?: Record<string, any>): void;
    /**
     * INFO级别日志
     */
    info(message: string, context?: Record<string, any>): void;
    /**
     * WARN级别日志
     */
    warn(message: string, context?: Record<string, any>): void;
    /**
     * ERROR级别日志
     */
    error(message: string, error?: any): void;
    /**
     * 创建子Logger（用于子模块）
     */
    child(context: string): Logger;
}
