#!/usr/bin/env tsx
import { pool, query, queryOne } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth/password';
import { slugify } from '../src/lib/slug';

/**
 * Development seed data.
 *
 * Idempotent: every insert is ON CONFLICT DO NOTHING or keyed on a slug, so
 * running it repeatedly against a development database is safe. It refuses to
 * run in production — the admin password below is a known value.
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@cobuilt.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMeBeforeUse!';

async function seedTaxonomy(): Promise<void> {
  const projectTypes = ['Residential', 'Commercial', 'Mixed Use', 'Infrastructure'];
  const sectors = ['Real Estate', 'Hospitality', 'Retail', 'Industrial'];
  const services = [
    ['Project Management', 'End-to-end delivery of construction programmes'],
    ['Development Advisory', 'Feasibility, structuring and investment appraisal'],
    ['Asset Management', 'Operating and optimising completed assets'],
  ];
  const locations: Array<[string, string, number, number]> = [
    ['Lekki, Lagos', 'Lagos', 6.4698, 3.5852],
    ['Ikoyi, Lagos', 'Lagos', 6.4541, 3.4316],
    ['Maitama, Abuja', 'FCT', 9.0865, 7.4923],
    ['Port Harcourt', 'Rivers', 4.8156, 7.0498],
  ];

  for (const name of projectTypes) {
    await query(
      `INSERT INTO project_types (name, slug) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      [name, slugify(name)],
    );
  }

  for (const name of sectors) {
    await query(
      `INSERT INTO sectors (name, slug) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      [name, slugify(name)],
    );
  }

  for (const [name, description] of services) {
    await query(
      `INSERT INTO services (name, slug, description) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO NOTHING`,
      [name, slugify(name!), description],
    );
  }

  for (const [name, state, lat, lng] of locations) {
    await query(
      `INSERT INTO locations (name, slug, state, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO NOTHING`,
      [name, slugify(name), state, lat, lng],
    );
  }
}

async function seedAdmin(): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE lower(email) = lower($1)`,
    [ADMIN_EMAIL],
  );
  if (existing) return existing.id;

  const row = await queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role, email_verified)
     VALUES ($1, $2, $3, 'admin', TRUE) RETURNING id`,
    [ADMIN_EMAIL, await hashPassword(ADMIN_PASSWORD), 'Seed Administrator'],
  );

  console.log(`  admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  return row!.id;
}

async function seedProjects(adminId: string): Promise<void> {
  const type = await queryOne<{ id: string }>(`SELECT id FROM project_types LIMIT 1`);
  const location = await queryOne<{ id: string }>(`SELECT id FROM locations LIMIT 1`);
  const sector = await queryOne<{ id: string }>(`SELECT id FROM sectors LIMIT 1`);

  const projects: Array<{ title: string; status: string; description: string }> = [
    {
      title: 'Ocean Ridge Residences',
      status: 'ongoing',
      description: 'A 48-unit waterfront residential development on the Lekki peninsula.',
    },
    {
      title: 'Kingsway Commercial Centre',
      status: 'completed',
      description: 'Grade-A office and retail space delivered in central Ikoyi.',
    },
    {
      title: 'Northgate Mixed-Use Quarter',
      status: 'future',
      description: 'A planned mixed-use quarter combining residential, retail and workspace.',
    },
  ];

  for (const project of projects) {
    const slug = slugify(project.title);

    const row = await queryOne<{ id: string }>(
      `INSERT INTO projects (
         title, slug, description, long_description, project_type_id, location_id, sector_id,
         status, passport_enabled, published_at, created_by, investment_amount, expected_roi,
         investor_highlights
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::project_status,TRUE,NOW(),$9,$10,$11,$12)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [
        project.title,
        slug,
        project.description,
        `${project.description} ${'Delivered under the CoBuilt Project Passport programme, with milestone evidence published as construction progresses. '.repeat(2)}`,
        type?.id ?? null,
        location?.id ?? null,
        sector?.id ?? null,
        project.status,
        adminId,
        1_250_000_000,
        18.5,
        JSON.stringify({ tenure: 'Freehold', deliveryWindow: '24 months' }),
      ],
    );

    if (!row) continue;

    const milestones: Array<[string, string, string | null]> = [
      ['commencement', 'completed', '2025-02-10'],
      ['foundation', 'completed', '2025-05-22'],
      ['superstructure', 'in_progress', null],
      ['roofing', 'pending', null],
    ];

    for (const [index, [milestoneType, status, actualDate]] of milestones.entries()) {
      await query(
        `INSERT INTO passport_milestones
           (project_id, milestone_type, title, status, sort_order, actual_date, created_by)
         VALUES ($1, $2::milestone_type, $3, $4::milestone_status, $5, $6::date, $7)`,
        [
          row.id,
          milestoneType,
          milestoneType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
          status,
          index,
          actualDate,
          adminId,
        ],
      );
    }
  }
}

async function seedNews(adminId: string): Promise<void> {
  const articles = [
    ['CoBuilt breaks ground on Ocean Ridge Residences', 'press_release'],
    ['Project Passport: transparency as a construction standard', 'update'],
    ['CoBuilt appoints new Head of Delivery', 'announcement'],
  ];

  for (const [title, category] of articles) {
    await query(
      `INSERT INTO news_articles (title, slug, content, excerpt, category, author_id, published_at, tags)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
       ON CONFLICT (slug) DO NOTHING`,
      [
        title,
        slugify(title!),
        `${title}. ${'This placeholder body exists so that full-text search, pagination and related-article ranking can be exercised against realistic content lengths during development. '.repeat(4)}`,
        `${title} — summary for listing pages.`,
        category,
        adminId,
        ['cobuilt', category === 'press_release' ? 'press' : 'company'],
      ],
    );
  }
}

async function seedFaqs(): Promise<void> {
  const faqs: Array<[string, string, string]> = [
    [
      'What is the Project Passport?',
      'The Project Passport is a published, milestone-by-milestone record of a project’s construction progress, with dated photographic and documentary evidence at each stage.',
      'projects',
    ],
    [
      'Does CoBuilt sell securities through this website?',
      'No. The investor pages are informational only. Nothing on this website constitutes an offer to sell or a solicitation to buy any security.',
      'investment',
    ],
    [
      'How is my personal data handled?',
      'Enquiry data is stored in Nigeria, retained for 90 days (two years for investor enquiries) and is available for export or erasure on request, in line with the NDPA.',
      'privacy',
    ],
  ];

  for (const [index, [question, answer, category]] of faqs.entries()) {
    await query(
      `INSERT INTO faqs (question, answer, category, sort_order) VALUES ($1,$2,$3,$4)`,
      [question, answer, category, index],
    );
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  console.log('Seeding development data...');

  await seedTaxonomy();
  const adminId = await seedAdmin();
  await seedProjects(adminId);
  await seedNews(adminId);
  await seedFaqs();

  console.log('Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
