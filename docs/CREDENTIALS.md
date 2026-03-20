# 会话凭证指南

本文档详细说明两种通信模式（QClaw 和 WorkBuddy）的会话凭证：每个字段的含义、来源，以及如何在首次启动和后续启动时传递凭证。

## 目录

1. [凭证概览](#凭证概览)
2. [QClaw 凭证](#qclaw-凭证)
3. [WorkBuddy 凭证](#workbuddy-凭证)
4. [会话持久化（自动保存与恢复）](#会话持久化自动保存与恢复)
5. [完整生命周期示例](#完整生命周期示例)
6. [常见问题](#常见问题)

---

## 凭证概览

SDK 支持两种通信模式，每种模式需要不同的凭证集合。凭证通过 `credentials` 配置项传入 `WeChatSDK`，必须包含 `mode` 字段以区分模式：

```typescript
// QClaw 模式
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',           // ← 必须与外层 mode 一致
    guid: '...',
    channelToken: '...',
    jwtToken: '...',
  },
});

// WorkBuddy 模式
const sdk = new WeChatSDK({
  mode: 'workbuddy',
  credentials: {
    mode: 'workbuddy',       // ← 必须与外层 mode 一致
    userId: '...',
    accessToken: '...',
  },
});
```

> **提示**：如果不传 `credentials`，SDK 会自动尝试从本地会话文件恢复（见[会话持久化](#会话持久化自动保存与恢复)章节）。

---

## QClaw 凭证

QClaw 通过微信 JPRX 网关（`wss://mmgrcalltoken.3g.qq.com/agentwss`）进行 WebSocket 通信。

### 字段说明

| 字段 | 类型 | 必填 | 说明 | 来源 |
|------|------|------|------|------|
| `mode` | `'qclaw'` | ✅ | 固定值，标识模式 | 固定写 `'qclaw'` |
| `guid` | `string` | ✅ | 设备唯一标识符（GUID） | 首次注册设备时由 JPRX 平台分配，通常为 UUID 格式 |
| `channelToken` | `string` | ✅ | 渠道鉴权 Token | 微信扫码登录/授权后由 JPRX 鉴权接口返回 |
| `jwtToken` | `string` | ✅ | JWT 身份令牌 | 与 `channelToken` 同步返回，用于服务端验证身份 |
| `apiKey` | `string` | ❌ | 模型 API 调用密钥 | 如需调用 AI 模型接口时单独申请 |
| `userId` | `string` | ❌ | 用户 ID | 登录响应中的用户唯一标识，建议填写以便消息路由 |
| `wsUrl` | `string` | ❌ | 自定义 WebSocket 地址 | 默认 `wss://mmgrcalltoken.3g.qq.com/agentwss`，通常不需要修改 |
| `userInfo` | `object` | ❌ | 用户扩展信息 | 登录响应中附带的用户资料（昵称、头像等） |

### 如何获取 QClaw 凭证

QClaw 凭证通过 JPRX 平台的登录流程获得，典型步骤如下：

1. **生成设备 GUID**：首次使用时生成一个 UUID 作为设备标识，后续沿用同一个 GUID：
   ```typescript
   import { randomUUID } from 'crypto';
   const guid = randomUUID(); // 例：'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
   ```

2. **触发扫码登录**：向 JPRX 鉴权接口发送设备 GUID，获取二维码，用微信扫码授权。

3. **接收凭证**：扫码成功后，鉴权接口返回 `channelToken`、`jwtToken` 以及用户信息。

4. **使用凭证初始化 SDK**：
   ```typescript
   const sdk = new WeChatSDK({
     mode: 'qclaw',
     credentials: {
       mode: 'qclaw',
       guid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
       channelToken: 'eyJhbGciOiJIUzI1NiJ9...',
       jwtToken: 'eyJhbGciOiJSUzI1NiJ9...',
       userId: '10001',
       userInfo: { nickname: '张三', avatar: 'https://...' },
     },
   });
   ```

> **注意**：`channelToken` 和 `jwtToken` 有有效期，过期后需要重新扫码或调用 `refreshCredentials()` 刷新。

### 最小凭证示例

```typescript
import { WeChatSDK } from 'wechat-sdk';

const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',
    guid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  // 设备 GUID（首次生成，后续固定）
    channelToken: 'eyJhbGciOiJIUzI1NiJ9...',         // 扫码后获得
    jwtToken: 'eyJhbGciOiJSUzI1NiJ9...',              // 扫码后获得
  },
});

await sdk.connect();
```

---

## WorkBuddy 凭证

WorkBuddy 通过 Centrifuge WebSocket（`wss://copilot.tencent.com/centrifuge`）接收消息，通过 HTTP API（`https://copilot.tencent.com`）发送消息。

### 字段说明

| 字段 | 类型 | 必填 | 说明 | 来源 |
|------|------|------|------|------|
| `mode` | `'workbuddy'` | ✅ | 固定值，标识模式 | 固定写 `'workbuddy'` |
| `userId` | `string` | ✅ | 用户唯一 ID | OAuth 登录后由 CodeBuddy API 返回的用户标识 |
| `accessToken` | `string` | ✅ | 访问令牌（Bearer Token） | OAuth 2.0 授权成功后返回，用于 API 调用和 WebSocket 鉴权 |
| `refreshToken` | `string` | ❌ | 刷新令牌 | OAuth 登录时一并返回，用于 `accessToken` 过期后自动刷新，强烈建议提供 |
| `hostId` | `string` | ❌ | 主机/实例 ID | 多实例部署时标识具体实例，通常由管理后台提供 |
| `baseUrl` | `string` | ❌ | API 基础地址 | 默认 `https://copilot.tencent.com`，私有化部署时修改 |
| `userInfo` | `object` | ❌ | 用户扩展信息 | OAuth 响应中的用户资料（昵称、头像等） |

### 如何获取 WorkBuddy 凭证

WorkBuddy 使用标准 OAuth 2.0 流程：

1. **发起 OAuth 授权**：引导用户访问 CodeBuddy 授权页面，完成登录授权。

2. **接收授权码（code）**：授权完成后，回调 URL 携带 `code` 参数。

3. **换取令牌**：用 `code` 调用令牌端点获取 `accessToken`、`refreshToken` 和用户信息：
   ```bash
   POST https://copilot.tencent.com/api/auth/token
   Content-Type: application/json

   { "code": "<授权码>", "redirectUri": "<回调地址>" }
   ```
   响应：
   ```json
   {
     "userId": "uid_123456",
     "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
     "refreshToken": "v1.refresh.abc123...",
     "expiresIn": 3600
   }
   ```

4. **使用凭证初始化 SDK**：
   ```typescript
   const sdk = new WeChatSDK({
     mode: 'workbuddy',
     credentials: {
       mode: 'workbuddy',
       userId: 'uid_123456',
       accessToken: 'eyJhbGciOiJSUzI1NiJ9...',
       refreshToken: 'v1.refresh.abc123...',
     },
   });
   ```

### 最小凭证示例

```typescript
import { WeChatSDK } from 'wechat-sdk';

const sdk = new WeChatSDK({
  mode: 'workbuddy',
  credentials: {
    mode: 'workbuddy',
    userId: 'uid_123456',                           // OAuth 返回的用户 ID
    accessToken: 'eyJhbGciOiJSUzI1NiJ9...',         // OAuth 返回的访问令牌
    refreshToken: 'v1.refresh.abc123...',            // OAuth 返回的刷新令牌（建议提供）
  },
});

await sdk.connect();
```

---

## 会话持久化（自动保存与恢复）

SDK 内置了会话持久化机制，**大幅简化首次之后的启动流程**：

- **首次启动**：提供完整凭证，`connect()` 成功后自动将凭证写入 `~/.wechat-sdk/session.json`。
- **后续启动**：不传 `credentials`，`connect()` 自动从 `session.json` 恢复凭证，无需任何额外参数。

### 会话 API

| 方法 | 签名 | 说明 |
|------|------|------|
| `hasSavedSession()` | `() => Promise<boolean>` | 检查是否有已保存的会话文件 |
| `loadSavedCredentials()` | `() => Promise<ChannelCredentials \| null>` | 读取已保存的凭证（不建立连接） |
| `clearSession()` | `() => Promise<void>` | 删除会话文件（下次需要重新传入凭证） |

### 存储位置

会话文件默认保存在：

```
~/.wechat-sdk/session.json
```

可通过 `storage.dir` 自定义位置：

```typescript
const sdk = new WeChatSDK({
  storage: {
    dir: '~/.my-app/wechat',   // 自定义目录
    enablePersist: true,        // 默认 true，设为 false 禁用所有持久化
  },
});
```

### 禁用持久化

如需完全禁用自动保存和恢复（例如在 CI/CD 或无状态服务中），将 `enablePersist` 设为 `false`：

```typescript
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: { /* 每次都显式传入 */ },
  storage: { enablePersist: false },
});
```

---

## 完整生命周期示例

### 场景一：首次启动（QClaw）

```typescript
import { WeChatSDK } from 'wechat-sdk';

// 凭证从环境变量或外部登录流程获取
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',
    guid: process.env.QCLAW_GUID!,
    channelToken: process.env.QCLAW_CHANNEL_TOKEN!,
    jwtToken: process.env.QCLAW_JWT_TOKEN!,
    userId: process.env.QCLAW_USER_ID,
  },
  // 默认 enablePersist: true，连接成功后自动保存到 ~/.wechat-sdk/session.json
});

await sdk.connect();
console.log('首次连接成功，凭证已自动保存');

sdk.on('message', (msg) => {
  console.log('收到消息:', msg.content);
});
```

### 场景二：后续启动（无需再传凭证）

```typescript
import { WeChatSDK } from 'wechat-sdk';

// 不传 credentials，SDK 自动从 ~/.wechat-sdk/session.json 恢复
const sdk = new WeChatSDK();
await sdk.connect();
console.log('从会话文件恢复连接');
```

### 场景三：首次启动失败时的检查与提示

```typescript
import { WeChatSDK } from 'wechat-sdk';

const sdk = new WeChatSDK();

const hasSession = await sdk.hasSavedSession();
if (!hasSession) {
  console.error('未找到会话文件，请提供凭证后重新启动。');
  console.error('示例：设置以下环境变量后重启');
  console.error('  QClaw:     QCLAW_GUID, QCLAW_CHANNEL_TOKEN, QCLAW_JWT_TOKEN');
  console.error('  WorkBuddy: WORKBUDDY_USER_ID, WORKBUDDY_ACCESS_TOKEN');
  process.exit(1);
}

await sdk.connect();
```

### 场景四：重新登录（清除旧会话）

```typescript
import { WeChatSDK } from 'wechat-sdk';

// 清除旧会话，下次启动必须重新传入凭证
const sdk = new WeChatSDK();
await sdk.clearSession();
console.log('会话已清除，请重新提供凭证并启动');
```

### 场景五：WorkBuddy Token 自动刷新

```typescript
import { WeChatSDK } from 'wechat-sdk';

const sdk = new WeChatSDK({
  mode: 'workbuddy',
  credentials: {
    mode: 'workbuddy',
    userId: process.env.WORKBUDDY_USER_ID!,
    accessToken: process.env.WORKBUDDY_ACCESS_TOKEN!,
    refreshToken: process.env.WORKBUDDY_REFRESH_TOKEN!,  // 必须提供才能自动刷新
  },
});

await sdk.connect();

// SDK 会在 token 过期后自动调用 refreshCredentials()
// 刷新后的新 token 会自动写回会话文件
sdk.on('tokenRefreshed', () => {
  console.log('Token 已自动刷新并持久化');
});

// 也可以手动触发刷新
try {
  await sdk.refreshCredentials();
} catch (err) {
  console.error('Token 刷新失败，需要重新登录:', err);
  await sdk.clearSession(); // 清除过期会话
}
```

### 场景六：读取当前凭证（调试用）

```typescript
import { WeChatSDK } from 'wechat-sdk';

const sdk = new WeChatSDK();
await sdk.connect();

// 获取当前生效的凭证（包括刷新后的最新值）
const creds = sdk.getCredentials();
if (creds?.mode === 'qclaw') {
  console.log('QClaw 用户 ID:', creds.userId);
  console.log('设备 GUID:', creds.guid);
} else if (creds?.mode === 'workbuddy') {
  console.log('WorkBuddy 用户 ID:', creds.userId);
  console.log('Access Token 前缀:', creds.accessToken.slice(0, 20) + '...');
}

// 也可以在未连接时查看已保存的凭证
const saved = await sdk.loadSavedCredentials();
if (saved) {
  console.log('已保存的会话模式:', saved.mode);
}
```

---

## 常见问题

### Q: `mode` 字段要写两次吗？

是的。外层 `mode` 告诉 SDK 使用哪种通道，`credentials.mode` 用于 TypeScript 类型辨别（discriminated union），两者必须一致：

```typescript
// ✅ 正确
new WeChatSDK({ mode: 'qclaw', credentials: { mode: 'qclaw', ... } });

// ✅ 也可以用 'auto'，SDK 根据 credentials.mode 自动选择
new WeChatSDK({ mode: 'auto', credentials: { mode: 'qclaw', ... } });

// ❌ 错误：mode 不一致
new WeChatSDK({ mode: 'workbuddy', credentials: { mode: 'qclaw', ... } });
```

### Q: 什么时候需要重新传凭证？

以下情况需要重新传入凭证（并可能需要重新登录）：

- 首次使用，本地没有会话文件
- 调用了 `clearSession()` 后
- `channelToken` / `jwtToken`（QClaw）或 `accessToken` + `refreshToken`（WorkBuddy）全部过期
- 换了新设备或清除了 `~/.wechat-sdk` 目录

### Q: 会话文件存储的内容安全吗？

会话文件以 JSON 明文存储，包含敏感的 token 信息。建议：

- 确认 `~/.wechat-sdk/` 目录的权限为 `0700`（仅所有者可访问）
- 不要将 `~/.wechat-sdk/` 目录提交到 git（`.gitignore` 中已包含 `.env` 等，请确认该目录也被排除）
- 在生产环境中考虑使用系统密钥链（Keychain / Secret Service）替代文件存储

### Q: 如何在无头（headless）服务器上使用？

在无 GUI 的服务器上：

1. 首次在本地机器完成登录，获取凭证
2. 通过安全渠道将凭证传到服务器（环境变量、Secrets 管理器等）
3. 服务器上首次运行时传入凭证，之后自动从会话文件恢复

```typescript
// 服务器端示例（从环境变量读取）
const sdk = new WeChatSDK({
  mode: process.env.WECHAT_MODE as 'qclaw' | 'workbuddy',
  credentials: process.env.WECHAT_MODE === 'qclaw' ? {
    mode: 'qclaw',
    guid: process.env.QCLAW_GUID!,
    channelToken: process.env.QCLAW_CHANNEL_TOKEN!,
    jwtToken: process.env.QCLAW_JWT_TOKEN!,
  } : {
    mode: 'workbuddy',
    userId: process.env.WORKBUDDY_USER_ID!,
    accessToken: process.env.WORKBUDDY_ACCESS_TOKEN!,
    refreshToken: process.env.WORKBUDDY_REFRESH_TOKEN,
  },
});
```

### Q: `refreshCredentials()` 和 `updateCredentials()` 有什么区别？

| 方法 | 说明 |
|------|------|
| `refreshCredentials()` | 调用底层通道的 token 刷新 API，自动获取新 token 并持久化。异步操作，可能失败。 |
| `updateCredentials(creds)` | 手动覆盖当前内存中的凭证。不会触发任何网络请求，也不会自动持久化。 |

---

> 更多信息请查看 [API 文档](API.md) 和 [集成指南](INTEGRATION.md)。
