import { env } from '../env';
import type { EmailMessage } from './index';

/**
 * Email bodies.
 *
 * Templates are plain functions rather than a template engine: there are few
 * of them, they need to render identically in a queue worker with no request
 * context, and every interpolated value passes through `escape` so a form
 * submission cannot inject markup into an admin's inbox.
 */

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:20px;">${escape(title)}</h1>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e7e5e4;margin:32px 0 16px;">
    <p style="margin:0;font-size:12px;color:#78716c;">
      CoBuilt Investment Partners &middot;
      <a href="${env.NEXT_PUBLIC_WEBSITE_URL}" style="color:#78716c;">${env.NEXT_PUBLIC_WEBSITE_URL}</a>
    </p>
  </div>
</body>
</html>`;
}

export function inquiryConfirmation(input: { name: string }): EmailMessage {
  const title = 'We have received your enquiry';
  const text = `Hello ${input.name},

Thank you for contacting CoBuilt Investment Partners. Your enquiry has reached our team and we will respond within two business days.

CoBuilt Investment Partners
${env.NEXT_PUBLIC_WEBSITE_URL}`;

  return {
    to: '', // Filled in by the caller
    subject: title,
    text,
    html: layout(
      title,
      `<p>Hello ${escape(input.name)},</p>
       <p>Thank you for contacting CoBuilt Investment Partners. Your enquiry has reached
          our team and we will respond within two business days.</p>`,
    ),
  };
}

export function inquiryNotification(input: {
  submissionId: string;
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
}): EmailMessage {
  const title = `New website enquiry from ${input.name}`;
  const adminUrl = `${env.NEXT_PUBLIC_WEBSITE_URL}/admin/forms/${input.submissionId}`;

  const text = `New enquiry received.

Name:    ${input.name}
Email:   ${input.email}
Phone:   ${input.phone ?? '-'}
Subject: ${input.subject ?? '-'}

${input.message}

Review: ${adminUrl}`;

  return {
    to: '',
    subject: title,
    replyTo: input.email,
    text,
    html: layout(
      title,
      `<table style="width:100%;font-size:14px;border-collapse:collapse;">
         <tr><td style="padding:4px 0;color:#78716c;">Name</td><td>${escape(input.name)}</td></tr>
         <tr><td style="padding:4px 0;color:#78716c;">Email</td><td>${escape(input.email)}</td></tr>
         <tr><td style="padding:4px 0;color:#78716c;">Phone</td><td>${escape(input.phone ?? '-')}</td></tr>
         <tr><td style="padding:4px 0;color:#78716c;">Subject</td><td>${escape(input.subject ?? '-')}</td></tr>
       </table>
       <p style="white-space:pre-wrap;margin-top:16px;">${escape(input.message)}</p>
       <p style="margin-top:24px;"><a href="${adminUrl}">Review in the admin dashboard</a></p>`,
    ),
  };
}

export function investmentNotification(input: {
  submissionId: string;
  name: string;
  email: string;
  companyName?: string | null;
  investmentRange?: string | null;
  message: string;
}): EmailMessage {
  const title = `Investor enquiry — legal review required`;
  const adminUrl = `${env.NEXT_PUBLIC_WEBSITE_URL}/admin/forms/${input.submissionId}`;

  const text = `An investor enquiry was submitted through the website and is held for legal review.

Name:    ${input.name}
Email:   ${input.email}
Company: ${input.companyName ?? '-'}
Range:   ${input.investmentRange ?? '-'}

${input.message}

Review: ${adminUrl}

