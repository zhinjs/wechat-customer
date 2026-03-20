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
// QClaw 模式（guid 是可选的，SDK 会自动生成）
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',           // ← 必须与外层 mode 一致
    channelToken: '...',     // 扫码后获得
    jwtToken: '...',         // 扫码后获得
    // guid 无需提供，SDK 自动生成并保存到 device.json
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
| `channelToken` | `string` | ✅ | 渠道鉴权 Token | 微信扫码登录/授权后由 JPRX 鉴权接口返回 |
| `jwtToken` | `string` | ✅ | JWT 身份令牌 | 与 `channelToken` 同步返回，用于服务端验证身份 |
| `guid` | `string` | ❌ | 设备唯一标识符（**通常无需提供**） | **SDK 自动生成并持久化**（oicq 模式），仅在需要迁移已有设备标识时手动填写 |
| `apiKey` | `string` | ❌ | 模型 API 调用密钥 | 如需调用 AI 模型接口时单独申请 |
| `userId` | `string` | ❌ | 用户 ID | 登录响应中的用户唯一标识，建议填写以便消息路由 |
| `wsUrl` | `string` | ❌ | 自定义 WebSocket 地址 | 默认 `wss://mmgrcalltoken.3g.qq.com/agentwss`，通常不需要修改 |
| `userInfo` | `object` | ❌ | 用户扩展信息 | 登录响应中附带的用户资料（昵称、头像等） |

### 设备 GUID 的自动管理（oicq 模式）

`guid` 是设备的唯一标识符，**SDK 会自动处理**，无需用户操心：

- **首次连接时**：若未提供 `guid`，SDK 自动生成一个 UUID 并保存到 `~/.wechat-sdk/device.json`。
- **后续连接时**：自动从 `device.json` 读取，与 oicq 的 `device.json` 模式完全一致。
- **重置设备**：调用 `clearDevice()` 删除 `device.json`，下次会生成新的 GUID（相当于换了一台设备）。

```
~/.wechat-sdk/
├── device.json    ← 设备 GUID（永久保存，clearSession() 不会清除）
└── session.json   ← 登录凭证（channelToken/jwtToken，可能过期）
```

### 如何获取 QClaw 凭证

QClaw 凭证通过 JPRX 平台的登录流程获得，典型步骤如下：

1. **触发扫码登录**：向 JPRX 鉴权接口发起登录请求，获取二维码，用微信扫码授权。

2. **接收凭证**：扫码成功后，鉴权接口返回 `channelToken`、`jwtToken` 以及用户信息。

3. **使用凭证初始化 SDK**（无需关心 `guid`）：
   ```typescript
   const sdk = new WeChatSDK({
     mode: 'qclaw',
     credentials: {
       mode: 'qclaw',
       channelToken: 'eyJhbGciOiJIUzI1NiJ9...',  // 扫码后获得
       jwtToken: 'eyJhbGciOiJSUzI1NiJ9...',       // 扫码后获得
       userId: '10001',                             // 可选，但建议填写
     },
     // guid 由 SDK 自动生成，无需传入
   });

   await sdk.connect();
   // ✓ guid 已自动生成并保存到 ~/.wechat-sdk/device.json
   // ✓ 凭证已自动保存到 ~/.wechat-sdk/session.json
   ```

> **注意**：`channelToken` 和 `jwtToken` 有有效期，过期后需要重新扫码或调用 `refreshCredentials()` 刷新。

### 最小凭证示例

```typescript
import { WeChatSDK } from 'wechat-sdk';

const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',
    channelToken: 'eyJhbGciOiJIUzI1NiJ9...',  // 扫码后获得
    jwtToken: 'eyJhbGciOiJSUzI1NiJ9...',       // 扫码后获得
  },
  // guid 自动生成，无需填写
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

- **首次启动**：提供 `channelToken` + `jwtToken`（QClaw）或 `accessToken`（WorkBuddy），`connect()` 成功后凭证自动写入 `~/.wechat-sdk/{mode}/session.json`。
- **后续启动**：只需指定 `mode`，`connect()` 自动从 `{mode}/session.json` 恢复，无需任何额外参数。
- **没有会话时**：触发 `loginRequired` 事件并抛出 `LoginRequiredError`。

### 存储文件说明

```
~/.wechat-sdk/
├── qclaw/
│   ├── device.json     QClaw 设备 GUID（永久，clearSession() 不清除）
│   └── session.json    QClaw 登录凭证（可能过期，clearSession() 会清除）
└── workbuddy/
    └── session.json    WorkBuddy 登录凭证
