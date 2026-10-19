import { OAuth2Client } from 'google-auth-library';

/** Who Google says signed in; only ever built from a checked ID token. */
export type GoogleIdentity = {
  /** Google's stable account id; the email can change, this cannot. */
  sub: string;
  email: string;
  name: string | null;
};

export interface GoogleVerifier {
  /** Null when the token is forged, expired, for another app, or the email is unconfirmed. */
  verify(idToken: string): Promise<GoogleIdentity | null>;
}

/** Checks ID tokens against Google's keys; tokens must be issued to one of [clientIds]. */
export class GoogleTokenVerifier implements GoogleVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly clientIds: string[]) {}

  async verify(idToken: string): Promise<GoogleIdentity | null> {
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientIds });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified !== true) return null;
      return { sub: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? null };
    } catch {
      return null;
    }
  }
}
