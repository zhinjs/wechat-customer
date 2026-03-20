/**
 * @file src/sdk/types.ts
 * @description SDK 通用类型定义
 */
/**
 * 连接状态
 */
export var ConnectionState;
(function (ConnectionState) {
    ConnectionState["DISCONNECTED"] = "disconnected";
    ConnectionState["CONNECTING"] = "connecting";
    ConnectionState["CONNECTED"] = "connected";
    ConnectionState["RECONNECTING"] = "reconnecting";
    ConnectionState["CLOSING"] = "closing";
})(ConnectionState || (ConnectionState = {}));
/**
 * 消息类型
 */
export var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["IMAGE"] = "image";
    MessageType["FILE"] = "file";
    MessageType["CARD"] = "card";
    MessageType["COMMAND"] = "command";
})(MessageType || (MessageType = {}));
/**
 * 消息方向
 */
export var MessageDirection;
(function (MessageDirection) {
    MessageDirection["INBOUND"] = "inbound";
    MessageDirection["OUTBOUND"] = "outbound";
})(MessageDirection || (MessageDirection = {}));
/**
 * 消息状态
 */
export var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING"] = "pending";
    MessageStatus["SENDING"] = "sending";
    MessageStatus["SENT"] = "sent";
    MessageStatus["DELIVERED"] = "delivered";
    MessageStatus["FAILED"] = "failed";
    MessageStatus["READ"] = "read";
})(MessageStatus || (MessageStatus = {}));
/**
 * 日志级别
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (LogLevel = {}));
//# sourceMappingURL=types.js.map