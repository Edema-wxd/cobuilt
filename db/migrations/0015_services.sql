-- 0015_services.sql
-- Service pages become content the business manages from the console.
--
-- `services` already exists (0003) as project taxonomy: a name, a slug and a
-- one-line description, referenced by projects.service_ids. It is extended
-- here rather than replaced, so a service page and the service a project is
-- tagged with are the same record and the two lists cannot drift. The
-- existing columns keep their meaning: `name` is the page title and
-- `description` the one-line summary on the services index and landing page.
--
-- Rows that predate this migration were filter labels with no page copy, so
-- they arrive unpublished; an editor fills them in and publishes them.

ALTER TABLE services
  -- The page's standfirst, under the title.
  ADD COLUMN standfirst TEXT NOT NULL DEFAULT '',
  -- Overview paragraphs, in order.
  ADD COLUMN body TEXT[] NOT NULL DEFAULT '{}',
  -- Scope of work: what the discipline covers, as a scannable list.
  ADD COLUMN covers TEXT[] NOT NULL DEFAULT '{}',
  -- What a client is handed, in documents rather than adjectives.
  ADD COLUMN deliverables TEXT[] NOT NULL DEFAULT '{}',
  -- Who typically engages CoBuilt for this.
  ADD COLUMN suited_to TEXT[] NOT NULL DEFAULT '{}',
  -- Ordered steps and benefits, each `{ "title": "...", "body": "..." }`.
  ADD COLUMN process JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Informational only (Property Investment): no call to action, and the
  -- licensing notice above the fold.
  ADD COLUMN informational BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN meta_title VARCHAR(255),
  ADD COLUMN meta_description VARCHAR(160),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT services_process_is_array CHECK (jsonb_typeof(process) = 'array'),
  ADD CONSTRAINT services_benefits_is_array CHECK (jsonb_typeof(benefits) = 'array');

-- The public pages always read published rows in editorial order.
CREATE INDEX idx_services_live ON services (sort_order, name) WHERE published;

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Projects shown on a service page, curated per service. This is separate from
-- projects.service_ids, which tags a project with every service it involved:
-- a page shows the handful an editor chose, in the order they chose, and marks
-- some of them as case studies for this discipline.
CREATE TABLE service_projects (
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  is_case_study BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_id, project_id)
);

CREATE INDEX idx_service_projects_project ON service_projects (project_id);

