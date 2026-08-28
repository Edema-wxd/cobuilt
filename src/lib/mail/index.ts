import { env } from '../env';
import { logger } from '../logger';

/**
 * Email delivery.
 *
 * The provider is still an open decision (§17), so the transport sits behind
 * this interface and is chosen by MAIL_PROVIDER. Switching from SendGrid to
 * SES is a config change, not a code change, and `log` keeps development and
 * CI from sending anything.
 */

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface MailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

class LogTransport implements MailTransport {
  readonly name = 'log';

  send(message: EmailMessage): Promise<void> {
    logger.info('Email (not sent: MAIL_PROVIDER=log)', {
      to: message.to,
      subject: message.subject,
      preview: message.text.slice(0, 200),
    });
    return Promise.resolve();
  }
}

class SendGridTransport implements MailTransport {
  readonly name = 'sendgrid';

  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<void> {
    const recipients = (Array.isArray(message.to) ? message.to : [message.to]).map((email) => ({
      email,
    }));

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients }],
        from: { email: env.MAIL_FROM, name: env.MAIL_FROM_NAME },
        reply_to: message.replyTo ? { email: message.replyTo } : undefined,
        subject: message.subject,
        content: [
          { type: 'text/plain', value: message.text },
          { type: 'text/html', value: message.html },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(
        `SendGrid rejected the message: ${response.status} ${await response.text()}`,
      );
    }
  }
}

class MailgunTransport implements MailTransport {
  readonly name = 'mailgun';

  constructor(
    private readonly apiKey: string,
    private readonly domain: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const form = new URLSearchParams({
      from: `${env.MAIL_FROM_NAME} <${env.MAIL_FROM}>`,
      to: Array.isArray(message.to) ? message.to.join(',') : message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    if (message.replyTo) form.set('h:Reply-To', message.replyTo);

    const response = await fetch(`https://api.mailgun.net/v3/${this.domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(
        `Mailgun rejected the message: ${response.status} ${await response.text()}`,
      );
    }
  }
}

function selectTransport(): MailTransport {
  switch (env.MAIL_PROVIDER) {
    case 'sendgrid':
      if (!env.SENDGRID_API_KEY) {
        throw new Error('MAIL_PROVIDER=sendgrid requires SENDGRID_API_KEY');
      }
      return new SendGridTransport(env.SENDGRID_API_KEY);

    case 'mailgun':
      if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
        throw new Error('MAIL_PROVIDER=mailgun requires MAILGUN_API_KEY and MAILGUN_DOMAIN');
      }
      return new MailgunTransport(env.MAILGUN_API_KEY, env.MAILGUN_DOMAIN);

    case 'ses':
      // AWS SES is on the shortlist (§17) but not yet selected; failing loudly
      // beats silently dropping mail if it is configured by mistake.
      throw new Error('MAIL_PROVIDER=ses is not implemented yet; see docs/decisions.md');

    case 'log':
    default:
      return new LogTransport();
  }
}

let transport: MailTransport | null = null;

export function mailer(): MailTransport {
  transport ??= selectTransport();
  return transport;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  await mailer().send(message);
}

/** Test seam: lets a test swap in a recording transport. */
export function setTransport(next: MailTransport | null): void {
  transport = next;
}
