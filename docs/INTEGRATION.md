# 集成指南

本指南将帮助您快速集成和使用WeChat SDK。

## 目录

1. [安装](#安装)
2. [基础设置](#基础设置)
3. [QClaw模式集成](#qclaw模式集成)
4. [WorkBuddy模式集成](#workbuddy模式集成)
5. [会话持久化与凭证恢复](#会话持久化与凭证恢复)
6. [通用API](#通用api)
7. [错误处理](#错误处理)
8. [高级功能](#高级功能)

## 安装

### npm

```bash
npm install wechat-sdk
```

### yarn

```bash
yarn add wechat-sdk
```

### pnpm

```bash
pnpm add wechat-sdk
```

## 基础设置

### 1. 导入SDK

```typescript
import { WeChatSDK } from 'wechat-sdk';
```

### 2. 初始化SDK

```typescript
const sdk = new WeChatSDK({
  mode: 'auto', // 自动选择合适的模式
  credentials: {
    // 凭证配置（见下面的模式特定配置）
  },
});
```

### 3. 连接和断开

```typescript
// 连接
try {
  await sdk.connect();
  console.log('连接成功');
} catch (error) {
  console.error('连接失败:', error);
}

// 监听消息
sdk.on('message', (message) => {
  console.log('收到消息:', message);
});

// 在使用完毕后断开
await sdk.disconnect();
```

## QClaw模式集成

### 获取凭证

QClaw模式需要以下凭证：

| 凭证 | 说明 | 来源 |
|------|------|------|
| `guid` | 设备GUID | 初始化时生成 |
| `channelToken` | 渠道Token | 微信扫码登录获得 |
| `jwtToken` | JWT Token | 登录流程返回 |
| `apiKey` | API Key（可选） | 用于调用模型API |
| `userId` | 用户ID（可选） | 用户信息 |
| `wsUrl` | WebSocket URL（可选） | 环境配置 |

### 完整示例

```typescript
import { WeChatSDK } from 'wechat-sdk';

// 1. 初始化SDK（QClaw模式）
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',
    guid: 'your_device_guid',
    channelToken: 'your_channel_token',
    jwtToken: 'your_jwt_token',
    apiKey: 'your_api_key',
    userId: 'your_user_id',
    wsUrl: 'wss://mmgrcalltoken.3g.qq.com/agentwss',
    userInfo: {
      // 用户信息
      user_id: 'your_user_id',
      nickname: '用户名',
    },
  },
  connection: {
    timeout: 5000,             // 连接超时
    reconnectInterval: 3000,   // 重连间隔
    maxReconnectAttempts: 10,  // 最大重连次数
  },
});

// 2. 连接
await sdk.connect();

// 3. 监听事件
sdk.on('connected', () => {
  console.log('QClaw 已连接');
});

sdk.on('message', async (message) => {
  console.log('收到消息:', message.content);
  
  // 发送回复
  await sdk.sendMessage({
    to: message.from,
    content: '已收到您的消息',
  });
});

sdk.on('error', (error) => {
  console.error('发生错误:', error);
});

// 4. 发送消息
const response = await sdk.sendMessage({
  to: 'user_123',
  content: '你好，这是一条测试消息',
});

if (response.success) {
  console.log('消息已发送:', response.messageId);
} else {
  console.error('消息发送失败:', response.error);
}

// 5. 断开连接
await sdk.disconnect();
```

### 凭证持久化

SDK 内置了凭证持久化，**`connect()` 成功后自动保存，无需手动编写文件读写代码**。

```typescript
// 首次运行 – 传入凭证，connect() 成功后自动写入 ~/.wechat-sdk/session.json
const sdk = new WeChatSDK({ mode: 'qclaw', credentials: { ... } });
await sdk.connect();

// 后续运行 – 不传凭证，SDK 自动从 session.json 恢复
const sdk = new WeChatSDK();
await sdk.connect();
```

详细说明见[会话持久化与凭证恢复](#会话持久化与凭证恢复)章节。

## WorkBuddy模式集成

### 获取凭证

WorkBuddy模式需要以下凭证：

| 凭证 | 说明 | 来源 |
|------|------|------|
| `userId` | 用户ID | CodeBuddy OAuth返回 |
| `accessToken` | 访问Token | OAuth登录流程 |
| `refreshToken` | 刷新Token（可选） | OAuth登录流程 |
| `hostId` | 主机ID（可选） | 系统配置 |
| `baseUrl` | 基础URL（可选） | API地址 |

### 完整示例

```typescript
import { WeChatSDK } from 'wechat-sdk';

// 1. 初始化SDK（WorkBuddy模式）
const sdk = new WeChatSDK({
  mode: 'workbuddy',
  credentials: {
    mode: 'workbuddy',
    userId: 'your_user_id',
    accessToken: 'your_access_token',
    refreshToken: 'your_refresh_token',
    hostId: 'your_host_id',
    baseUrl: 'https://copilot.tencent.com',
    userInfo: {
      uid: 'your_user_id',
      nickName: '用户昵称',
    },
  },
  connection: {
    timeout: 5000,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
  },
});

// 2. 连接
await sdk.connect();

// 3. 监听事件
sdk.on('connected', () => {
  console.log('WorkBuddy 已连接');
});

sdk.on('message', async (message) => {
  console.log('收到消息:', message.content);
  
  // 发送回复
  await sdk.sendMessage({
    to: message.from,
    content: '已收到您的消息',
  });
});

sdk.on('tokenRefreshed', () => {
  console.log('Token 已自动刷新');
});

sdk.on('error', (error) => {
  console.error('发生错误:', error);
});

// 4. 发送消息
const response = await sdk.sendMessage({
  to: 'user_456',
  content: '你好，WorkBuddy消息',
});

if (response.success) {
  console.log('消息已发送:', response.messageId);
}

// 5. 手动刷新Token（如需要）
try {
  await sdk.refreshCredentials();
  console.log('凭证已刷新');
} catch (error) {
  console.error('凭证刷新失败:', error);
}

// 6. 断开连接
await sdk.disconnect();
```

## 会话持久化与凭证恢复

SDK 内置凭证持久化机制，**大幅简化二次启动时的参数传递**。

### 工作原理

| 时机 | 行为 |
|------|------|
| `connect()` 成功时 | 自动将凭证写入 `~/.wechat-sdk/session.json` |
| `refreshCredentials()` 成功时 | 自动将刷新后的凭证更新到会话文件 |
| 下次 `connect()` 且未传 `credentials` 时 | 自动从会话文件读取凭证，无需任何参数 |

### 首次启动（提供凭证）

```typescript
import { WeChatSDK } from 'wechat-sdk';

// 第一次运行：提供完整凭证（QClaw 示例）
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',
    guid: process.env.QCLAW_GUID!,
    channelToken: process.env.QCLAW_CHANNEL_TOKEN!,
    jwtToken: process.env.QCLAW_JWT_TOKEN!,
  },
});

await sdk.connect();
// 连接成功后，凭证自动保存到 ~/.wechat-sdk/session.json
console.log('首次连接成功，凭证已自动保存');
```

### 后续启动（无需再传凭证）

```typescript
import { WeChatSDK } from 'wechat-sdk';

// 后续启动：不传任何凭证
const sdk = new WeChatSDK();
await sdk.connect();
// SDK 自动从 ~/.wechat-sdk/session.json 恢复凭证
console.log('从会话文件恢复连接');
```

### 启动时检查会话

```typescript
import { WeChatSDK } from 'wechat-sdk';

const sdk = new WeChatSDK();

if (!(await sdk.hasSavedSession())) {
  console.error('未找到会话，请先提供凭证运行一次');
  process.exit(1);
}

await sdk.connect();
```

### 会话管理 API

```typescript
// 检查会话文件是否存在
const hasSession = await sdk.hasSavedSession(); // boolean

// 读取已保存的凭证（不建立连接）
const creds = await sdk.loadSavedCredentials(); // ChannelCredentials | null
if (creds?.mode === 'qclaw') {
  console.log('设备 GUID:', creds.guid);
}

// 清除会话（下次需要重新提供凭证）
await sdk.clearSession();
```

### 自定义存储目录

```typescript
const sdk = new WeChatSDK({
  storage: {
    dir: '~/.my-app/wechat',  // 默认 ~/.wechat-sdk
    enablePersist: true,       // 设为 false 完全禁用持久化
  },
});
```

> 凭证字段说明和获取方式请查看 [凭证指南](CREDENTIALS.md)。

---

## 通用API

### 连接管理

```typescript
// 检查连接状态
if (sdk.isConnectedState()) {
  console.log('已连接');
}

// 获取详细的连接状态
const state = sdk.getConnectionState();
console.log('连接状态:', state);
// 返回值: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'closing'
```

### 消息发送

```typescript
import { MessageType } from 'wechat-sdk';

// 发送文本消息
await sdk.sendMessage({
  to: 'user_id',
  content: '文本消息',
  type: MessageType.TEXT,
});

// 发送带元数据的消息
await sdk.sendMessage({
  to: 'user_id',
  content: '带元数据的消息',
  metadata: {
    customField: 'customValue',
    priority: 'high',
  },
});

// 发送带超时的消息
const response = await sdk.sendMessage({
  to: 'user_id',
  content: '消息内容',
  timeout: 10000, // 10秒超时
});
```

### 凭证管理

```typescript
// 获取当前凭证
const credentials = sdk.getCredentials();
console.log('当前用户ID:', credentials?.userId);

// 更新凭证（如token刷新）
sdk.updateCredentials({
  mode: 'workbuddy',
  userId: 'user_id',
  accessToken: 'new_access_token',
  refreshToken: 'new_refresh_token',
  hostId: 'host_id',
  baseUrl: 'https://copilot.tencent.com',
});

// 手动刷新凭证
await sdk.refreshCredentials();
```

### 事件监听

```typescript
// 连接成功
sdk.on('connected', () => {
  console.log('连接已建立');
});

// 连接断开
sdk.on('disconnected', ({ reason }) => {
  console.log(`连接已断开: ${reason}`);
});

// 收到消息
sdk.on('message', (message) => {
  console.log(`来自 ${message.from} 的消息: ${message.content}`);
});

// 发生错误
sdk.on('error', (error) => {
  console.error('错误:', error.message);
});

// Token已刷新（仅WorkBuddy模式）
sdk.on('tokenRefreshed', () => {
  console.log('Token 已自动刷新');
});

// 移除监听
sdk.off('message', handler);
```

## 错误处理

### 常见错误类型

```typescript
import {
  WeChatSDKError,
  ConnectionError,
  AuthenticationError,
  TokenExpiredError,
  MessageError,
  TimeoutError,
  ConfigurationError,
  ValidationError,
} from 'wechat-sdk';

try {
  await sdk.connect();
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('连接错误:', error.message);
  } else if (error instanceof AuthenticationError) {
    console.error('认证错误:', error.message);
  } else if (error instanceof TokenExpiredError) {
    console.error('Token已过期，需要重新登录');
  } else if (error instanceof ConfigurationError) {
    console.error('配置错误:', error.message);
  } else {
    console.error('未知错误:', error);
  }
}
```

### 完整的错误处理模式

```typescript
async function robustSendMessage(sdk, to, content) {
  try {
    // 检查连接
    if (!sdk.isConnectedState()) {
      console.warn('未连接，尝试重新连接...');
      await sdk.connect();
    }

    // 发送消息
    const response = await sdk.sendMessage({
      to,
      content,
      timeout: 30000,
    });

    if (response.success) {
      console.log('消息发送成功:', response.messageId);
      return response.messageId;
    } else {
      console.error('消息发送失败:', response.error);
      return null;
    }
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      // 尝试刷新凭证并重试
      console.log('Token已过期，尝试刷新...');
      try {
        await sdk.refreshCredentials();
        return await robustSendMessage(sdk, to, content);
      } catch (refreshError) {
        console.error('凭证刷新失败:', refreshError);
        // 需要重新登录
        return null;
      }
    } else if (error instanceof ConnectionError) {
      console.error('连接错误，请检查网络:', error);
      return null;
    } else if (error instanceof TimeoutError) {
      console.error('发送超时，请稍后重试');
      return null;
    } else {
      console.error('未知错误:', error);
      return null;
    }
  }
}
```

## 高级功能

### 自定义日志配置

```typescript
import { LogLevel } from 'wechat-sdk';

const sdk = new WeChatSDK({
  credentials: { /* ... */ },
  logger: {
    level: LogLevel.DEBUG, // 调试模式
    console: true,         // 输出到控制台
    output: (logEntry) => {
      // 自定义日志处理
      console.log(`[${logEntry.level}] ${logEntry.message}`, logEntry.context);
      
      // 例如：发送到日志服务
      // sendToLoggingService(logEntry);
    },
  },
});
```

### 存储配置

```typescript
const sdk = new WeChatSDK({
  credentials: { /* ... */ },
  storage: {
    dir: '~/.my-app/wechat', // 自定义存储目录
    enablePersist: true,      // 启用持久化
  },
});
```

### 显示连接状态

```typescript
function displayConnectionStatus(sdk) {
  const state = sdk.getConnectionState();
  const connected = sdk.isConnectedState();
  
  const statusText = {
    'disconnected': '未连接',
    'connecting': '连接中...',
    'connected': '已连接',
    'reconnecting': '重新连接中...',
    'closing': '关闭中...',
  };
  
  console.log(`状态: ${statusText[state]} ${connected ? '✓' : '✗'}`);
}
```

### 优雅关闭

```typescript
async function gracefulShutdown(sdk) {
  try {
    console.log('开始优雅关闭...');
    
    // 停止接受新消息
    sdk.off('message', msgHandler);
    
    // 等待待发送消息完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 断开连接
    await sdk.disconnect();
    
    console.log('优雅关闭完成');
  } catch (error) {
    console.error('关闭时出错:', error);
  }
}

// 处理进程信号
process.on('SIGINT', () => gracefulShutdown(sdk));
process.on('SIGTERM', () => gracefulShutdown(sdk));
```

## 最佳实践

1. **始终检查连接状态**
   ```typescript
   if (!sdk.isConnectedState()) {
     await sdk.connect();
   }
   ```

2. **实施错误重试逻辑**
   ```typescript
   for (let attempt = 1; attempt <= 3; attempt++) {
     try {
       const response = await sdk.sendMessage(request);
       if (response.success) return response.messageId;
     } catch (error) {
       if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
       }
     }
   }
   ```

3. **安全存储凭证**
   - 使用环境变量或密钥管理服务
   - 设置正确的文件权限（0o600）
   - 定期轮换token

4. **监控连接健康**
   ```typescript
   sdk.on('disconnected', ({ reason }) => {
     console.warn(`连接断开: ${reason}`);
     // 实施自动重连逻辑
   });
   ```

5. **实施心跳检测**
   ```typescript
   const heartbeat = setInterval(() => {
     if (!sdk.isConnectedState()) {
       console.log('心跳检测：连接丢失，尝试重连');
       sdk.connect();
     }
   }, 30000);
   ```

---

需要更多帮助？查看 [API文档](API.md) 或 [故障排查](../README.md#故障排查)。
