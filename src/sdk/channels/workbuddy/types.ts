export const WORKBUDDY_BASE_URL = 'https://copilot.tencent.com';

export interface WorkBuddyChannelInfo {
  channelId: string;
  userId: string;
  name?: string;
}

export interface WorkBuddyTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface WorkBuddyCentrifugeConnect {
  id: number;
  method: number;
  params: {
    token: string;
  };
}

export interface WorkBuddyCentrifugeSubscribe {
  id: number;
  method: number;
  params: {
    channel: string;
  };
}

export interface WorkBuddyCentrifugePush {
  channel: string;
  pub?: {
    data: WorkBuddyPushData;
  };
}

export interface WorkBuddyPushData {
  type?: string;
  from?: string;
  content?: string;
  msgId?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export const CENTRIFUGE_METHOD = {
  CONNECT: 0,
  SUBSCRIBE: 1,
  UNSUBSCRIBE: 2,
  PUBLISH: 3,
  PING: 4,
} as const;
