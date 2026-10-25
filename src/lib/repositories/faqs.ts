import { query } from '../db';

/** Published FAQs, in the order the editors set. */

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

export async function listPublished(category?: string): Promise<FaqRow[]> {
  const params: unknown[] = [];
  let where = 'published = TRUE';
  if (category) {
    params.push(category);
    where += ` AND category = $${params.length}`;
  }

  const { rows } = await query<FaqRow>(
    `SELECT id, question, answer, category
       FROM faqs
      WHERE ${where}
      ORDER BY sort_order ASC, created_at ASC`,
    params,
  );
  return rows;
}
