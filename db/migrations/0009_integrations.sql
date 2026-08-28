-- 0009_integrations.sql
-- WhatsApp, live chat and CMS webhook bookkeeping.

CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(32) NOT NULL,
  -- Meta's message ID. Webhooks are re-delivered on retry, so this is the
  -- idempotency key that stops a retry from duplicating a conversation.
  provider_message_id VARCHAR(255) UNIQUE,
  content TEXT,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text',
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status VARCHAR(50),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_phone ON whatsapp_messages (phone, received_at DESC);

CREATE TABLE chat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,  -- 'chatwoot' | 'intercom' | ...
  provider_event_id VARCHAR(255) UNIQUE,
  conversation_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  contact_email VARCHAR(255),
  contact_name VARCHAR(255),
  content TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_events_conversation ON chat_events (conversation_id, received_at DESC);

-- One row per CMS webhook delivery. Gives ops an answer to "did that publish
-- land?" without reading application logs, and makes replays idempotent.
CREATE TABLE cms_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cms_source VARCHAR(50) NOT NULL,
  delivery_id VARCHAR(255),
  model VARCHAR(100) NOT NULL,
  entry_id VARCHAR(255),
  event VARCHAR(100) NOT NULL,   -- 'entry.publish' | 'entry.update' | ...
  status VARCHAR(50) NOT NULL,   -- 'applied' | 'skipped' | 'failed'
  error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cms_sync_delivery_unique UNIQUE (cms_source, delivery_id)
);

CREATE INDEX idx_cms_sync_received ON cms_sync_log (received_at DESC);
