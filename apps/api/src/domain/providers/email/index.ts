import type { EmailProvider } from './email.provider.js';
import { HostingerEmailProvider } from './hostinger.adapter.js';
import { env } from '../../../config/env.js';

/** Provider selection point. The rest of the app imports `emailProvider`
 * from here and never instantiates an adapter directly. */
export function createEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'hostinger':
      return new HostingerEmailProvider();
    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${env.EMAIL_PROVIDER}`);
  }
}

export const emailProvider = createEmailProvider();
export type { EmailProvider };
