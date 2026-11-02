import type { Metadata } from 'next';
import ContactSettings from './contact-settings';

export const metadata: Metadata = { title: 'Contact details' };

export default function ContactPage() {
  return <ContactSettings />;
}
