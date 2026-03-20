/**
 * @file src/sdk/utils/logger.ts
 * @description 日志管理工具
 */
import { LogLevel } from '../types.js';
/**
 * 日志管理器
 *
 * 提供统一的日志接口，支持多个日志级别和自定义输出。
 */
export class Logger {
    constructor(context, config) {
        this.context = context;
        this.level = config?.level ?? LogLevel.INFO;
        this.console = config?.console ?? true;
        this.customOutput = config?.output;
    }
    /**
     * 是否应该输出此日志
     */
    shouldLog(level) {
        return Logger.LEVEL_PRIORITY[level] >= Logger.LEVEL_PRIORITY[this.level];
    }
    /**
     * 输出日志
     */
    emit(level, message, context) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = {
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
    consoleLog(entry) {
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
    debug(message, context) {
        this.emit(LogLevel.DEBUG, message, context);
    }
    /**
     * INFO级别日志
     */
    info(message, context) {
        this.emit(LogLevel.INFO, message, context);
    }
    /**
     * WARN级别日志
     */
    warn(message, context) {
        this.emit(LogLevel.WARN, message, context);
    }
    /**
     * ERROR级别日志
     */
    error(message, error) {
        const context = error instanceof Error ? { error: error.message, stack: error.stack } : { error };
        this.emit(LogLevel.ERROR, message, context);
    }
    /**
     * 创建子Logger（用于子模块）
     */
    child(context) {
        return new Logger(`${this.context}:${context}`, { level: this.level });
    }
}
/**
 * 日志级别优先级
 */
Logger.LEVEL_PRIORITY = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
};
//# sourceMappingURL=logger.js.map