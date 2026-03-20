export interface QClawMessage {
  type: string;
  payload: unknown;
}

export interface AGPEnvelope {
  type: number;
  sequence: number;
  payload: Buffer | string;
}

export interface QClawAuthPayload {
  type: string;
  channelToken: string;
  guid: string;
  jwtToken: string;
}

export interface QClawIncomingMessage {
  type: string;
  fromUser?: string;
  toUser?: string;
  content?: string;
  msgId?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export const WS_URL = 'wss://mmgrcalltoken.3g.qq.com/agentwss';

export const AGP_MSG_TYPE = {
  AUTH: 0,
  MESSAGE: 1,
  ACK: 2,
  HEARTBEAT: 3,
  AUTH_RESPONSE: 4,
} as const;
