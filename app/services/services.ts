/**
 * The six disciplines, as the standards document names them.
 *
 * Static content, not API content. There is a `services` table behind the
 * projects API, but it holds taxonomy for filtering projects — a name, a slug
 * and a one-line description — not the page copy below, and no endpoint
 * publishes it. Until a CMS content type exists for services
 * (docs/design-handover.md §5.1), this module is the source: one place to edit,
 * and the slugs here are the public URLs.
 *
 * The sixth, Property Investment, is marked informational by the brief and must
 * stay that way: no call to action, and the licensing notice on the page.
 */

export interface Service {
  slug: string;
  title: string;
  /** The card line on the landing page and the services index. */
  summary: string;
  /** The page's standfirst. */
  standfirst: string;
  /** Opening paragraphs on the detail page. */
  body: string[];
  /** What the discipline covers, as a scannable list. */
  covers: string[];
  /** What a client is handed, in documents rather than adjectives. */
  deliverables: string[];
  /** Who typically engages CoBuilt for this. */
  suitedTo: string[];
  /** Informational only — no investment is offered or solicited. */
  informational?: boolean;
}

export const SERVICES: Service[] = [
  {
    slug: 'real-estate-development',
    title: 'Real Estate Development',
    summary:
      'High-quality residential, commercial, mixed-use and strategic developments.',
    standfirst:
      'We originate and develop residential, commercial, mixed-use and strategic schemes — holding the site, the brief and the programme in one place.',
    body: [
      'Development is the discipline that carries every other one. A site is acquired on a thesis about what it should become, and everything that follows — the design, the capital structure, the construction programme, the sales strategy — either serves that thesis or quietly undermines it.',
      'CoBuilt develops its own schemes and co-develops with landowners and institutional partners. In both cases the same team holds the project from acquisition to handover, and every mandatory milestone is published to the development’s Project Passport™ as it is reached.',
    ],
    covers: [
      'Site identification, title verification and acquisition structuring',
      'Residential, commercial, mixed-use and strategic schemes',
      'Design development and statutory approvals',
      'Capital structuring against a costed programme',
      'Delivery to a published milestone schedule',
      'Sales, handover and the permanent project record',
    ],
    deliverables: [
      'A development appraisal with the market, technical and cost position',
      'A published milestone programme with dated commitments',
      'A Project Passport™ entry at every mandatory milestone',
      'Handover documentation and the completed record archive',
    ],
    suitedTo: [
      'Landowners seeking a development partner rather than a buyer',
      'Institutions placing capital into Nigerian real assets',
      'Occupiers commissioning a scheme for their own use',
    ],
  },
  {
    slug: 'construction-management',
    title: 'Construction Management',
    summary:
      'Project execution focused on quality craftsmanship, cost efficiency, safety and timely delivery.',
    standfirst:
      'Construction managed on site, against a published programme, with progress recorded as it happens rather than reconstructed afterwards.',
    body: [
      'Construction is where a development stops being a document. Our construction management teams hold the four things that decide whether the document survives contact with the site: the quality of the work, the cost, the safety of the people doing it, and the date.',
      'Progress is recorded at the point it happens — dated photography, inspection records and certificates attached to the milestone they belong to. That record is what makes a published programme a commitment rather than a forecast.',
    ],
    covers: [
      'Contractor procurement, tendering and contract administration',
      'Site supervision and workmanship inspection',
      'Cost control, valuations and variation management',
      'Health, safety and environmental compliance on site',
      'Programme management and progress reporting',
      'Snagging, practical completion and defects management',
    ],
    deliverables: [
      'A procurement strategy and tender report',
      'Monthly progress reports with dated site photography',
      'Milestone certificates filed to the Project Passport™',
      'An as-built record and defects schedule at completion',
    ],
    suitedTo: [
      'Owners who need the programme held rather than reported on',
      'Developers appointing a construction manager for a single scheme',
      'Institutions requiring auditable site documentation',
    ],
  },
  {
    slug: 'development-management',
    title: 'Development Management',
    summary: 'Every stage from concept to completion, coordinated efficiently and professionally.',
    standfirst:
      'One accountable team coordinating consultants, contractors, approvals and capital from concept through to completion.',
    body: [
      'Development management is the discipline of keeping a project coherent. A scheme has a dozen parties with a dozen reasonable priorities, and the brief, the budget and the programme have to survive all of them.',
      'We act as the client’s single point of accountability: appointing and holding the consultant team, driving the statutory process, keeping the cost plan honest, and reporting the programme as it stands rather than as it was hoped.',
    ],
    covers: [
      'Brief development and feasibility coordination',
      'Consultant appointment and management',
      'Statutory approvals and stakeholder engagement',
      'Cost planning, cash flow and drawdown management',
      'Risk registers and programme management',
      'Reporting to owners, lenders and boards',
    ],
    deliverables: [
      'A project execution plan with roles and decision gates',
      'A cost plan and cash flow updated at each stage',
      'A risk register reviewed and reported monthly',
      'Board-ready progress reports at an agreed cadence',
    ],
    suitedTo: [
      'Landowners and family offices without an in-house team',
      'Corporates delivering a scheme outside their core business',
      'Lenders requiring independent development oversight',
    ],
  },
  {
    slug: 'project-advisory',
    title: 'Project Advisory',
    summary:
      'Feasibility studies, commercial assessment, procurement planning and development strategy.',
    standfirst:
      'The work that happens before a commitment: whether a scheme stacks up, in what form, and at what cost and risk.',
    body: [
      'Most development losses are decided before a contractor is appointed. Advisory is where that is prevented — testing the market position, the technical constraints and the cost base against each other, and saying plainly when a scheme does not work in its current form.',
      'We produce appraisals that a board, a lender or a partner can act on, with the assumptions visible and the sensitivities tested rather than buried.',
    ],
    covers: [
      'Market and demand assessment',
      'Technical and planning feasibility',
      'Development appraisals and sensitivity analysis',
      'Procurement strategy and contract route selection',
      'Highest-and-best-use and option studies',
      'Independent review of an existing scheme',
    ],
    deliverables: [
      'A feasibility report with stated assumptions and sensitivities',
      'An appraisal model with the option comparison',
      'A procurement and contracting recommendation',
      'A written view on the risks worth pricing and the ones worth avoiding',
    ],
    suitedTo: [
      'Owners deciding what to do with a site',
      'Investors testing a scheme before committing capital',
      'Boards seeking an independent second opinion',
    ],
  },
  {
    slug: 'asset-and-property-management',
    title: 'Asset & Property Management',
    summary: 'Preserving and enhancing the long-term value of completed developments.',
    standfirst:
      'Completed developments operated so that the quality they were built to is still there in ten years.',
    body: [
      'A development is judged long after handover. Asset and property management is how the standard holds: planned maintenance rather than reactive repair, service charges that are accounted for openly, and tenant relationships that are managed rather than endured.',
      'Because we manage assets we also built, the maintenance plan starts from the as-built record rather than from guesswork — and the Passport archive stays useful well past practical completion.',
    ],
    covers: [
      'Facilities and planned preventative maintenance',
      'Service charge budgeting, accounting and reporting',
      'Tenant management, lettings and renewals',
      'Compliance, inspections and statutory testing',
      'Refurbishment and asset improvement planning',
      'Performance reporting to owners',
    ],
    deliverables: [
      'An asset management plan with a maintenance calendar',
      'Audited service charge budgets and reconciliations',
      'Quarterly performance and compliance reporting',
      'A maintained as-built and certification archive',
    ],
    suitedTo: [
      'Owners of completed residential and commercial schemes',
      'Estate and facility boards seeking professional management',
      'Investors holding Nigerian real assets at a distance',
    ],
  },
  {
    slug: 'property-investment',
    title: 'Property Investment',
    summary:
      'Information only. No investment is offered or solicited pending regulatory licensing.',
    standfirst:
      'Information about how property investment works alongside a CoBuilt development. This is not an offer, and nothing on this page solicits investment.',
    body: [
      'CoBuilt Investment Partners is not currently licensed to offer or solicit investment in Nigeria, and does not do so. This page exists because people ask, and because the honest answer is more useful than silence: it explains how investment would sit alongside a development, and what has to be in place before we could discuss it.',
      'What you can do today is register your interest. That records nothing more than a wish to be contacted when the position changes, and it carries no obligation on either side.',
    ],
    covers: [
      'How a development is capitalised, in general terms',
      'The role of equity, debt and off-plan sales in a scheme',
      'What a Project Passport™ lets any stakeholder verify independently',
      'The approvals and licences required before an offer could be made',
      'What the planned Investor Portal would and would not do',
      'How to register interest without committing to anything',
    ],
    deliverables: [
      'Written answers to information requests, with no offer attached',
      'Notification when the regulatory position changes, if you ask for it',
      'Access to the same public project records everyone else sees',
    ],
    suitedTo: [
      'Anyone wanting to understand the regulatory position plainly',
      'Prospective partners who will wait for the licences',
    ],
    informational: true,
  },
];

export function findService(slug: string): Service | undefined {
  return SERVICES.find((service) => service.slug === slug);
}

/** `/services/[slug]` links on the landing page and the services index. */
export function serviceHref(slug: string): string {
  return `/services/${slug}`;
}
