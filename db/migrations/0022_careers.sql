-- 0022_careers.sql
-- Careers: the vacancies listed at /careers, managed from the console at
-- /admin/careers, and the applications sent through the site, read at
-- /admin/applications (docs/decisions.md §2.28).
--
-- A vacancy is editorial content, published and ordered like a document. An
-- application is personal data: the least the hiring team needs to reply
-- (name, email, phone, a cover note and the CV), with no IP address or user
-- agent, a deadline after which the nightly job deletes it, and the CV held in
-- its own table so that nothing reads the file unless it asked for it.

CREATE TABLE vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  -- full_time, part_time, contract, graduate (the graduate programme) or
  -- internship. The public page groups by it.
  employment_type VARCHAR(20) NOT NULL,
  -- The discipline the role sits in, as /careers names them ("Quantity
  -- surveying and cost control"). Free text: the list is the client's.
  department VARCHAR(120),
  location VARCHAR(160) NOT NULL,
  -- on_site, hybrid or remote; null when the advert does not say.
  work_pattern VARCHAR(10),

  -- The card on /careers; the description, lists and benefits are the page.
  summary VARCHAR(400) NOT NULL,
  description TEXT,
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  requirements TEXT[] NOT NULL DEFAULT '{}',
  benefits TEXT[] NOT NULL DEFAULT '{}',

  -- Shown, and given to search engines, only when the vacancy has one.
  salary_min BIGINT,
  salary_max BIGINT,
  salary_currency CHAR(3) NOT NULL DEFAULT 'NGN',
  -- year or month: what the figures are per.
  salary_period VARCHAR(5),

  -- The last day applications are accepted, in West Africa Time. Null means
  -- open until filled. After it the vacancy leaves /careers and its form
  -- refuses applications; its page stays up and says it has closed.
  closing_date DATE,

  published BOOLEAN NOT NULL DEFAULT FALSE,
  -- When it was first published: JobPosting's datePosted. Kept through an
  -- unpublish, so republishing does not make an old advert look new.
  first_published_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT vacancies_type_valid CHECK (employment_type IN (
    'full_time', 'part_time', 'contract', 'graduate', 'internship'
  )),
  CONSTRAINT vacancies_work_pattern_valid CHECK (work_pattern IS NULL OR work_pattern IN ('on_site', 'hybrid', 'remote')),
  CONSTRAINT vacancies_salary_period_valid CHECK (salary_period IS NULL OR salary_period IN ('year', 'month')),
  CONSTRAINT vacancies_salary_currency_valid CHECK (salary_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT vacancies_salary_positive CHECK (
    (salary_min IS NULL OR salary_min > 0) AND (salary_max IS NULL OR salary_max > 0)
  ),
  CONSTRAINT vacancies_salary_range CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max),
  -- A figure without its period cannot be read, so the two come together.
  CONSTRAINT vacancies_salary_complete CHECK (
    (salary_min IS NULL AND salary_max IS NULL) = (salary_period IS NULL)
  )
);

-- The public list reads published rows in editorial order.
CREATE INDEX idx_vacancies_published ON vacancies (sort_order, title) WHERE published;

CREATE TRIGGER trg_vacancies_updated_at
  BEFORE UPDATE ON vacancies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Null for a speculative application. RESTRICT, not SET NULL: deleting a
  -- vacancy must not quietly turn its applications into speculative ones, so
  -- a vacancy with applications is unpublished rather than deleted.
  vacancy_id UUID REFERENCES vacancies(id) ON DELETE RESTRICT,

  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  cover_note TEXT,

  -- The CV, as received. The bytes are in job_application_cvs; these are what
  -- the inbox shows without reading them. Type is the one the server
  -- detected from the file's content, not the one the browser claimed.
  cv_file_name VARCHAR(255) NOT NULL,
  cv_content_type VARCHAR(100) NOT NULL,
  cv_size_bytes INT NOT NULL,

  -- For staff. Never shown to the applicant.
  status VARCHAR(12) NOT NULL DEFAULT 'new',
  staff_notes TEXT,

  -- Scored by the same checks as the contact form; flagged applications are
  -- kept for a person to review, but nobody is emailed about them.
  spam_score NUMERIC(3, 2),
  flagged_as_spam BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Computed at write time from RETENTION_JOB_APPLICATION_DAYS (§2.4): the
  -- nightly job deletes the row, and its CV with it, once this has passed.
  retain_until TIMESTAMPTZ NOT NULL,

  CONSTRAINT job_applications_status_valid CHECK (status IN (
    'new', 'reviewing', 'shortlisted', 'rejected', 'hired'
  )),
  CONSTRAINT job_applications_cv_type_valid CHECK (cv_content_type IN (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  CONSTRAINT job_applications_cv_size_positive CHECK (cv_size_bytes > 0)
);

-- The inbox lists newest first, by vacancy and status.
CREATE INDEX idx_job_applications_vacancy ON job_applications (vacancy_id, created_at DESC);
CREATE INDEX idx_job_applications_status ON job_applications (status, created_at DESC);
-- Subject access and erasure find a person by email; the purge by deadline.
CREATE INDEX idx_job_applications_email ON job_applications (lower(email));
CREATE INDEX idx_job_applications_retain_until ON job_applications (retain_until);

CREATE TRIGGER trg_job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The CV file itself. Not at any URL: it is read only by the admin download
-- endpoint, behind applications:read, and goes when its application goes.
-- The cap matches MAX_CV_BYTES in src/lib/careers.ts; the database holds the
-- line if a caller ever skips the check.
CREATE TABLE job_application_cvs (
  application_id UUID PRIMARY KEY REFERENCES job_applications(id) ON DELETE CASCADE,
  content BYTEA NOT NULL,
  CONSTRAINT job_application_cvs_size CHECK (octet_length(content) BETWEEN 1 AND 4194304)
);
-- Never compress or inline it: CVs are already-compressed PDF and DOCX, and
-- keeping them out of line keeps the table itself small.
ALTER TABLE job_application_cvs ALTER COLUMN content SET STORAGE EXTERNAL;