```

### 会话 API

| 方法 | 签名 | 说明 |
|------|------|------|
| `hasSavedSession()` | `() => Promise<boolean>` | 检查 `{mode}/session.json` 是否存在 |
| `loadSavedCredentials()` | `() => Promise<ChannelCredentials \| null>` | 读取已保存的凭证（不建立连接） |
| `clearSession()` | `() => Promise<void>` | 删除 `{mode}/session.json`（不影响 `device.json`） |
| `hasSavedDevice()` | `() => Promise<boolean>` | 检查 `{mode}/device.json` 是否存在（QClaw 专用） |
| `getOrCreateDeviceGuid()` | `() => Promise<string>` | 获取或生成设备 GUID（可在 `connect()` 前调用，QClaw 专用） |
| `clearDevice()` | `() => Promise<void>` | 删除 `{mode}/device.json`（下次生成新 GUID） |

### 自定义存储目录

```typescript
const sdk = new WeChatSDK({
  mode: 'qclaw',
  storage: {
    dir: '~/.my-app/wechat',   // 自定义基础目录；实际路径为 {dir}/qclaw/
    enablePersist: true,        // 默认 true，设为 false 禁用所有持久化
  },
});
```

### 禁用持久化

```typescript
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: { mode: 'qclaw', channelToken: '...', jwtToken: '...' },
  storage: { enablePersist: false },
});
```

---

## 完整生命周期示例

### 场景一：首次启动（QClaw）

```typescript
import { WeChatSDK } from 'wechat-sdk';

// 仅需提供登录凭证，guid 由 SDK 自动处理
const sdk = new WeChatSDK({
  mode: 'qclaw',           // 必填
  credentials: {
    mode: 'qclaw',
    channelToken: process.env.QCLAW_CHANNEL_TOKEN!,
    jwtToken: process.env.QCLAW_JWT_TOKEN!,
    // guid 无需提供，SDK 自动生成并保存到 ~/.wechat-sdk/qclaw/device.json
  },
  // 默认 enablePersist: true
  // 连接成功后：guid → device.json，全部凭证 → session.json
});

await sdk.connect();
console.log('首次连接成功，凭证已自动保存');

sdk.on('message', (msg) => {
  console.log('收到消息:', msg.content);
});
```

### 场景二：后续启动（只需 mode）

```typescript
import { WeChatSDK } from 'wechat-sdk';

// mode 必填；凭证自动从 ~/.wechat-sdk/qclaw/session.json 恢复
const sdk = new WeChatSDK({ mode: 'qclaw' });
await sdk.connect();
console.log('从会话文件恢复连接');
```

### 场景三：首次启动时的 loginRequired 流程

```typescript
import { WeChatSDK, LoginRequiredError } from 'wechat-sdk';

const sdk = new WeChatSDK({ mode: 'qclaw' });

sdk.on('loginRequired', async ({ mode, ...rest }) => {
  const guid = (rest as any).guid as string | undefined;
  console.log(`[${mode}] 需要登录，guid=${guid ?? 'n/a'}`);
  // 用 guid 完成扫码登录后，提供 token 并重新连接
  const { channelToken, jwtToken } = await doQClawLogin(guid!);
  sdk.updateCredentials({ mode: 'qclaw', channelToken, jwtToken });
  await sdk.connect();
});

try {
  await sdk.connect();
} catch (e) {
  if (!(e instanceof LoginRequiredError)) throw e;
}
```

### 场景四：重新登录（清除旧会话）

```typescript
import { WeChatSDK } from 'wechat-sdk';

const sdk = new WeChatSDK({ mode: 'qclaw' });
await sdk.clearSession(); // 清除 session.json（device.json 保留，guid 不变）
console.log('会话已清除，下次需重新提供凭证');
// 如需同时重置设备标识（慎用）:
// await sdk.clearDevice();
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
    refreshToken: process.env.WORKBUDDY_REFRESH_TOKEN!,
  },
});

await sdk.connect();

