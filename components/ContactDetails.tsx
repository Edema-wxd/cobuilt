'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_CONTACT_SETTINGS } from '@/lib/contactDetails';
import type { ContactSettings } from '@/lib/schemas/settings';

/**
 * The office's contact details, as set at `/admin/contact`, for the client
 * components every page shares: the header's utility strip, the footer and the
 * landing page's tap-to-call.
 *
 * The root layout reads the settings on the server and provides them here, so
 * a change in the console reaches every page within its revalidation window
 * rather than only `/contact`. Anything rendered outside the provider (the
 * global error page) gets the details as built.
 */
const ContactDetailsContext = createContext<ContactSettings>(DEFAULT_CONTACT_SETTINGS);

export function ContactDetailsProvider({
  value,
  children,
}: {
  value: ContactSettings;
  children: ReactNode;
}) {
  return <ContactDetailsContext.Provider value={value}>{children}</ContactDetailsContext.Provider>;
}

export function useContactDetails(): ContactSettings {
  return useContext(ContactDetailsContext);
}
