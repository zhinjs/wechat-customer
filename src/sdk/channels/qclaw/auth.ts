import { QClawCredentials } from '../../types.js';
import { QClawAuthPayload } from './types.js';

export class QClawAuth {
  buildAuthPayload(credentials: QClawCredentials): QClawAuthPayload {
    return {
      type: 'auth',
      channelToken: credentials.channelToken,
      guid: credentials.guid!,  // guaranteed to be set by WeChatSDK.ensureDeviceInfo() before connect
      jwtToken: credentials.jwtToken,
    };
  }

  async refreshToken(credentials: QClawCredentials): Promise<Partial<QClawCredentials>> {
    // In a real implementation, this would call the QClaw token refresh API.
    // For now return the existing credentials unchanged.
    return {
      channelToken: credentials.channelToken,
      jwtToken: credentials.jwtToken,
    };
  }
}