No transactional or securities-related response may be sent without legal sign-off.`;

  return {
    to: '',
    subject: title,
    replyTo: input.email,
    text,
    html: layout(
      title,
      `<p><strong>Held for legal review.</strong> No transactional or securities-related
          response may be sent without sign-off.</p>
       <table style="width:100%;font-size:14px;border-collapse:collapse;">
         <tr><td style="padding:4px 0;color:#78716c;">Name</td><td>${escape(input.name)}</td></tr>
         <tr><td style="padding:4px 0;color:#78716c;">Email</td><td>${escape(input.email)}</td></tr>
         <tr><td style="padding:4px 0;color:#78716c;">Company</td><td>${escape(input.companyName ?? '-')}</td></tr>
         <tr><td style="padding:4px 0;color:#78716c;">Range</td><td>${escape(input.investmentRange ?? '-')}</td></tr>
       </table>
       <p style="white-space:pre-wrap;margin-top:16px;">${escape(input.message)}</p>
       <p style="margin-top:24px;"><a href="${adminUrl}">Review in the admin dashboard</a></p>`,
    ),
  };
}

export function newsletterConfirmation(input: { token: string }): EmailMessage {
  const title = 'Confirm your newsletter subscription';
  const url = `${env.NEXT_PUBLIC_WEBSITE_URL}/newsletter/confirm?token=${encodeURIComponent(input.token)}`;

  return {
    to: '',
    subject: title,
    text: `Confirm your subscription to CoBuilt updates: ${url}

If you did not request this, ignore this email and nothing further will be sent.`,
    html: layout(
      title,
      `<p>Confirm your subscription to CoBuilt updates:</p>
       <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#1c1917;color:#ffffff;border-radius:4px;text-decoration:none;">Confirm subscription</a></p>
       <p style="font-size:13px;color:#78716c;">If you did not request this, ignore this email
          and nothing further will be sent.</p>`,
    ),
  };
}

export function newsletterWelcome(input: { unsubscribeToken: string }): EmailMessage {
  const title = 'Welcome to CoBuilt updates';
  const unsubscribeUrl = `${env.NEXT_PUBLIC_WEBSITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`;

  return {
    to: '',
    subject: title,
    text: `Your subscription is confirmed. You will receive project updates and news from CoBuilt Investment Partners.

Unsubscribe at any time: ${unsubscribeUrl}`,
    html: layout(
      title,
      `<p>Your subscription is confirmed. You will receive project updates and news from
          CoBuilt Investment Partners.</p>
       <p style="font-size:13px;color:#78716c;">
         <a href="${unsubscribeUrl}" style="color:#78716c;">Unsubscribe</a> at any time.</p>`,
    ),
  };
}

export function passwordReset(input: { token: string; fullName: string | null }): EmailMessage {
  const title = 'Reset your CoBuilt admin password';
  const url = `${env.NEXT_PUBLIC_WEBSITE_URL}/admin/reset-password?token=${encodeURIComponent(input.token)}`;

  return {
    to: '',
    subject: title,
    text: `Hello ${input.fullName ?? 'there'},

Reset your password using this link (valid for one hour): ${url}

If you did not request a reset, no action is needed — your password is unchanged.`,
    html: layout(
      title,
      `<p>Hello ${escape(input.fullName ?? 'there')},</p>
       <p>Reset your password using the link below. It is valid for one hour.</p>
       <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#1c1917;color:#ffffff;border-radius:4px;text-decoration:none;">Reset password</a></p>
       <p style="font-size:13px;color:#78716c;">If you did not request a reset, no action is
          needed — your password is unchanged.</p>`,
    ),
  };
}

export function milestonePublished(input: {
  projectTitle: string;
  projectSlug: string;
  milestoneTitle: string;
}): EmailMessage {
  const title = `${input.projectTitle}: ${input.milestoneTitle}`;
  const url = `${env.NEXT_PUBLIC_WEBSITE_URL}/projects/${input.projectSlug}`;

  return {
    to: '',
    subject: `Project update — ${input.projectTitle}`,
    text: `${input.milestoneTitle} has been recorded on the Project Passport for ${input.projectTitle}.

View the timeline: ${url}`,
    html: layout(
      title,
      `<p><strong>${escape(input.milestoneTitle)}</strong> has been recorded on the Project
          Passport for ${escape(input.projectTitle)}.</p>
       <p><a href="${url}">View the project timeline</a></p>`,
    ),
  };
}
