# WeChat Communication SDK

一个统一的微信通信SDK，支持 QClaw 和 WorkBuddy 两种通信方式。简化开发流程，提供一致的API接口，完善的文档和丰富的示例。

## 🎯 功能特性

- ✅ **双模式支持**：QClaw（WebSocket + JPRX）和 WorkBuddy（Centrifuge + HTTP）
- ✅ **统一接口**：无论选择哪种模式，都使用相同的API
- ✅ **自动认证**：支持OAuth、扫码登录、token自动刷新
- ✅ **可靠消息**：断线重连、消息队列、持久化存储
- ✅ **完善文档**：API文档、集成指南、代码示例
- ✅ **TypeScript支持**：完整的类型定义和IDE自动补全
- ✅ **易于扩展**：插件式架构，轻松支持新的通信方式

## 📦 项目结构

```
wechat-customer/
├── src/
│   ├── sdk/                          # 核心SDK
│   │   ├── index.ts                  # SDK入口
│   │   ├── types.ts                  # 通用类型定义
│   │   ├── error.ts                  # 错误定义
│   │   │
│   │   ├── channels/                 # 通信方式实现
│   │   │   ├── index.ts              # 导出
│   │   │   ├── base.ts               # 基础接口
│   │   │   ├── qclaw/                # QClaw实现
│   │   │   │   ├── client.ts
│   │   │   │   ├── auth.ts
│   │   │   │   └── types.ts
│   │   │   └── workbuddy/            # WorkBuddy实现
│   │   │       ├── client.ts
│   │   │       ├── auth.ts
│   │   │       └── types.ts
│   │   │
│   │   ├── message/                  # 消息处理
│   │   │   ├── adapter.ts            # 消息适配器
│   │   │   ├── queue.ts              # 消息队列
│   │   │   └── types.ts              # 消息类型
│   │   │
│   │   └── utils/                    # 工具函数
│   │       ├── storage.ts            # 文件存储
│   │       ├── logger.ts             # 日志记录
│   │       └── retry.ts              # 重试机制
│   │
│   ├── examples/                     # 使用示例
│   │   ├── basic.ts                  # 基础示例
│   │   ├── qclaw-login.ts            # QClaw登录示例
│   │   ├── workbuddy-login.ts        # WorkBuddy登录示例
│   │   └── message-handling.ts       # 消息处理示例
│   │
│   └── __tests__/                    # 单元测试
│       ├── channels.test.ts
│       ├── message.test.ts
│       └── auth.test.ts
│
├── docs/                             # 文档
│   ├── README-CN.md                  # 中文文档
│   ├── ARCHITECTURE.md               # 架构设计
│   ├── API.md                        # API文档
│   ├── INTEGRATION.md                # 集成指南
│   ├── EXAMPLES.md                   # 示例详解
│   └── TROUBLESHOOTING.md            # 故障排查
│
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.json
└── .prettierrc
```

## 🚀 快速开始

### 1. 安装

```bash
npm install @myorg/wechat-sdk
# 或
yarn add @myorg/wechat-sdk
```

### 2. 基础使用

```typescript
import { WeChatSDK } from '@myorg/wechat-sdk';

// 首次启动：提供凭证，连接成功后自动保存到 ~/.wechat-sdk/session.json
const sdk = new WeChatSDK({
  mode: 'auto',
  credentials: {
    mode: 'qclaw',          // 或 'workbuddy'
    // ... 见下方"凭证快速参考"
  },
});

await sdk.connect();

// 后续启动：不传 credentials，SDK 自动从会话文件恢复
// const sdk = new WeChatSDK();
// await sdk.connect();

// 监听消息
sdk.on('message', (msg) => {
  console.log('收到消息:', msg.content);
});

// 发送消息
await sdk.sendMessage({
  to: 'user_id',
  content: '你好',
});

// 断开连接
await sdk.disconnect();
```

### 3. 凭证快速参考

> 详细说明（字段含义、获取方式、会话持久化）请查看 [凭证指南](docs/CREDENTIALS.md)。

#### QClaw 模式（WebSocket + JPRX 网关）

```typescript
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',           // ← 固定值
    channelToken: '...',     // 扫码/JPRX 鉴权后获得
    jwtToken: '...',         // 与 channelToken 同步返回
    userId: '...',           // 可选，用户 ID
    // guid 无需提供——SDK 自动生成并保存到 ~/.wechat-sdk/device.json（oicq 模式）
  },
});
```

#### WorkBuddy 模式（Centrifuge + HTTP）

```typescript
const sdk = new WeChatSDK({
  mode: 'workbuddy',
  credentials: {
    mode: 'workbuddy',       // ← 固定值
    userId: '...',           // OAuth 返回的用户 ID
    accessToken: '...',      // OAuth 访问令牌
    refreshToken: '...',     // OAuth 刷新令牌（建议提供，用于自动刷新）
  },
});
```