sdk.on('tokenRefreshed', () => {
  console.log('Token 已自动刷新并持久化');
});
```

### 场景六：读取当前凭证（调试用）

```typescript
import { WeChatSDK } from 'wechat-sdk';

const sdk = new WeChatSDK({ mode: 'qclaw' });
await sdk.connect();

const creds = sdk.getCredentials();
if (creds?.mode === 'qclaw') {
  console.log('设备 GUID:', creds.guid);
}

const saved = await sdk.loadSavedCredentials();
if (saved) {
  console.log('已保存的会话模式:', saved.mode);
}
```

---

## 常见问题
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',
    channelToken: process.env.QCLAW_CHANNEL_TOKEN!,  // 扫码后获得
    jwtToken: process.env.QCLAW_JWT_TOKEN!,           // 扫码后获得
    userId: process.env.QCLAW_USER_ID,
  },
  // 默认 enablePersist: true
  // 连接成功后：guid → device.json，全部凭证 → session.json
});

await sdk.connect();
console.log('首次连接成功，凭证已自动保存');

sdk.on('message', (msg) => {
  console.log('收到消息:', msg.content);
});
```

---

## 常见问题

### Q: 我需要手动管理 `guid` 吗？

**不需要**。QClaw 的 `guid` 字段已设为可选，SDK 会自动处理（参考 [oicq](https://github.com/takayama-lily/oicq) 的 `device.json` 模式）：

- 首次连接：自动生成 UUID 并保存到 `~/.wechat-sdk/qclaw/device.json`
- 后续连接：自动从 `device.json` 读取，保持同一设备身份
- 只有在需要迁移已有设备标识时才需手动传入 `guid`

### Q: `mode` 是必填的吗？

**是的**，`mode` 必须显式指定为 `'qclaw'` 或 `'workbuddy'`，不再有 `'auto'` 选项。原因：SDK 需要在连接之前知道 mode，才能从正确的目录（`~/.wechat-sdk/{mode}/`）加载会话文件，以及在 QClaw 模式下自动生成/加载设备 GUID。

```typescript
// ✅ 正确
new WeChatSDK({ mode: 'qclaw' });
new WeChatSDK({ mode: 'workbuddy' });

// ✅ 带凭证
new WeChatSDK({ mode: 'qclaw', credentials: { mode: 'qclaw', channelToken: '...', jwtToken: '...' } });

// ❌ 错误：mode 是必填项
// new WeChatSDK()  // TypeScript 编译报错
```

### Q: 什么时候需要重新传凭证？

以下情况需要重新传入登录凭证（并可能需要重新扫码/OAuth）：

- 首次使用，本地没有 `session.json`（会触发 `loginRequired` 事件）
- 调用了 `clearSession()` 后
- `channelToken` / `jwtToken`（QClaw）或 `accessToken` + `refreshToken`（WorkBuddy）全部过期

`clearDevice()` 只影响设备标识（GUID），不触发重新登录。

### Q: `clearSession()` 和 `clearDevice()` 有什么区别？

| 方法 | 清除 `session.json` | 清除 `device.json` | 影响 |
|------|:---:|:---:|------|
| `clearSession()` | ✅ | ❌ | 下次需重新提供登录凭证；设备 GUID 保留 |
| `clearDevice()` | ❌ | ✅ | 下次 QClaw 连接会生成新 GUID；登录凭证保留 |

通常只需要 `clearSession()`（相当于"登出"），而 `clearDevice()` 相当于"换设备"，慎用。

### Q: 会话文件存储的内容安全吗？

会话文件以 JSON 明文存储，包含敏感的 token 信息。建议确认 `~/.wechat-sdk/` 目录的权限为 `0700`（仅所有者可访问），且不要将该目录提交到 git。

### Q: 如何在无头（headless）服务器上使用？

1. 本地完成登录，获取 `channelToken` 和 `jwtToken`
2. 通过安全渠道将凭证传到服务器（环境变量、Secrets 管理器等）
3. 服务器首次运行时传入凭证，之后自动恢复

```typescript
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: {
    mode: 'qclaw',
    channelToken: process.env.QCLAW_CHANNEL_TOKEN!,
    jwtToken: process.env.QCLAW_JWT_TOKEN!,
    // guid 自动生成，无需在服务器上配置
  },
});
```

---

> 更多信息请查看 [API 文档](API.md) 和 [集成指南](INTEGRATION.md)。
