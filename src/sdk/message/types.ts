import { MessageType, MessageDirection, MessageStatus } from '../types.js';

// AGP (Agent Gateway Protocol) types for QClaw
export interface AgpEnvelope {
  type: number;
  sequence: number;
  payload: Buffer | string;
}

export interface AgpContentBlock {
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AgpMessage {
  fromUser: string;
  toUser: string;
  msgType: string;
  content: string;
  msgId?: string;
  timestamp?: number;
}

// WorkBuddy message types
export interface WorkBuddyEvent {
  type: string;
  data: WorkBuddyEventData;
}

export interface WorkBuddyEventData {
  from?: string;
  to?: string;
  content?: string;
  msgId?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface WorkBuddyReplyPayload {
  userId: string;
  content: string;
  msgId?: string;
  metadata?: Record<string, unknown>;
}

// Centrifuge protocol types
export interface CentrifugeConnectRequest {
  id: number;
  method: number; // 0 = connect
  params: {
    token: string;
    name?: string;
    version?: string;
  };
}

export interface CentrifugeSubscribeRequest {
  id: number;
  method: number; // 1 = subscribe
  params: {
    channel: string;
    token?: string;
  };
}

export interface CentrifugeMessage {
  id?: number;
  method?: number;
  result?: unknown;
  error?: { code: number; message: string };
  push?: {
    channel: string;
    pub?: { data: unknown };
  };
}
