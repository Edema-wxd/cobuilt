import Link from 'next/link';
import { COMPANY } from '@/content/company';
import { CompanyIdentity, LegalDocument, type LegalSection } from '@/components/LegalDocument';

const email = <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>;

const sections: LegalSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    content: (
      <>
        <p>
          These terms govern your use of {COMPANY.website} (the &quot;site&quot;), operated by{' '}
          {COMPANY.name} (&quot;CoBuilt&quot;, &quot;we&quot;, &quot;us&quot;). By using the site
          you accept them. If you do not accept them, please do not use the site.
        </p>
        <CompanyIdentity />
        <p>
          How we handle personal data is covered separately in our{' '}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'no-offer',
    title: 'Not an offer of investment',
    content: (
      <>
        <p>
          The site is informational. Nothing on it is an offer to sell, or a solicitation of an
          offer to buy, any security or any interest in a project, in Nigeria or in any other
          jurisdiction.
        </p>
        <p>
          Any investment with CoBuilt is made offline, under signed contractual and offering
          documents, after your own due diligence with advisers of your choosing. Submitting an
          investment enquiry through the site creates no obligation on you or on us.
        </p>
      </>
    ),
  },
  {
    id: 'project-information',
    title: 'Project information and the Project Passport',
    content: (
      <>
        <p>
          We publish project information in good faith. A Project Passport entry records that a
          construction stage was completed, with the evidence we hold for it, as at the date shown
          on the entry.
        </p>
        <p>However, please bear in mind that:</p>
        <ul>
          <li>
            renderings, plans, specifications, unit counts and timelines are indicative and may
            change as a project develops;
          </li>
          <li>
            figures such as costs, values and expected returns are estimates, not promises, and past
            progress on a project does not guarantee future progress;
          </li>
          <li>
            investment figures appear on a project only after internal review, but that review does
            not make them a guarantee or a recommendation;
          </li>
          <li>
            statements about future plans are forward-looking and depend on matters outside our
            control, including permits, market conditions and contractors.
          </li>
        </ul>
        <p>
          Before relying on any project information for a decision, confirm it with us in writing.
        </p>
      </>
    ),
  },
  {
    id: 'no-advice',
    title: 'No professional advice',
    content: (
      <p>
        Nothing on the site is financial, investment, legal, tax or property advice, and it does not
        take your circumstances into account. Take independent professional advice before making any
        decision.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Using the site',
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>use the site for anything unlawful, or in breach of these terms;</li>
          <li>
            submit false information, or another person&apos;s personal data without their
            permission;
          </li>
          <li>send spam, or submit forms by automated means;</li>
          <li>
            try to access any account, admin area or data that is not yours, or to get around rate
            limits or other controls;
          </li>
          <li>
            probe, scan or test the site&apos;s security without our prior written permission;
          </li>
          <li>
            interfere with the site or its infrastructure, or introduce malicious code of any kind;
          </li>
          <li>
            copy or scrape the site&apos;s content in bulk, or at a volume that burdens the service.
          </li>
        </ul>
        <p>
          If you believe you have found a security weakness, please report it to {email}. Do not
          access, change or keep data that is not yours while investigating it.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts',
    content: (
      <>
        <p>
          Accounts on the site are issued by CoBuilt to its staff and to people it invites. The
          public cannot register. If you hold an account:
        </p>
        <ul>
          <li>keep your password confidential and do not share your account;</li>
          <li>you are responsible for activity carried out through it;</li>
          <li>tell us at once if you think it has been used without your permission.</li>
        </ul>
        <p>
          We may suspend or close an account to protect the site or its users, or if these terms are
          breached.
        </p>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual property',
    content: (
      <>
        <p>
          The site and its content, including text, photographs, 3D tours, design, and the Project
          Passport name and format, belong to CoBuilt or to those who license them to us. Project
          Passport™ is a trade mark of CoBuilt.
        </p>
        <p>
          You may view and print pages for your own non-commercial use, share links to them, and
          quote short extracts with a clear attribution to CoBuilt. Any other copying, republishing,
          framing or adaptation needs our written permission.
        </p>
      </>
    ),
  },
  {
    id: 'enquiries',
    title: 'Enquiries and emails',
    content: (
      <>
        <p>
          When you submit a form, you confirm that the information is accurate and that you are
          entitled to share it. We aim to reply to every genuine enquiry, but we do not promise a
          reply within any set time.
        </p>
        <p>
          Milestone update emails are sent only after you confirm your subscription, and every one
          contains a link to unsubscribe.
        </p>
      </>
    ),
  },
  {
    id: 'third-parties',
    title: 'Third-party services and links',
    content: (
      <p>
        Parts of the site rely on services run by others, such as embedded 3D tours and WhatsApp,
        and the site may link to other websites. Those services and websites have their own terms
        and privacy policies, and we are not responsible for their content or for how they operate.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability',
    content: (
      <p>
        We provide the site &quot;as is&quot; and &quot;as available&quot;. We work to keep it
        accurate and online, but we do not guarantee that it will be uninterrupted, free of errors,
        or that any content will remain available. We may change, suspend or withdraw any part of it
        without notice.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Our liability',
    content: (
      <>
        <p>To the fullest extent permitted by law, we are not liable for:</p>
        <ul>
          <li>
            any loss arising from reliance on information on the site, including any investment
            decision;
          </li>
          <li>any loss caused by the site being unavailable, or by errors in it;</li>
          <li>
            any indirect or consequential loss, or any loss of profit, revenue, opportunity or data.
          </li>
        </ul>
        <p>
          Nothing in these terms excludes or limits liability that cannot be excluded or limited by
          law, including liability for fraud, or for death or personal injury caused by negligence.
          Nothing in these terms affects rights you have as a consumer that cannot be waived by
          contract.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    content: (
      <p>
        We may update these terms. When we do, we change the effective date at the top of this page.
        The version in force when you use the site is the one that applies to that use.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law and disputes',
    content: (
      <>
        <p>
          These terms, and any dispute arising from them or from your use of the site, are governed
          by the laws of the Federal Republic of Nigeria. The courts of Lagos State have
          jurisdiction.
        </p>
        <p>
          If you have a concern, please contact us first. Most issues can be settled quickly without
          a formal dispute.
        </p>
      </>
    ),
  },
  {
    id: 'general',
    title: 'General',
    content: (
      <ul>
        <li>If any part of these terms is found unenforceable, the rest continues to apply.</li>
        <li>If we do not enforce a term straight away, we can still enforce it later.</li>
        <li>
          These terms and our privacy policy are the whole agreement between you and us about your
          use of the site.
        </li>
      </ul>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    content: <p>Questions about these terms: {email}.</p>,
  },
];

export default function TermsOfService() {
  return (
    <LegalDocument
      title="Terms of service"
      description="The terms that govern use of the CoBuilt Investment Partners website, including that nothing on it is an offer of investment."
      lead="The rules for using this website, what you can rely on it for, and what it is not."
      effective="27 September 2026"
      summary={[
        'This website is informational. Nothing on it is an offer of investment.',
        'Project information is published in good faith but can change. Confirm it with us before relying on it.',
        'Use the site lawfully: no automated abuse, no probing its security, no bulk copying of its content.',
        'These terms are governed by Nigerian law.',
      ]}
      sections={sections}
      related={{ href: '/privacy', label: 'Privacy policy' }}
    />
  );
}
