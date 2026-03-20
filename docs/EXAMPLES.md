# 代码示例

常见使用场景的完整代码示例。

## 目录

1. [基础连接示例](#基础连接示例)
2. [自动回复机器人](#自动回复机器人)
3. [消息持久化](#消息持久化)
4. [批量发送消息](#批量发送消息)
5. [错误恢复](#错误恢复)
6. [Express集成](#express集成)

## 基础连接示例

最简单的使用示例：

```typescript
import { WeChatSDK } from 'wechat-sdk';

async function main() {
  // 1. 创建SDK
  const sdk = new WeChatSDK({
    mode: 'auto',
    credentials: {
      mode: 'qclaw',
      guid: 'device-guid-123',
      channelToken: 'token-xyz',
      jwtToken: 'jwt-token',
    },
  });

  try {
    // 2. 连接
    await sdk.connect();
    console.log('✓ 已连接到微信');

    // 3. 监听消息
    sdk.on('message', (message) => {
      console.log(`📨 来自 ${message.from}: ${message.content}`);
    });

    // 4. 发送消息
    await sdk.sendMessage({
      to: 'user_123',
      content: '你好！',
    });

    // 5. 保持运行（按Ctrl+C退出）
    console.log('按 Ctrl+C 退出');
    await new Promise(() => {});
  } catch (error) {
    console.error('✗ 错误:', error);
  } finally {
    await sdk.disconnect();
    console.log('✓ 已断开连接');
  }
}

main();
```

## 自动回复机器人

创建一个简单的回复机器人：

```typescript
import { WeChatSDK, MessageType } from 'wechat-sdk';

class EchoBot {
  private sdk: WeChatSDK;

  constructor(credentials) {
    this.sdk = new WeChatSDK({
      mode: 'auto',
      credentials,
    });
  }

  async start() {
    await this.sdk.connect();

    // 监听消息并回复
    this.sdk.on('message', async (message) => {
      try {
        console.log(`📨 ${message.from}: ${message.content}`);

        // 构造回复内容
        const reply = this.generateReply(message.content);

        // 发送回复
        const response = await this.sdk.sendMessage({
          to: message.from,
          content: reply,
          type: MessageType.TEXT,
        });

        if (response.success) {
          console.log(`✓ 回复已发送: ${response.messageId}`);
        } else {
          console.error(`✗ 回复失败: ${response.error}`);
        }
      } catch (error) {
        console.error('处理消息时出错:', error);
      }
    });

    // 错误处理
    this.sdk.on('error', (error) => {
      console.error('SDK错误:', error);
    });

    console.log('机器人已启动');
  }

  private generateReply(message: string): string {
    // 简单的回复逻辑
    if (message.includes('你好')) {
      return '你好，很高兴认识你！';
    } else if (message.includes('谢谢')) {
      return '不用谢，这是我的荣幸！';
    } else {
      return `你说: ${message}`;
    }
  }

  async stop() {
    await this.sdk.disconnect();
    console.log('机器人已停止');
  }
}

// 使用
async function main() {
  const bot = new EchoBot({
    mode: 'qclaw',
    guid: 'device-guid',
    channelToken: 'token',
    jwtToken: 'jwt',
  });

  await bot.start();

  // 优雅关闭
  process.on('SIGINT', async () => {
    console.log('\n正在关闭...');
    await bot.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

## 消息持久化

将接收到的消息保存到数据库：

```typescript
import { WeChatSDK, Message } from 'wechat-sdk';
import sqlite3 from 'sqlite3';

class MessageLogger {
  private sdk: WeChatSDK;
  private db: sqlite3.Database;

  constructor(credentials, dbPath: string) {
    this.sdk = new WeChatSDK({
      mode: 'auto',
      credentials,
    });

    this.db = new sqlite3.Database(dbPath);
    this.initDatabase();
  }

  private initDatabase() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from TEXT NOT NULL,
        to TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT,
        timestamp INTEGER,
        status TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async start() {
    await this.sdk.connect();

    // 保存接收到的消息
    this.sdk.on('message', (message) => {
      this.saveMessage(message, 'received');
    });

    console.log('消息日志已启动');
  }

  private saveMessage(message: Message, status: string) {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, from, to, content, type, timestamp, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.from,
      message.to,
      message.content,
      message.type,
      message.timestamp,
      status,
      JSON.stringify(message.metadata || {}),
      (err) => {
        if (err) {
          console.error('保存消息失败:', err);
        } else {
          console.log('✓ 消息已保存:', message.id);
        }
      }
    );
  }

  // 查询消息历史
  async getMessageHistory(userId: string, limit: number = 20) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT * FROM messages
        WHERE from = ? OR to = ?
        ORDER BY created_at DESC
        LIMIT ?
        `,
        [userId, userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async stop() {
    await this.sdk.disconnect();
    this.db.close();
    console.log('消息日志已停止');
  }
}

// 使用
async function main() {
  const logger = new MessageLogger(
    {
      mode: 'qclaw',
      guid: 'device-guid',
      channelToken: 'token',
      jwtToken: 'jwt',
    },
    './messages.db'
  );

  await logger.start();

  // 查询历史消息
  const history = await logger.getMessageHistory('user_123', 50);
  console.log('消息历史:', history);

  // 关闭
  process.on('SIGINT', async () => {
    await logger.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

## 批量发送消息

发送大量消息并处理重试：

```typescript
import { WeChatSDK, MessageError, TimeoutError, ConnectionError } from 'wechat-sdk';

class MessageSender {
  private sdk: WeChatSDK;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // ms

  constructor(credentials) {
    this.sdk = new WeChatSDK({
      mode: 'auto',
      credentials,
    });
  }

  async start() {
    await this.sdk.connect();
  }

  // 带重试的消息发送
  async sendWithRetry(to: string, content: string): Promise<string | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`📤 发送消息到 ${to} (尝试 ${attempt}/${this.MAX_RETRIES})`);

        const response = await this.sdk.sendMessage({
          to,
          content,
          timeout: 30000,
        });

        if (response.success) {
          console.log(`✓ 消息已发送: ${response.messageId}`);
          return response.messageId;
        } else {
          console.warn(`✗ 发送失败: ${response.error}`);
          lastError = new Error(response.error);
        }
      } catch (error) {
        lastError = error as Error;
        console.error(`✗ 第${attempt}次尝试失败: ${(error as Error).message}`);

        // 计算延迟时间（指数退避）
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
          console.log(`⏳ 等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`✗ 所有重试都失败了: ${lastError?.message}`);
    return null;
  }

  // 批量发送消息
  async sendBatch(messages: Array<{ to: string; content: string }>) {
    const results = [];

    for (const msg of messages) {
      const messageId = await this.sendWithRetry(msg.to, msg.content);
      results.push({
        to: msg.to,
        content: msg.content,
        messageId,
        success: messageId !== null,
      });

      // 限制发送速率（避免触发限流）
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  async stop() {
    await this.sdk.disconnect();
  }
}

// 使用
async function main() {
  const sender = new MessageSender({
    mode: 'workbuddy',
    userId: 'user_id',
    accessToken: 'access_token',
  });

  await sender.start();

  // 批量消息
  const messages = [
    { to: 'user_1', content: '消息1' },
    { to: 'user_2', content: '消息2' },
    { to: 'user_3', content: '消息3' },
  ];

  const results = await sender.sendBatch(messages);

  console.log('\n=== 发送结果 ===');
  results.forEach(result => {
    const status = result.success ? '✓' : '✗';
    console.log(`${status} ${result.to}: ${result.success ? result.messageId : '失败'}`);
  });

  await sender.stop();
}

main().catch(console.error);
```

## 错误恢复

实现完整的错误恢复机制：

```typescript
import { WeChatSDK, TokenExpiredError, ConnectionError } from 'wechat-sdk';

class RobustSDKClient {
  private sdk: WeChatSDK;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // ms

  constructor(private credentials) {
    this.sdk = new WeChatSDK({
      mode: 'auto',
      credentials,
      connection: {
        timeout: 5000,
        reconnectInterval: 3000,
        maxReconnectAttempts: 10,
      },
    });
  }

  async start() {
    try {
      await this.connect();
    } catch (error) {
      console.error('✗ 初始连接失败:', error);
      await this.handleConnectionFailure();
    }

    // 设置事件监听
    this.setupEventHandlers();
  }

  private async connect() {
    console.log('🔗 正在连接...');
    await this.sdk.connect();
    this.reconnectAttempts = 0; // 重置计数器
    console.log('✓ 已连接');
  }

  private setupEventHandlers() {
    this.sdk.on('connected', () => {
      this.reconnectAttempts = 0;
    });

    this.sdk.on('disconnected', async ({ reason }) => {
      console.warn(`⚠️ 连接已断开: ${reason}`);
      await this.handleConnectionFailure();
    });

    this.sdk.on('message', (message) => {
      console.log(`📨 消息: ${message.content}`);
    });

    this.sdk.on('error', async (error) => {
      console.error('✗ SDK错误:', error);

      if (error instanceof TokenExpiredError) {
        await this.handleTokenExpired();
      } else if (error instanceof ConnectionError) {
        await this.handleConnectionFailure();
      }
    });
  }

  private async handleConnectionFailure() {
    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('✗ 重连次数过多，放弃尝试');
      process.exit(1);
    }

    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`⏳ 将在 ${Math.round(delay / 1000)} 秒后重试 (第${this.reconnectAttempts}次)`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (error) {
      console.error('✗ 重连失败:', error);
      await this.handleConnectionFailure(); // 递归重试
    }
  }

  private async handleTokenExpired() {
    console.log('🔑 Token已过期，尝试刷新...');

    try {
      await this.sdk.refreshCredentials();
      console.log('✓ Token已刷新');
    } catch (error) {
      console.error('✗ Token刷新失败:', error);
      console.log('需要重新登录');
      process.exit(1);
    }
  }

  async stop() {
    console.log('正在关闭...');
    await this.sdk.disconnect();
    console.log('✓ 已关闭');
  }
}

// 使用
async function main() {
  const client = new RobustSDKClient({
    mode: 'qclaw',
    guid: 'device-guid',
    channelToken: 'token',
    jwtToken: 'jwt',
  });

  await client.start();

  // 优雅关闭处理
  process.on('SIGINT', async () => {
    console.log('\n收到关闭信号...');
    await client.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

## Express集成

集成到Express应用中：

```typescript
import express from 'express';
import { WeChatSDK } from 'wechat-sdk';

const app = express();
app.use(express.json());

// 全局SDK实例
let sdk: WeChatSDK | null = null;

// 初始化SDK中间件
app.use(async (req, res, next) => {
  if (!sdk || !sdk.isConnectedState()) {
    console.warn('SDK未连接，尝试连接...');
    try {
      sdk = new WeChatSDK({
        mode: 'auto',
        credentials: {
          mode: 'workbuddy',
          userId: process.env.WECHAT_USER_ID || '',
          accessToken: process.env.WECHAT_ACCESS_TOKEN || '',
        },
      });
      await sdk.connect();
    } catch (error) {
      console.error('连接失败:', error);
      return res.status(503).json({ error: '服务未就绪' });
    }
  }
  next();
});

// 启动消息监听
app.post('/api/wechat/init', async (req, res) => {
  try {
    if (!sdk) {
      throw new Error('SDK未初始化');
    }

    // 监听消息
    sdk.on('message', async (message) => {
      console.log('📨 收到消息:', message);

      // 可以在这里处理消息
      // 例如：存储到数据库、转发给其他服务等
    });

    res.json({ success: true, message: '消息监听已启动' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 发送消息接口
app.post('/api/wechat/send', async (req, res) => {
  try {
    const { to, content } = req.body;

    if (!to || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (!sdk) {
      throw new Error('SDK未初始化');
    }

    const response = await sdk.sendMessage({ to, content });

    if (response.success) {
      res.json({
        success: true,
        messageId: response.messageId,
      });
    } else {
      res.status(400).json({
        error: response.error,
      });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取连接状态
app.get('/api/wechat/status', (req, res) => {
  if (!sdk) {
    return res.json({
      connected: false,
      state: 'disconnected',
    });
  }

  res.json({
    connected: sdk.isConnectedState(),
    state: sdk.getConnectionState(),
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('请求错误:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭...');
  if (sdk) {
    await sdk.disconnect();
  }
  process.exit(0);
});
```

---

更多信息请查看 [API文档](API.md) 和 [集成指南](INTEGRATION.md)。
