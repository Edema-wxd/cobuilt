-- 0008_forms_and_newsletter.sql
-- Public form capture, newsletter list and the NDPA retention clock.

CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type VARCHAR(100) NOT NULL,  -- 'inquiry' | 'newsletter' | 'investment'

  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Dynamic fields per form type

  ip_address INET,
  user_agent TEXT,
  spam_score NUMERIC(3,2),  -- 0.00 to 1.00
  flagged_as_spam BOOLEAN NOT NULL DEFAULT FALSE,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- NDPA retention (§11): inquiries purge at 90 days, investment inquiries at
  -- 2 years. Storing the deadline on the row means the purge job needs no
  -- per-form-type knowledge and the retention policy is auditable in the data.
  retain_until TIMESTAMPTZ NOT NULL,
  anonymised_at TIMESTAMPTZ,

  CONSTRAINT form_submissions_spam_score_range
    CHECK (spam_score IS NULL OR (spam_score >= 0 AND spam_score <= 1))
);

CREATE INDEX idx_submissions_form ON form_submissions (form_type, submitted_at DESC);
CREATE INDEX idx_submissions_email ON form_submissions (lower(email));
CREATE INDEX idx_submissions_spam ON form_submissions (flagged_as_spam);
CREATE INDEX idx_submissions_retention ON form_submissions (retain_until)
  WHERE anonymised_at IS NULL;

CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),

  -- Double opt-in: a subscriber is only mailed once confirmed_at is set.
  confirmation_token_hash VARCHAR(255),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  -- Stable token used to build one-click unsubscribe links.
  unsubscribe_token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),

  source VARCHAR(100),  -- Which page or campaign captured the address
  ip_address INET,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_newsletter_email ON newsletter_subscribers (lower(email));
CREATE INDEX idx_newsletter_active ON newsletter_subscribers (confirmed_at)
  WHERE unsubscribed_at IS NULL;
