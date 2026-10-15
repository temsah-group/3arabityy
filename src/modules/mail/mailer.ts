import nodemailer from 'nodemailer';

import { logger } from '../../common/logger.js';
import type { Env } from '../../config/env.js';

export type Mail = { to: string; subject: string; text: string };

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Real delivery over SMTP. */
export class SmtpMailer implements Mailer {
  private readonly transport;

  constructor(private readonly env: Env) {
    this.transport = nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      auth: env.MAIL_USER ? { user: env.MAIL_USER, pass: env.MAIL_PASS } : undefined,
    });
  }

  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({ from: this.env.MAIL_FROM, ...mail });
  }
}

/** Development without SMTP: the email, code included, goes to the console. */
export class ConsoleMailer implements Mailer {
  async send(mail: Mail): Promise<void> {
    logger.info('Email (not sent, MAIL_HOST is empty)', {
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
  }
}

export const createMailer = (env: Env): Mailer =>
  env.MAIL_HOST ? new SmtpMailer(env) : new ConsoleMailer();
