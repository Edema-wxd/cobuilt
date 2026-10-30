import { z } from 'zod';
import { email, phone } from './common';

export const dataSubjectBody = z
  .object({ email: email.optional(), phone: phone.optional() })
  .refine((value) => Boolean(value.email || value.phone), {
    message: 'Provide an email address, a phone number, or both',
    path: ['email'],
  });
export type DataSubjectBody = z.infer<typeof dataSubjectBody>;
