import { Message } from '../types.js';

export class MessageQueue {
  private queue: Message[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  enqueue(message: Message): boolean {
    if (this.queue.length >= this.maxSize) {
      return false;
    }
    this.queue.push(message);
    return true;
  }

  dequeue(): Message | undefined {
    return this.queue.shift();
  }

  peek(): Message | undefined {
    return this.queue[0];
  }

  get size(): number {
    return this.queue.length;
  }

  get isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }

  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    this.queue = [];
  }

  toArray(): Message[] {
    return [...this.queue];
  }
}
