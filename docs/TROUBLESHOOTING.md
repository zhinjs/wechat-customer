# 故障排查指南

常见问题和解决方案。

## 目录

1. [连接问题](#连接问题)
2. [认证问题](#认证问题)
3. [消息发送问题](#消息发送问题)
4. [性能问题](#性能问题)
5. [日志和调试](#日志和调试)

## 连接问题

### 问题：无法连接到服务

**症状：** `ConnectionError: Cannot connect to service`

**原因分析：**

1. **网络连接问题**
   - 检查网络连接是否正常
   - 尝试ping服务地址
   - 检查防火墙设置

2. **凭证配置错误**
   - 检查WebSocket URL是否正确
   - 验证token是否有效
   - 确认设备GUID正确

3. **服务故障**
   - 检查微信服务是否正常
   - 查看服务状态页面
   - 联系技术支持

**解决方案：**

```typescript
import { WeChatSDK, ConnectionError } from 'wechat-sdk';

async function debugConnection() {
  const sdk = new WeChatSDK({
    mode: 'qclaw',
    credentials: {
      mode: 'qclaw',
      guid: 'your-guid',
      channelToken: 'your-token',
      jwtToken: 'your-jwt',
      wsUrl: 'wss://mmgrcalltoken.3g.qq.com/agentwss',
    },
    logger: {
      level: 'debug', // 启用调试日志
      console: true,
    },
  });

  try {
    console.log('测试网络连接...');
    const response = await fetch(
      'wss://mmgrcalltoken.3g.qq.com/agentwss',
      { method: 'HEAD' }
    );
    console.log('WebSocket地址可访问');

    console.log('尝试连接SDK...');
    await sdk.connect();
    console.log('✓ 连接成功');
  } catch (error) {
    if (error instanceof ConnectionError) {
      console.error('连接错误:', error.message);
      console.error('详情:', error.details);
    } else {
      console.error('未知错误:', error);
    }
  } finally {
    await sdk.disconnect();
  }
}
```

**检查清单：**

- [ ] 网络连接正常（ping google.com）
- [ ] WebSocket地址正确
- [ ] Token有效且未过期
- [ ] 防火墙允许WebSocket连接
- [ ] DNS解析正确

---

### 问题：连接后立即断开

**症状：** 连接成功但随即断开，收到 `disconnected` 事件

**原因：**

1. **Token过期**
   - Token已失效
   - token刷新方法调用失败

2. **心跳检测失败**
   - 网络不稳定
   - 服务超时设置太短

3. **通道实现错误**
   - 未正确处理心跳
   - 缺少自动重连逻辑

**解决方案：**

```typescript
const sdk = new WeChatSDK({
  mode: 'qclaw',
  credentials: { /* ... */ },
  connection: {
    timeout: 10000,           // 增加超时时间
    heartbeatInterval: 30000, // 设置心跳间隔
    reconnectInterval: 3000,  // 重连间隔
  },
  logger: {
    level: 'debug',
    output: (log) => {
      // 记录所有日志
      console.log(`[${log.level}] ${log.message}`, log.context);
    },
  },
});

sdk.on('disconnected', ({ reason }) => {
  console.warn(`连接已断开: ${reason}`);
  
  // 检查是否是token过期
  if (reason.includes('token') || reason.includes('expired')) {
    console.log('Token可能已过期，尝试刷新...');
    sdk.refreshCredentials().catch(console.error);
  }
});
```

---

## 认证问题

### 问题：Token已过期

**症状：** `TokenExpiredError: Token已过期`

**原因：**

1. Token使用超过有效期
2. Token被服务端撤销
3. 跨设备登录导致token失效

**解决方案：**

```typescript
import { TokenExpiredError } from 'wechat-sdk';

async function robustSendMessage(sdk, to, content) {
  try {
    return await sdk.sendMessage({ to, content });
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      console.log('Token已过期，尝试刷新...');
      try {
        await sdk.refreshCredentials();
        console.log('✓ Token已刷新');
        // 重试
        return await sdk.sendMessage({ to, content });
      } catch (refreshError) {
        console.error('✗ Token刷新失败:', refreshError);
        console.log('需要重新登录');
        // 触发重新登录流程
        process.exit(1);
      }
    }
    throw error;
  }
}
```

### 问题：凭证验证失败

**症状：** `AuthenticationError: Authentication failed`

**原因：**

1. 凭证格式不正确
2. 必需字段缺失
3. 凭证对不匹配

**检查方法：**

```typescript
import { ValidationError } from 'wechat-sdk';

function validateCredentials(credentials) {
  if (credentials.mode === 'qclaw') {
    const required = ['guid', 'channelToken', 'jwtToken'];
    for (const field of required) {
      if (!credentials[field]) {
        throw new ValidationError(`缺少必需字段: ${field}`);
      }
      if (typeof credentials[field] !== 'string') {
        throw new ValidationError(`字段${field}必须是字符串`);
      }
    }
  } else if (credentials.mode === 'workbuddy') {
    const required = ['userId', 'accessToken'];
    for (const field of required) {
      if (!credentials[field]) {
        throw new ValidationError(`缺少必需字段: ${field}`);
      }
    }
  }
}

// 使用
try {
  validateCredentials(credentials);
  const sdk = new WeChatSDK({ credentials });
} catch (error) {
  console.error('凭证验证失败:', error);
}
```

---

## 消息发送问题

### 问题：消息发送超时

**症状：** `TimeoutError: Message send timeout`

**原因：**

1. 网络延迟过高
2. 服务端处理缓慢
3. 超时时间设置过短

**解决方案：**

```typescript
const response = await sdk.sendMessage({
  to: 'user_id',
  content: '消息内容',
  timeout: 60000, // 增加超时时间至60秒
});

// 或在SDK配置时设置
const sdk = new WeChatSDK({
  credentials: { /* ... */ },
  message: {
    timeout: 60000, // 全局消息超时
  },
});
```

### 问题：消息参数验证失败

**症状：** `ValidationError: 消息参数无效`

**原因：**

1. `to` 字段为空
2. `content` 字段为空或超长
3. 内容包含非法字符

**解决方案：**

```typescript
function validateMessage(to, content) {
  // 检查接收者
  if (!to || to.trim() === '') {
    throw new Error('接收者ID不能为空');
  }

  // 检查内容
  if (!content || content.trim() === '') {
    throw new Error('消息内容不能为空');
  }

  // 检查长度
  if (content.length > 4000) {
    throw new Error('消息内容过长，最长4000字符');
  }

  // 检查非法字符（可选）
  if (/[\x00-\x08\x0B-\x0C\x0E-\x1F]/.test(content)) {
    throw new Error('消息包含非法字符');
  }

  return true;
}

// 使用
try {
  validateMessage(to, content);
  const response = await sdk.sendMessage({ to, content });
} catch (error) {
  console.error('消息验证失败:', error);
}
```

### 问题：大量消息失败

**症状：** 批量发送消息时，部分或全部失败

**原因：**

1. 触发限流
2. 服务过载
3. 网络不稳定

**解决方案：**

```typescript
class ThrottledSender {
  private queue = [];
  private isRunning = false;
  private messagesPerSecond = 10; // 每秒10条消息

  async send(to, content) {
    return new Promise((resolve, reject) => {
      this.queue.push({ to, content, resolve, reject });
      if (!this.isRunning) {
        this.process();
      }
    });
  }

  private async process() {
    this.isRunning = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(
        0,
        this.messagesPerSecond
      );

      // 并发发送（限制并发数）
      const promises = batch.map(({ to, content, resolve, reject }) => {
        sdk.sendMessage({ to, content })
          .then(resolve)
          .catch(reject);
      });

      // 等待一秒再发送下一批
      await new Promise(r => setTimeout(r, 1000));

      // 等待所有请求完成
      await Promise.allSettled(promises);
    }

    this.isRunning = false;
  }
}
```

---

## 性能问题

### 问题：内存占用过高

**症状：** 内存使用量不断增加

**原因：**

1. 消息队列未清理
2. 事件监听器未移除
3. 连接未正确关闭

**解决方案：**

```typescript
// 1. 定期清理消息队列
const sdk = new WeChatSDK({
  credentials: { /* ... */ },
  message: {
    queueSize: 1000, // 限制队列大小
  },
});

// 2. 移除不用的事件监听
const handler = (message) => { /* ... */ };
sdk.on('message', handler);

// 使用完毕后移除
sdk.off('message', handler);

// 3. 正确的清理流程
async function cleanup() {
  // 移除所有监听
  sdk.removeAllListeners();

  // 断开连接
  await sdk.disconnect();

  // 清空引用
  sdk = null;

  // 强制垃圾回收（Node.js）
  if (global.gc) {
    global.gc();
  }
}

// 运行: node --expose-gc app.js
```

### 问题：CPU占用率过高

**症状：** CPU使用率持续在50%以上

**原因：**

1. 日志记录过于频繁
2. 消息处理的同步操作阻塞了事件循环
3. 存在死循环或频繁的重连

**解决方案：**

```typescript
// 1. 降低日志级别
const sdk = new WeChatSDK({
  credentials: { /* ... */ },
  logger: {
    level: 'info', // 改为 info，避免 debug 日志
  },
});

// 2. 使用异步处理消息
sdk.on('message', async (message) => {
  // 使用 async/await 避免阻塞
  try {
    // 异步处理
    await processMessage(message);
  } catch (error) {
    console.error('处理失败:', error);
  }
});

// 3. 使用消息队列处理高并发
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 10 });

sdk.on('message', (message) => {
  queue.add(() => processMessage(message));
});

// 4. 检查重连循环
sdk.on('disconnected', async () => {
  console.log('连接已断开，30秒后重试');
  // 避免立即重连
  await new Promise(r => setTimeout(r, 30000));
  await sdk.connect();
});
```

---

## 日志和调试

### 启用调试日志

```typescript
const sdk = new WeChatSDK({
  credentials: { /* ... */ },
  logger: {
    level: 'debug',
    console: true,
    output: (log) => {
      // 自定义输出（例如保存到文件）
      const logFile = './sdk.log';
      const logLine = `[${new Date().toISOString()}] [${log.level}] ${log.message}\n`;
      require('fs').appendFileSync(logFile, logLine);
    },
  },
});
```

### 常用调试命令

```bash
# 查看SDK版本
node -e "console.log(require('wechat-sdk/package.json').version)"

# 测试连接
node -e "
  const { WeChatSDK } = require('wechat-sdk');
  const sdk = new WeChatSDK({ credentials: {...} });
  sdk.connect().then(() => {
    console.log('✓ 连接成功');
    sdk.disconnect();
  }).catch(e => console.error('✗ 连接失败:', e));
"

# 启用Node.js调试器
node --inspect app.js
# 然后在 chrome://inspect 中调试
```

### 获取诊断信息

```typescript
function getDiagnostics(sdk) {
  return {
    connected: sdk.isConnectedState(),
    state: sdk.getConnectionState(),
    credentials: {
      mode: sdk.getCredentials()?.mode,
      // 不要输出敏感信息
    },
    platform: process.platform,
    nodeVersion: process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}

// 输出诊断信息
console.log(JSON.stringify(getDiagnostics(sdk), null, 2));
```

### 性能分析

```typescript
import { performance } from 'perf_hooks';

// 测量连接时间
const connectStart = performance.now();
await sdk.connect();
const connectTime = performance.now() - connectStart;
console.log(`连接耗时: ${connectTime.toFixed(2)}ms`);

// 测量消息发送时间
const sendStart = performance.now();
const response = await sdk.sendMessage({ to, content });
const sendTime = performance.now() - sendStart;
console.log(`发送耗时: ${sendTime.toFixed(2)}ms`);

// 监控内存使用
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`内存使用: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`);
}, 10000);
```

---

## 常见错误码

| 错误码 | 含义 | 解决方案 |
|-------|------|--------|
| `CONNECTION_ERROR` | 连接失败 | 检查网络和配置 |
| `AUTH_ERROR` | 认证失败 | 检查凭证有效性 |
| `TOKEN_EXPIRED` | Token已过期 | 调用`refreshCredentials()` |
| `MESSAGE_ERROR` | 消息错误 | 检查消息格式和内容 |
| `TIMEOUT` | 操作超时 | 增加超时时间或检查网络 |
| `CONFIG_ERROR` | 配置错误 | 检查SDK配置 |
| `VALIDATION_ERROR` | 验证失败 | 检查参数有效性 |
| `UNSUPPORTED` | 不支持 | 确认功能是否支持 |

---

## 获取帮助

如果以上方案都无法解决问题：

1. **收集诊断信息**
   ```typescript
   console.log(getDiagnostics(sdk));
   ```

2. **启用完整日志**
   ```typescript
   logger: { level: 'debug', console: true }
   ```

3. **提交issue**
   - 包括SDK版本
   - 完整的错误堆栈跟踪
   - 复现步骤
   - 诊断信息

4. **联系技术支持**
   - 提供上述所有信息
   - 说明使用场景
   - 描述期望行为vs实际行为

---

需要帮助？查看 [API文档](API.md) 或 [集成指南](INTEGRATION.md)。
