import { MessageQueue } from '../sdk/message/queue';
import { MessageAdapter } from '../sdk/message/adapter';
import { MessageType, MessageDirection, MessageStatus } from '../sdk/types';
import { AgpMessage, WorkBuddyEvent } from '../sdk/message/types';

const createMessage = (overrides = {}) => ({
  id: 'test-id',
  type: MessageType.TEXT,
  direction: MessageDirection.INBOUND,
  content: 'hello',
  from: 'user1',
  to: 'user2',
  timestamp: 1000,
  status: MessageStatus.DELIVERED,
  ...overrides,
});

describe('MessageQueue', () => {
  describe('basic operations', () => {
    it('should start empty', () => {
      const queue = new MessageQueue();
      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);
    });

    it('should enqueue and dequeue messages', () => {
      const queue = new MessageQueue();
      const msg = createMessage();
      queue.enqueue(msg);
      expect(queue.size).toBe(1);
      const dequeued = queue.dequeue();
      expect(dequeued).toEqual(msg);
      expect(queue.size).toBe(0);
    });

    it('should maintain FIFO order', () => {
      const queue = new MessageQueue();
      const msg1 = createMessage({ id: 'id1' });
      const msg2 = createMessage({ id: 'id2' });
      const msg3 = createMessage({ id: 'id3' });
      queue.enqueue(msg1);
      queue.enqueue(msg2);
      queue.enqueue(msg3);
      expect(queue.dequeue()?.id).toBe('id1');
      expect(queue.dequeue()?.id).toBe('id2');
      expect(queue.dequeue()?.id).toBe('id3');
    });

    it('should peek without removing', () => {
      const queue = new MessageQueue();
      const msg = createMessage();
      queue.enqueue(msg);
      expect(queue.peek()).toEqual(msg);
      expect(queue.size).toBe(1);
    });

    it('should return undefined for empty dequeue', () => {
      const queue = new MessageQueue();
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should return undefined for empty peek', () => {
      const queue = new MessageQueue();
      expect(queue.peek()).toBeUndefined();
    });
  });

  describe('size limits', () => {
    it('should respect maxSize', () => {
      const queue = new MessageQueue(2);
      const msg1 = createMessage({ id: 'id1' });
      const msg2 = createMessage({ id: 'id2' });
      const msg3 = createMessage({ id: 'id3' });
      expect(queue.enqueue(msg1)).toBe(true);
      expect(queue.enqueue(msg2)).toBe(true);
      expect(queue.enqueue(msg3)).toBe(false); // full
      expect(queue.size).toBe(2);
    });

    it('should report isFull correctly', () => {
      const queue = new MessageQueue(1);
      expect(queue.isFull).toBe(false);
      queue.enqueue(createMessage());
      expect(queue.isFull).toBe(true);
    });
  });

  describe('clear and toArray', () => {
    it('should clear all messages', () => {
      const queue = new MessageQueue();
      queue.enqueue(createMessage({ id: 'id1' }));
      queue.enqueue(createMessage({ id: 'id2' }));
      queue.clear();
      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);
    });

    it('should return a copy via toArray', () => {
      const queue = new MessageQueue();
      const msg = createMessage();
      queue.enqueue(msg);
      const arr = queue.toArray();
      expect(arr).toHaveLength(1);
      expect(arr[0]).toEqual(msg);
      // Ensure it's a copy
      arr.push(createMessage({ id: 'extra' }));
      expect(queue.size).toBe(1);
    });
  });
});

describe('MessageAdapter', () => {
  describe('agpToMessage', () => {
    it('should convert AGP message to unified Message', () => {
      const agp: AgpMessage = {
        fromUser: 'sender',
        toUser: 'receiver',
        content: 'hello world',
        msgId: 'agp-123',
        timestamp: 1234567890,
        msgType: 'text',
      };
      const message = MessageAdapter.agpToMessage(agp, 'receiver');
      expect(message.id).toBe('agp-123');
      expect(message.content).toBe('hello world');
      expect(message.from).toBe('sender');
      expect(message.to).toBe('receiver');
      expect(message.type).toBe(MessageType.TEXT);
      expect(message.direction).toBe(MessageDirection.INBOUND);
      expect(message.status).toBe(MessageStatus.DELIVERED);
    });

    it('should generate id if not provided', () => {
      const agp: AgpMessage = {
        fromUser: 'sender',
        toUser: 'receiver',
        content: 'hello',
        msgType: 'text',
      };
      const message = MessageAdapter.agpToMessage(agp, 'receiver');
      expect(message.id).toBeTruthy();
      expect(message.id).toMatch(/^agp-/);
    });
  });

  describe('workBuddyEventToMessage', () => {
    it('should convert WorkBuddy event to message', () => {
      const event: WorkBuddyEvent = {
        type: 'message',
        data: {
          from: 'sender',
          content: 'hello wb',
          msgId: 'wb-456',
          timestamp: 9999,
        },
      };
      const message = MessageAdapter.workBuddyEventToMessage(event, 'my-channel');
      expect(message).not.toBeNull();
      expect(message!.id).toBe('wb-456');
      expect(message!.content).toBe('hello wb');
      expect(message!.from).toBe('sender');
    });

    it('should return null if no content', () => {
      const event: WorkBuddyEvent = {
        type: 'message',
        data: { from: 'sender' },
      };
      const message = MessageAdapter.workBuddyEventToMessage(event, 'channel');
      expect(message).toBeNull();
    });
  });

  describe('response helpers', () => {
    it('should create success response', () => {
      const response = MessageAdapter.createSuccessResponse('msg-123');
      expect(response.success).toBe(true);
      expect(response.messageId).toBe('msg-123');
      expect(response.timestamp).toBeDefined();
    });

    it('should create error response', () => {
      const response = MessageAdapter.createErrorResponse('Something failed');
      expect(response.success).toBe(false);
      expect(response.error).toBe('Something failed');
      expect(response.timestamp).toBeDefined();
    });
  });
});
