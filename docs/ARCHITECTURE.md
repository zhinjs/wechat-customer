# 架构设计

本文档详细说明WeChat SDK的架构设计和实现原理。

## 目录

1. [设计理念](#设计理念)
2. [整体架构](#整体架构)
3. [核心组件](#核心组件)
4. [数据流](#数据流)
5. [扩展机制](#扩展机制)

## 设计理念

WeChat SDK的设计遵循以下原则：

### 1. 统一接口（Facade Pattern）

为不同的通信方式提供统一的API，使用者无需关心底层实现细节。

```
应用层
   │
   └─→ WeChatSDK（统一接口）
        │
        ├─→ QClawChannel
        └─→ WorkBuddyChannel
```

### 2. 模块隔离（Separation of Concerns）

- 认证（Auth）：处理登录和token管理
- 通信（Channel）：处理与服务的连接
- 消息（Message）：处理消息格式转换和队列
- 存储（Storage）：管理凭证和消息的持久化

### 3. 易于扩展（Open/Closed Principle）

通过抽象基类`Channel`，可以轻松添加新的通信方式，而无需修改核心代码。

### 4. 错误隔离（Error Handling）

清晰的错误类型层次，方便精确处理不同的错误情况。

## 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                      应用层                              │
│              （使用者的业务代码）                         │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│                   SDK 层（WeChatSDK）                    │
│  ┌─── 配置管理 ─── 凭证管理 ──── 事件分发 ───┐         │
│  │                                            │         │
│  └────────────────┬─────────────────────────┘         │
└────────────────────┼─────────────────────────────────────┘
                     │
             ┌───────┴────────┐
             │                │
     ┌───────▼────────┐  ┌───▼────────────┐
     │ QClaw Channel  │  │WorkBuddy Channel│
     │                │  │                 │
     │┌──────────────┐│  │┌──────────────┐ │
     ││   WebSocket  ││  ││  Centrifuge  │ │
     │└──────────────┘│  ││   + HTTP     │ │
     │┌──────────────┐│  │└──────────────┘ │
     ││  Auth Flow   ││  │┌──────────────┐ │
     │└──────────────┘│  ││  Auth Flow   │ │
     └────────────────┘  └─────────────────┘
             │                │
             └────────┬───────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
    ┌───▼──────────┐         ┌──────▼─────┐
    │ Message Adapter│        │  Storage   │
    │ (格式转换)    │        │ (持久化)   │
    └────────────────┘        └────────────┘
```

### 分层设计

```
第1层：应用层
  - 使用者的业务代码
  - 直接调用SDK公开API

第2层：SDK层（WeChatSDK类）
  - 提供统一接口
  - 管理通道生命周期
  - 分发事件
  - 验证输入

第3层：通道层（Channel）
  - QClawChannel：WebSocket + JPRX
  - WorkBuddyChannel：Centrifuge + HTTP
  - 各自处理特定的通信协议

第4层：服务层
  - 认证服务
  - 消息适配器
  - 存储服务
  - 网络通信

第5层：微信API
  - 实际的微信服务
```

## 核心组件

### 1. WeChatSDK（主入口）

```typescript
class WeChatSDK {
  // 核心方法
  async connect()
  async disconnect()
  async sendMessage()
  async refreshCredentials()
  
  // 事件管理
  on<K>(event: K, listener: EventListener<K>)
  off<K>(event: K, listener: EventListener<K>)
  
  // 状态管理
  isConnectedState()
  getConnectionState()
  getCredentials()
  updateCredentials()
}
```

**职责:**
- 协调所有组件的工作
- 提供统一的API
- 管理SDK的生命周期
- 转发通道事件

### 2. Channel（通道基类）

```typescript
abstract class Channel extends EventEmitter {
  // 生命周期
  abstract onInitialize()
  abstract onConnect()
  abstract onDisconnect()
  
  // 消息
  abstract onSendMessage()
  abstract onSendRaw()
  
  // 凭证
  abstract onRefreshCredentials()
  
  // 事件转发
  protected dispatchMessage(message: Message)
  protected dispatchError(error: Error)
  protected setState(state: ConnectionState)
}
```

**职责:**
- 定义通道接口
- 提供公共实现（Template Method）
- 管理连接状态
- 处理消息和错误

### 3. QClawChannel（QClaw实现）

继承自`Channel`，实现QClaw特定的通信逻辑：

```typescript
class QClawChannel extends Channel {
  // WebSocket连接管理
  private wsClient: WebSocket
  
  // 协议处理（AGP）
  private handlePrompt(message)
  private handleCancel(message)
  
  // 消息适配
  private adaptMessage(agpMessage): Message
  
  // 认证
  private async onRefreshCredentials()
}
```

**特性:**
- WebSocket长连接
- AGP协议解析
- 消息格式适配
- Token刷新机制

### 4. WorkBuddyChannel（WorkBuddy实现）

继承自`Channel`，实现WorkBuddy特定的通信逻辑：

```typescript
class WorkBuddyChannel extends Channel {
  // Centrifuge连接
  private centrifugeClient: CentrifugeGatewayClient
  
  // HTTP回复
  private async sendHttpResponse(payload)
  
  // Channel订阅
  private async subscribeChannel(channelName)
  
  // 认证
  private async onRefreshCredentials()
}
```

**特性:**
- Centrifuge WebSocket连接
- HTTP回复通道
- 动态Channel订阅
- Token自动刷新

### 5. Logger（日志管理）

```typescript
class Logger {
  debug(message, context?)
  info(message, context?)
  warn(message, context?)
  error(message, error?)
  child(context)
}
```

**特性:**
- 多个日志级别
- 可自定义输出
- 上下文支持
- 子Logger生成

## 数据流

### 连接流程

```
应用调用sdk.connect()
    │
    ▼
验证凭证和配置
    │
    ▼
选择通信模式（auto/qclaw/workbuddy）
    │
    ▼
创建Channel实例
    │
    ▼
调用channel.initialize()
    │
    ▼
调用channel.connect()
    │
    ├─→ QClawChannel: 建立WebSocket连接
    │
    └─→ WorkBuddyChannel: 连接Centrifuge
    │
    ▼
更新连接状态为CONNECTED
    │
    ▼
触发'connected'事件
    │
    ▼
应用接收到连接成功事件
```

### 消息接收流程

```
服务发送消息
    │
    ▼
Channel接收到消息
    │
    ├─→ QClaw: AGP消息
    │    │
    │    ▼
    │    解析AGP Envelope
    │    │
    │    ▼
    │    提取ContentBlock
    │
    └─→ WorkBuddy: HTTP/WebSocket消息
         │
         ▼
         解析消息载荷
    │
    ▼
适配器转换为统一的Message格式
    │
    ▼
触发'message'事件
    │
    ▼
应用的message监听器被调用
    │
    │（应用线程）
    ▼
应用处理消息
    │
    ▼
应用调用sdk.sendMessage()
```

### 消息发送流程

```
应用调用sdk.sendMessage(request)
    │
    ▼
验证参数
    │
    ├─→ to和content不能为空
    │
    ├─→ content长度不超过4000
    │
    └─→ 必须已连接
    │
    ▼
调用channel.sendMessage()
    │
    ├─→ QClaw:
    │    │
    │    ▼
    │    生成message_id
    │    │
    │    ▼
    │    构造AGP Message
    │    │
    │    ▼
    │    通过WebSocket发送
    │
    └─→ WorkBuddy:
         │
         ▼
         构造HTTP payload
         │
         ▼
         POST到服务
    │
    ▼
等待服务确认
    │
    ▼
返回SendMessageResponse
    │
    ▼
应用检查response.success
```

## 扩展机制

### 添加新的通信方式

要添加新的通信方式（例如钉钉），只需：

#### 1. 创建Channel实现

```typescript
// src/sdk/channels/dingtalk/client.ts
import { Channel } from '../base.js';

export class DingTalkChannel extends Channel {
  protected async onInitialize(): Promise<void> {
    // 初始化逻辑
  }
  
  protected async onConnect(): Promise<void> {
    // 连接逻辑
  }
  
  protected async onDisconnect(): Promise<void> {
    // 断开逻辑
  }
  
  protected async onSendMessage(request): Promise<SendMessageResponse> {
    // 发送消息逻辑
  }
  
  protected async onSendRaw(data): Promise<void> {
    // 发送原始数据逻辑
  }
  
  protected async onRefreshCredentials(): Promise<void> {
    // 凭证刷新逻辑
  }
}
```

#### 2. 定义DingTalk凭证类型

```typescript
// 在types.ts中添加
export interface DingTalkCredentials {
  mode: 'dingtalk';
  accessToken: string;
  refreshToken?: string;
  // ... 其他DingTalk特定字段
}

// 更新ChannelCredentials类型
export type ChannelCredentials = 
  | QClawCredentials 
  | WorkBuddyCredentials 
  | DingTalkCredentials;
```

#### 3. 在SDK中注册

```typescript
// src/sdk/index.ts
private createChannel(): Channel {
  const mode = this.selectMode();
  
  if (mode === 'qclaw') {
    return this.createQClawChannel();
  } else if (mode === 'workbuddy') {
    return this.createWorkBuddyChannel();
  } else if (mode === 'dingtalk') {  // 新增
    return this.createDingTalkChannel();
  }
  // ...
}

private createDingTalkChannel(): Channel {
  const creds = this.config.credentials as DingTalkCredentials;
  return new DingTalkChannel(
    creds,
    this.config.connection,
    this.config.message,
    this.config.logger,
  );
}
```

#### 4. 使用新的通道

```typescript
const sdk = new WeChatSDK({
  mode: 'dingtalk',
  credentials: {
    mode: 'dingtalk',
    accessToken: 'your_token',
  },
});

await sdk.connect();
// 使用相同的API...
```

### 注意事项

1. **必须继承Channel**：确保实现所有抽象方法
2. **事件转发**：使用 `dispatchMessage()` 和 `dispatchError()` 方法
3. **状态管理**：使用 `setState()` 更新连接状态
4. **错误处理**：抛出适当的SDK错误类型
5. **日志记录**：使用 `this.logger` 记录操作日志

## 测试架构

```
单元测试
├── SDK核心测试（WeChatSDK）
├── Channel接口测试（各个实现）
├── 消息处理测试
└── 错误处理测试

集成测试
├── 连接流程测试
├── 消息收发测试
└── 多模式切换测试

E2E测试
├── 实际的微信连接测试
├── 消息往返测试
└── 长时间运行稳定性测试
```

## 性能考虑

### 内存优化

- 消息队列大小限制（默认1000）
- 日志缓冲机制
- 连接复用（单一WebSocket）

### 网络优化

- 心跳检测（30秒间隔）
- 消息压缩（如果支持）
- 连接复用

### CPU优化

- 非阻塞IO（async/await）
- 事件驱动架构
- 与号延迟处理

## 安全性

### 凭证管理

- 不在日志中输出完整token
- Token只在内存中存储
- 支持外部密钥管理系统

### 消息安全

- 支持HTTPS/WSS
- 服务器证书验证
- 消息签名验证（可选）

### 错误信息

- 敏感信息前缀清理
- 详细错误仅在DEBUG模式显示
- 用户友好的错误消息

---

更多信息请查看 [API文档](API.md) 和 [集成指南](INTEGRATION.md)。
