# API 文档

完整的WeChat SDK API参考。

## 目录

1. [WeChatSDK 类](#wechatsdk-类)
2. [Channel 接口](#channel-接口)
3. [类型定义](#类型定义)
4. [错误类型](#错误类型)
5. [事件](#事件)

## WeChatSDK 类

SDK的主要入口类，提供所有与微信通信的API。

### 构造函数

```typescript
constructor(config?: SDKConfig): WeChatSDK
```

**参数:**
- `config` (optional): SDK配置对象

**示例:**
```typescript
const sdk = new WeChatSDK({
  mode: 'auto',
  credentials: { /* ... */ },
});
```

### 方法

#### `connect(): Promise<void>`

连接到微信服务。

**行为:**
1. 验证凭证
2. 根据模式创建通道
3. 建立连接
4. 触发 `connected` 事件

**异常:**
- `ConfigurationError`: 配置无效
- `ConnectionError`: 连接失败
- `AuthenticationError`: 认证失败

**示例:**
```typescript
try {
  await sdk.connect();
  console.log('连接成功');
} catch (error) {
  console.error('连接失败:', error);
}
```

---

#### `disconnect(): Promise<void>`

断开连接。

**行为:**
1. 关闭底层连接
2. 清理资源
3. 触发 `disconnected` 事件

**示例:**
```typescript
await sdk.disconnect();
```

---

#### `sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>`

发送消息。

**参数:**
```typescript
interface SendMessageRequest {
  to: string;              // 接收者ID（必需）
  content: string;         // 消息内容（必需）
  type?: MessageType;      // 消息类型（默认TEXT）
  needReceipt?: boolean;   // 需要已读回执
  metadata?: Record<string, any>; // 元数据
  timeout?: number;        // 超时时间（毫秒）
}
```

**返回值:**
```typescript
interface SendMessageResponse {
  success: boolean;           // 是否成功
  messageId?: string;        // 消息ID
  error?: string;            // 错误信息
  timestamp: number;         // 时间戳
}
```

**异常:**
- `ConnectionError`: 未连接
- `ValidationError`: 参数验证失败
- `TimeoutError`: 发送超时
- `MessageError`: 消息发送失败

**示例:**
```typescript
const response = await sdk.sendMessage({
  to: 'user_123',
  content: '你好',
  timeout: 30000,
});

if (response.success) {
  console.log('消息ID:', response.messageId);
} else {
  console.error('发送失败:', response.error);
}
```

---

#### `isConnectedState(): boolean`

检查是否已连接。

**返回值:**
- `true`: 已连接
- `false`: 未连接

**示例:**
```typescript
if (!sdk.isConnectedState()) {
  await sdk.connect();
}
```

---

#### `getConnectionState(): ConnectionState`

获取连接状态。

**返回值:** 连接状态枚举值
```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',    // 已断开
  CONNECTING = 'connecting',        // 连接中
  CONNECTED = 'connected',          // 已连接
  RECONNECTING = 'reconnecting',    // 重连中
  CLOSING = 'closing',              // 关闭中
}
```

**示例:**
```typescript
const state = sdk.getConnectionState();
const statusMap = {
  'disconnected': '未连接',
  'connecting': '连接中',
  'connected': '已连接',
  'reconnecting': '重新连接中',
  'closing': '关闭中',
};
console.log(statusMap[state]);
```

---

#### `refreshCredentials(): Promise<void>`

手动刷新凭证（如token过期）。

**行为:**
1. 调用底层通道的token刷新逻辑
2. 更新本地凭证
3. 触发 `tokenRefreshed` 事件

**异常:**
- `TokenExpiredError`: Token已完全过期，需要重新登录
- `AuthenticationError`: 其他认证错误

**示例:**
```typescript
try {
  await sdk.refreshCredentials();
  console.log('凭证已刷新');
} catch (error) {
  console.error('刷新失败:', error);
  // 需要重新登录
}
```

---

#### `getCredentials(): ChannelCredentials | undefined`

获取当前凭证。

**返回值:** 当前的凭证对象

**示例:**
```typescript
const creds = sdk.getCredentials();
if (creds && creds.mode === 'workbuddy') {
  console.log('当前用户:', creds.userId);
}
```

---

#### `updateCredentials(credentials: ChannelCredentials): void`

更新凭证。

**参数:**
- `credentials`: 新的凭证对象

**示例:**
```typescript
sdk.updateCredentials({
  mode: 'workbuddy',
  userId: 'user_id',
  accessToken: 'new_token',
  refreshToken: 'new_refresh_token',
});
```

---

### 事件方法

#### `on<K extends keyof SDKEventMap>(event: K, listener: EventListener<K>): this`

监听事件。

**参数:**
- `event`: 事件名称
- `listener`: 事件回调函数

**示例:**
```typescript
sdk.on('connected', () => {
  console.log('已连接');
});

sdk.on('message', (message) => {
  console.log('收到消息:', message);
});

sdk.on('error', (error) => {
  console.error('发生错误:', error);
});
```

---

#### `once<K extends keyof SDKEventMap>(event: K, listener: EventListener<K>): this`

监听事件一次。

**示例:**
```typescript
sdk.once('connected', () => {
  console.log('首次连接成功');
});
```

---

#### `off<K extends keyof SDKEventMap>(event: K, listener: EventListener<K>): this`

移除事件监听。

**示例:**
```typescript
const handler = (message) => {
  console.log('消息:', message);
};

sdk.on('message', handler);
// ...
sdk.off('message', handler);
```

---

## Channel 接口

通道接口定义了所有通信方式必须实现的方法。

### 方法

#### `initialize(): Promise<void>`

初始化通道。

#### `connect(): Promise<void>`

连接到服务。

#### `disconnect(): Promise<void>`

断开连接。

#### `isConnected(): boolean`

检查连接状态。

#### `getState(): ConnectionState`

获取详细的连接状态。

#### `sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>`

发送消息。

#### `sendRaw(data: unknown): Promise<void>`

发送原始数据。

#### `refreshCredentials(): Promise<void>`

刷新凭证。

#### `getCredentials(): ChannelCredentials`

获取凭证。

---

## 类型定义

### 核心枚举

#### ConnectionState

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  CLOSING = 'closing',
}
```

#### MessageType

```typescript
enum MessageType {
  TEXT = 'text',      // 文本消息
  IMAGE = 'image',    // 图片消息
  FILE = 'file',      // 文件消息
  CARD = 'card',      // 卡片消息
  COMMAND = 'command', // 命令消息
}
```

#### MessageDirection

```typescript
enum MessageDirection {
  INBOUND = 'inbound',   // 接收
  OUTBOUND = 'outbound', // 发送
}
```

#### MessageStatus

```typescript
enum MessageStatus {
  PENDING = 'pending',      // 待发送
  SENDING = 'sending',      // 发送中
  SENT = 'sent',            // 已发送
  DELIVERED = 'delivered',  // 已送达
  FAILED = 'failed',        // 发送失败
  READ = 'read',            // 已读
}
```

### 配置接口

#### SDKConfig

```typescript
interface SDKConfig {
  mode?: CommunicationMode;           // 通信模式
  credentials?: ChannelCredentials;   // 凭证
  connection?: ConnectionConfig;      // 连接配置
  message?: MessageConfig;            // 消息配置
  logger?: LoggerConfig;              // 日志配置
  storage?: StorageConfig;            // 存储配置
}
```

#### ConnectionConfig

```typescript
interface ConnectionConfig {
  timeout?: number;              // 连接超时(ms)
  reconnectInterval?: number;    // 重连间隔(ms)
  maxReconnectAttempts?: number; // 最大重连次数
  heartbeatInterval?: number;    // 心跳间隔(ms)
}
```

#### MessageConfig

```typescript
interface MessageConfig {
  timeout?: number;           // 发送超时(ms)
  retryAttempts?: number;    // 重试次数
  queueSize?: number;        // 队列大小
  persistUndelivered?: boolean; // 是否持久化
}
```

### 凭证接口

#### QClawCredentials

```typescript
interface QClawCredentials {
  mode: 'qclaw';
  guid: string;
  channelToken: string;
  jwtToken: string;
  apiKey?: string;
  userId?: string;
  wsUrl?: string;
  userInfo?: Record<string, any>;
}
```

#### WorkBuddyCredentials

```typescript
interface WorkBuddyCredentials {
  mode: 'workbuddy';
  userId: string;
  accessToken: string;
  refreshToken?: string;
  hostId?: string;
  baseUrl?: string;
  userInfo?: Record<string, any>;
}
```

---

## 错误类型

### 错误类层次

```
Error
├── WeChatSDKError (基类)
│   ├── ConnectionError
│   ├── AuthenticationError
│   │   └── TokenExpiredError
│   ├── MessageError
│   ├── TimeoutError
│   ├── ConfigurationError
│   ├── ValidationError
│   └── UnsupportedOperationError
```

### 常见错误处理

```typescript
import {
  WeChatSDKError,
  ConnectionError,
  TokenExpiredError,
  TimeoutError,
} from 'wechat-sdk';

try {
  await sdk.sendMessage({ to: 'user', content: 'msg' });
} catch (error) {
  if (error instanceof TokenExpiredError) {
    // Token已过期
    console.error('需要重新登录');
  } else if (error instanceof ConnectionError) {
    // 连接问题
    console.error('网络连接失败');
  } else if (error instanceof TimeoutError) {
    // 超时
    console.error('请求超时');
  } else if (error instanceof WeChatSDKError) {
    // 其他SDK错误
    console.error(`错误 [${error.code}]: ${error.message}`);
  }
}
```

---

## 事件

### 事件列表

#### `connected`

连接成功建立。

```typescript
sdk.on('connected', () => {
  console.log('连接已建立');
});
```

#### `disconnected`

连接已断开。

```typescript
sdk.on('disconnected', ({ reason }) => {
  console.log(`连接已断开: ${reason}`);
});
```

#### `message`

收到新消息。

```typescript
sdk.on('message', (message: Message) => {
  console.log(`来自 ${message.from} 的消息:`, message.content);
  console.log('消息ID:', message.id);
  console.log('消息类型:', message.type);
  console.log('时间戳:', message.timestamp);
});
```

#### `error`

发生错误。

```typescript
sdk.on('error', (error: Error) => {
  console.error('错误:', error.message);
});
```

#### `tokenRefreshed`

Token已自动刷新（仅WorkBuddy模式）。

```typescript
sdk.on('tokenRefreshed', () => {
  console.log('Token已自动刷新');
});
```

---

## 完整使用流程

```typescript
import {
  WeChatSDK,
  MessageType,
  ConnectionError,
  TokenExpiredError,
} from 'wechat-sdk';

async function main() {
  // 1. 创建SDK实例
  const sdk = new WeChatSDK({
    mode: 'auto',
    credentials: {
      mode: 'qclaw', // 或 'workbuddy'
      // ... 其他凭证
    },
  });

  // 2. 设置事件监听
  sdk.on('connected', () => {
    console.log('✓ 已连接');
  });

  sdk.on('message', async (message) => {
    console.log('📨 新消息:', message);
    
    // 自动回复
    try {
      const response = await sdk.sendMessage({
        to: message.from,
        content: '感谢您的消息，我已收到',
        type: MessageType.TEXT,
      });
      
      if (response.success) {
        console.log('✓ 回复已发送');
      }
    } catch (error) {
      console.error('✗ 回复失败:', error);
    }
  });

  sdk.on('error', (error) => {
    console.error('✗ 错误:', error);
    
    if (error instanceof TokenExpiredError) {
      console.log('Token已过期，请重新登录');
    }
  });

  // 3. 连接
  try {
    await sdk.connect();
    
    // 4. 发送消息
    const response = await sdk.sendMessage({
      to: 'user_123',
      content: '你好',
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    // 5. 保持连接（处理消息）
    await new Promise(resolve => {
      process.on('SIGINT', () => {
        console.log('正在关闭...');
        resolve(null);
      });
    });
    
  } catch (error) {
    console.error('发生错误:', error);
    
  } finally {
    // 6. 断开连接
    await sdk.disconnect();
  }
}

main().catch(console.error);
```

---

更多示例请查看 [示例详解](EXAMPLES.md)。