#### 首次之后无需再传凭证

```typescript
// connect() 自动从 ~/.wechat-sdk/session.json 恢复上次保存的凭证
const sdk = new WeChatSDK();
await sdk.connect();

// 需要重新登录时清除会话
await sdk.clearSession();
```

## 📚 文档指南

| 文档 | 内容 |
|------|------|
| [凭证指南](docs/CREDENTIALS.md) | 凭证字段说明、获取方式、会话持久化完整指南 |
| [API文档](docs/API.md) | 完整的API参考 |
| [集成指南](docs/INTEGRATION.md) | 详细的集成步骤 |
| [架构设计](docs/ARCHITECTURE.md) | SDK设计和实现细节 |
| [代码示例](docs/EXAMPLES.md) | 常见场景的代码示例 |
| [故障排查](docs/TROUBLESHOOTING.md) | 常见问题和解决方案 |

## 🏗️ 架构概览

```
┌─────────────────────────────────────┐
│      应用层（你的应用代码）           │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│     WeChatSDK 统一接口层             │
│  ├─ 连接管理                        │
│  ├─ 消息处理                        │
│  ├─ 事件分发                        │
│  └─ 认证管理                        │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐  ┌────▼─────────┐
│  QClaw      │  │  WorkBuddy   │
│  通信层      │  │  通信层       │
│             │  │              │
│ WebSocket   │  │ Centrifuge   │
│ + JPRX      │  │ + HTTP       │
└─────────────┘  └──────────────┘
       │               │
       └───────┬───────┘
               │
        ┌──────▼──────────┐
        │  微信服务 API   │
        └─────────────────┘
```

## 🎯 核心概念

### 1. 通信模式（Channel）
- **QClaw**：通过微信JPRX网关的WebSocket连接
- **WorkBuddy**：通过Centrifuge和HTTP的混合模式

### 2. 认证（Authentication）
- 自动处理OAuth流程
- 支持扫码登录
- 自动token刷新
- 安全存储凭证

### 3. 消息处理（Messaging）
- 统一的消息格式
- 自动重试机制
- 消息队列
- 断线恢复

### 4. 事件系统（Events）
- `connected`：连接已建立
- `disconnected`：连接已断开
- `message`：收到新消息
- `error`：发生错误
- `tokenRefreshed`：Token已刷新

## ⚙️ 配置选项

### SDK初始化配置

```typescript
interface SDKConfig {
  // 通信模式：'auto' 自动选择、'qclaw' 或 'workbuddy'
  mode?: 'auto' | 'qclaw' | 'workbuddy';
  
  // 凭证信息
  credentials?: ChannelCredentials;
  
  // 连接配置
  connection?: {
    timeout?: number;           // 连接超时时间（毫秒）
    reconnectInterval?: number; // 重连间隔（毫秒）
    maxReconnectAttempts?: number; // 最大重连次数
  };
  
  // 消息配置
  message?: {
    timeout?: number;           // 消息发送超时（毫秒）
    retryAttempts?: number;    // 重试次数
    queueSize?: number;        // 队列大小
  };
  
  // 日志配置
  logger?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    output?: (log: string) => void;
  };
  
  // 存储配置
  storage?: {
    dir?: string;              // 存储目录
    enablePersist?: boolean;   // 是否持久化
  };
}
```

## 🔐 安全最佳实践

1. **凭证管理**
   - 不要在代码中硬编码凭证
   - 使用环境变量或安全的密钥管理服务
   - 定期轮换token

2. **连接安全**
   - 始终使用HTTPS/WSS
   - 验证服务器证书
   - 使用强密码和OAuth 2.0

3. **消息安全**
   - 加密敏感信息
   - 验证消息来源
   - 实施消息签名

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- channels.test.ts

# 生成覆盖率报告
npm test -- --coverage
```

## 📊 性能指标

| 指标 | 目标值 |
|------|-------|
| 连接建立时间 | < 2s |
| 消息延迟 | < 100ms |
| 消息吞吐量 | > 100 msg/s |
| 内存占用 | < 50MB |
| CPU占用 | < 5% |

## 🐛 Bug 报告与反馈

如遇问题，请提供：
1. 完整的错误信息和堆栈跟踪
2. 复现步骤
3. SDK版本和环境信息
4. 相关日志

## 📝 更新日志

### v1.0.0（计划中）
- ✅ QClaw通信方式
- ✅ WorkBuddy通信方式
- ✅ 统一SDK接口
- ✅ 完整文档和示例

## 📄 许可证

MIT LICENSE

## 🤝 贡献指南

欢迎贡献代码、报告bug或提出建议！

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

---

**开始使用**：查看 [集成指南](docs/INTEGRATION.md) 了解详细步骤。

**需要帮助**？查看 [API文档](docs/API.md) 或 [故障排查](docs/TROUBLESHOOTING.md)。