-- 0007_news_articles.sql
-- News / press releases.

CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt VARCHAR(300),

  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(100),  -- 'press_release' | 'update' | 'announcement'
  featured_image_url VARCHAR(512),

  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- SEO
  meta_title VARCHAR(255),
  meta_description VARCHAR(160),
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- CMS provenance (see docs/cms-sync.md)
  cms_source VARCHAR(50),
  cms_id VARCHAR(255),
  cms_synced_at TIMESTAMPTZ,

  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, '')
    )
  ) STORED,

  CONSTRAINT news_cms_identity_unique UNIQUE (cms_source, cms_id)
);

CREATE INDEX idx_news_published ON news_articles (published_at DESC NULLS LAST);
CREATE INDEX idx_news_slug ON news_articles (slug);
CREATE INDEX idx_news_search ON news_articles USING GIN (search_vector);
CREATE INDEX idx_news_category ON news_articles (category, published_at DESC);
CREATE INDEX idx_news_tags ON news_articles USING GIN (tags);
CREATE INDEX idx_news_live ON news_articles (published_at DESC)
  WHERE deleted_at IS NULL AND published_at IS NOT NULL;

CREATE TRIGGER trg_news_updated_at
  BEFORE UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- FAQs are searchable alongside projects and news (§6).
CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question VARCHAR(512) NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100),
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  cms_source VARCHAR(50),
  cms_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(question, '') || ' ' || coalesce(answer, ''))
  ) STORED,

  CONSTRAINT faqs_cms_identity_unique UNIQUE (cms_source, cms_id)
);

CREATE INDEX idx_faqs_search ON faqs USING GIN (search_vector);
CREATE INDEX idx_faqs_category ON faqs (category, sort_order);

CREATE TRIGGER trg_faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Leadership profiles, surfaced on the investor page to build trust (§10).
CREATE TABLE leadership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  role_title VARCHAR(255),
  bio TEXT,
  photo_url VARCHAR(512),
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  cms_source VARCHAR(50),
  cms_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadership_cms_identity_unique UNIQUE (cms_source, cms_id)
);

CREATE TRIGGER trg_leadership_updated_at
  BEFORE UPDATE ON leadership
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
