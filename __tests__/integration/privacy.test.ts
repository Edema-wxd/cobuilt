import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { pool, query } from '@/lib/db';
import * as conversations from '@/lib/repositories/conversations';

describeWithDatabase('data protection', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('message retention', () => {
    it('deletes WhatsApp and chat messages older than the retention period', async () => {
      await query(
        `INSERT INTO whatsapp_messages (phone, content, direction, received_at)
         VALUES ('2348011111111', 'old', 'inbound', NOW() - INTERVAL '91 days'),
                ('2348011111111', 'new', 'inbound', NOW() - INTERVAL '89 days')`,
      );
      await query(
        `INSERT INTO chat_events (provider, event_type, content, received_at)
         VALUES ('chatwoot', 'message_created', 'old', NOW() - INTERVAL '91 days'),
                ('chatwoot', 'message_created', 'new', NOW())`,
      );

      expect(await conversations.purgeExpired()).toEqual({ whatsapp: 1, chat: 1 });

      const left = await query<{ content: string }>(
        `SELECT content FROM whatsapp_messages UNION ALL SELECT content FROM chat_events`,
      );
      expect(left.rows.map((r) => r.content)).toEqual(['new', 'new']);
    });
  });
});