-- The six disciplines that were static in app/services/services.ts, copied
-- verbatim so a fresh database renders the same pages. A taxonomy row that
-- already holds one of these slugs takes the page copy and is published.
INSERT INTO services (
  slug, name, description, standfirst, body, covers, deliverables, suited_to,
  informational, sort_order, published
) VALUES
  (
    'real-estate-development',
    'Real Estate Development',
    'High-quality residential, commercial, mixed-use and strategic developments.',
    'We originate and develop residential, commercial, mixed-use and strategic schemes — holding the site, the brief and the programme in one place.',
    ARRAY[
      'Development is the discipline that carries every other one. A site is acquired on a thesis about what it should become, and everything that follows — the design, the capital structure, the construction programme, the sales strategy — either serves that thesis or quietly undermines it.',
      'CoBuilt develops its own schemes and co-develops with landowners and institutional partners. In both cases the same team holds the project from acquisition to handover, and every mandatory milestone is published to the development’s Project Passport™ as it is reached.'
    ],
    ARRAY[
      'Site identification, title verification and acquisition structuring',
      'Residential, commercial, mixed-use and strategic schemes',
      'Design development and statutory approvals',
      'Capital structuring against a costed programme',
      'Delivery to a published milestone schedule',
      'Sales, handover and the permanent project record'
    ],
    ARRAY[
      'A development appraisal with the market, technical and cost position',
      'A published milestone programme with dated commitments',
      'A Project Passport™ entry at every mandatory milestone',
      'Handover documentation and the completed record archive'
    ],
    ARRAY[
      'Landowners seeking a development partner rather than a buyer',
      'Institutions placing capital into Nigerian real assets',
      'Occupiers commissioning a scheme for their own use'
    ],
    FALSE,
    10,
    TRUE
  ),
  (
    'construction-management',
    'Construction Management',
    'Project execution focused on quality craftsmanship, cost efficiency, safety and timely delivery.',
    'Construction managed on site, against a published programme, with progress recorded as it happens rather than reconstructed afterwards.',
    ARRAY[
      'Construction is where a development stops being a document. Our construction management teams hold the four things that decide whether the document survives contact with the site: the quality of the work, the cost, the safety of the people doing it, and the date.',
      'Progress is recorded at the point it happens — dated photography, inspection records and certificates attached to the milestone they belong to. That record is what makes a published programme a commitment rather than a forecast.'
    ],
    ARRAY[
      'Contractor procurement, tendering and contract administration',
      'Site supervision and workmanship inspection',
      'Cost control, valuations and variation management',
      'Health, safety and environmental compliance on site',
      'Programme management and progress reporting',
      'Snagging, practical completion and defects management'
    ],
    ARRAY[
      'A procurement strategy and tender report',
      'Monthly progress reports with dated site photography',
      'Milestone certificates filed to the Project Passport™',
      'An as-built record and defects schedule at completion'
    ],
    ARRAY[
      'Owners who need the programme held rather than reported on',
      'Developers appointing a construction manager for a single scheme',
      'Institutions requiring auditable site documentation'
    ],
    FALSE,
    20,
    TRUE
  ),
  (
    'development-management',
    'Development Management',
    'Every stage from concept to completion, coordinated efficiently and professionally.',
    'One accountable team coordinating consultants, contractors, approvals and capital from concept through to completion.',
    ARRAY[
      'Development management is the discipline of keeping a project coherent. A scheme has a dozen parties with a dozen reasonable priorities, and the brief, the budget and the programme have to survive all of them.',
      'We act as the client’s single point of accountability: appointing and holding the consultant team, driving the statutory process, keeping the cost plan honest, and reporting the programme as it stands rather than as it was hoped.'
    ],
    ARRAY[
      'Brief development and feasibility coordination',
      'Consultant appointment and management',
      'Statutory approvals and stakeholder engagement',
      'Cost planning, cash flow and drawdown management',
      'Risk registers and programme management',
      'Reporting to owners, lenders and boards'
    ],
    ARRAY[
      'A project execution plan with roles and decision gates',
      'A cost plan and cash flow updated at each stage',
      'A risk register reviewed and reported monthly',
      'Board-ready progress reports at an agreed cadence'
    ],
    ARRAY[
      'Landowners and family offices without an in-house team',
      'Corporates delivering a scheme outside their core business',
      'Lenders requiring independent development oversight'
    ],
    FALSE,
    30,
    TRUE
  ),
  (
    'project-advisory',
    'Project Advisory',
    'Feasibility studies, commercial assessment, procurement planning and development strategy.',
    'The work that happens before a commitment: whether a scheme stacks up, in what form, and at what cost and risk.',
    ARRAY[
      'Most development losses are decided before a contractor is appointed. Advisory is where that is prevented — testing the market position, the technical constraints and the cost base against each other, and saying plainly when a scheme does not work in its current form.',
      'We produce appraisals that a board, a lender or a partner can act on, with the assumptions visible and the sensitivities tested rather than buried.'
    ],
    ARRAY[
      'Market and demand assessment',
      'Technical and planning feasibility',
      'Development appraisals and sensitivity analysis',
      'Procurement strategy and contract route selection',
      'Highest-and-best-use and option studies',
      'Independent review of an existing scheme'
    ],
    ARRAY[
      'A feasibility report with stated assumptions and sensitivities',
      'An appraisal model with the option comparison',
      'A procurement and contracting recommendation',
      'A written view on the risks worth pricing and the ones worth avoiding'
    ],
    ARRAY[
      'Owners deciding what to do with a site',
      'Investors testing a scheme before committing capital',
      'Boards seeking an independent second opinion'
    ],
    FALSE,
    40,
    TRUE
  ),
  (
    'asset-and-property-management',
    'Asset & Property Management',
    'Preserving and enhancing the long-term value of completed developments.',
    'Completed developments operated so that the quality they were built to is still there in ten years.',
    ARRAY[
      'A development is judged long after handover. Asset and property management is how the standard holds: planned maintenance rather than reactive repair, service charges that are accounted for openly, and tenant relationships that are managed rather than endured.',
      'Because we manage assets we also built, the maintenance plan starts from the as-built record rather than from guesswork — and the Passport archive stays useful well past practical completion.'
    ],
    ARRAY[
      'Facilities and planned preventative maintenance',
      'Service charge budgeting, accounting and reporting',
      'Tenant management, lettings and renewals',
      'Compliance, inspections and statutory testing',
      'Refurbishment and asset improvement planning',
      'Performance reporting to owners'
    ],
    ARRAY[
      'An asset management plan with a maintenance calendar',
      'Audited service charge budgets and reconciliations',
      'Quarterly performance and compliance reporting',
      'A maintained as-built and certification archive'
    ],
    ARRAY[
      'Owners of completed residential and commercial schemes',
      'Estate and facility boards seeking professional management',
      'Investors holding Nigerian real assets at a distance'
    ],
    FALSE,
    50,
    TRUE
  ),
  (
    'property-investment',
    'Property Investment',
    'Information only. No investment is offered or solicited pending regulatory licensing.',
    'Information about how property investment works alongside a CoBuilt development. This is not an offer, and nothing on this page solicits investment.',
    ARRAY[
      'CoBuilt Investment Partners is not currently licensed to offer or solicit investment in Nigeria, and does not do so. This page exists because people ask, and because the honest answer is more useful than silence: it explains how investment would sit alongside a development, and what has to be in place before we could discuss it.',
      'What you can do today is register your interest. That records nothing more than a wish to be contacted when the position changes, and it carries no obligation on either side.'
    ],
    ARRAY[
      'How a development is capitalised, in general terms',
      'The role of equity, debt and off-plan sales in a scheme',
      'What a Project Passport™ lets any stakeholder verify independently',
      'The approvals and licences required before an offer could be made',
      'What the planned Investor Portal would and would not do',
      'How to register interest without committing to anything'
    ],
    ARRAY[
      'Written answers to information requests, with no offer attached',
      'Notification when the regulatory position changes, if you ask for it',
      'Access to the same public project records everyone else sees'
    ],
    ARRAY[
      'Anyone wanting to understand the regulatory position plainly',
      'Prospective partners who will wait for the licences'
    ],
    TRUE,
    60,
    TRUE
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  standfirst = EXCLUDED.standfirst,
  body = EXCLUDED.body,
  covers = EXCLUDED.covers,
  deliverables = EXCLUDED.deliverables,
  suited_to = EXCLUDED.suited_to,
  informational = EXCLUDED.informational,
  sort_order = EXCLUDED.sort_order,
  published = EXCLUDED.published;
