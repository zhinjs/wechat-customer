import { Message, MessageType, MessageDirection, MessageStatus, SendMessageRequest, SendMessageResponse } from '../types.js';
import { AgpMessage, WorkBuddyEvent } from './types.js';

export class MessageAdapter {
  static agpToMessage(agp: AgpMessage, channelId: string): Message {
    return {
      id: agp.msgId ?? `agp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: MessageType.TEXT,
      direction: MessageDirection.INBOUND,
      content: agp.content,
      from: agp.fromUser,
      to: agp.toUser ?? channelId,
      timestamp: agp.timestamp ?? Date.now(),
      status: MessageStatus.DELIVERED,
    };
  }

  static workBuddyEventToMessage(event: WorkBuddyEvent, channelId: string): Message | null {
    if (!event.data?.content) return null;
    return {
      id: (event.data.msgId as string) ?? `wb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: MessageType.TEXT,
      direction: MessageDirection.INBOUND,
      content: event.data.content as string,
      from: (event.data.from as string) ?? 'unknown',
      to: (event.data.to as string) ?? channelId,
      timestamp: (event.data.timestamp as number) ?? Date.now(),
      status: MessageStatus.DELIVERED,
    };
  }

  static createSuccessResponse(messageId: string): SendMessageResponse {
    return { success: true, messageId, timestamp: Date.now() };
  }

  static createErrorResponse(error: string): SendMessageResponse {
    return { success: false, error, timestamp: Date.now() };
  }
}
