import type {
  FormSubmissionRow,
  MilestoneRow,
  NewsRow,
  ProjectRow,
  TourRow,
  UserRow,
} from '@/types/models';
import { maskEmail, maskPhone } from './privacy';

/**
 * Row-to-DTO mapping.
 *
 * Serialisation is centralised so that a column added to a table is not
 * automatically exposed on the public API — every field a client sees is
 * listed here deliberately. This is also where the investor-content approval
 * gate (§10) is enforced.
 */

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateOnly(value: Date | string | null): string | null {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface PublicProject {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  longDescription: string | null;
  status: string;
  projectType: string | null;
  location: string | null;
  sector: string | null;
  featuredImageUrl: string | null;
  galleryIds: string[];
  serviceIds: string[];
  tagIds: string[];
  passport: { enabled: boolean; startDate: string | null; completionTarget: string | null };
  investor: {
    investmentAmount: number | null;
    expectedRoi: number | null;
    highlights: unknown;
  } | null;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    openGraphImageUrl: string | null;
    canonicalUrl: string | null;
  };
  publishedAt: string | null;
  updatedAt: string | null;
}

/**
 * Public project view.
 *
 * Investor figures are withheld unless CoBuilt's legal team has approved them
 * for that project (§10) — the flag is checked here rather than at each call
 * site so no route can leak unapproved commercial terms by forgetting to.
 */
export function serializeProject(row: ProjectRow): PublicProject {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    longDescription: row.long_description,
    status: row.status,
    projectType: row.project_type_name ?? null,
    location: row.location_name ?? null,
    sector: row.sector_name ?? null,
    featuredImageUrl: row.featured_image_url,
    galleryIds: row.gallery_ids ?? [],
    serviceIds: row.service_ids ?? [],
    tagIds: row.tag_ids ?? [],
    passport: {
      enabled: row.passport_enabled,
      startDate: toDateOnly(row.passport_start_date),
      completionTarget: toDateOnly(row.passport_completion_target),
    },
    investor: row.investor_highlights_approved
      ? {
          investmentAmount: toNumber(row.investment_amount),
          expectedRoi: toNumber(row.expected_roi),
          highlights: row.investor_highlights ?? null,
        }
      : null,
    seo: {
      metaTitle: row.meta_title,
      metaDescription: row.meta_description,
      openGraphImageUrl: row.open_graph_image_url,
      canonicalUrl: row.canonical_url,
    },
    publishedAt: toIso(row.published_at),
    updatedAt: toIso(row.updated_at),
  };
}

/** Admin view: everything, including unapproved investor content and lifecycle. */
export function serializeProjectForAdmin(row: ProjectRow) {
  return {
    ...serializeProject(row),
    investor: {
      investmentAmount: toNumber(row.investment_amount),
      expectedRoi: toNumber(row.expected_roi),
      highlights: row.investor_highlights ?? null,
      approved: row.investor_highlights_approved,
    },
    projectTypeId: row.project_type_id,
    locationId: row.location_id,
    sectorId: row.sector_id,
    createdAt: toIso(row.created_at),
    createdBy: row.created_by,
    deletedAt: toIso(row.deleted_at),
    isPublished: row.published_at !== null && new Date(row.published_at).getTime() <= Date.now(),
  };
}

export function serializeMilestone(row: MilestoneRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.milestone_type,
    title: row.title,
    description: row.description,
    scheduledDate: toDateOnly(row.scheduled_date),
    actualDate: toDateOnly(row.actual_date),
    status: row.status,
    sortOrder: row.sort_order,
    photoUrls: row.photo_urls ?? [],
    documentUrls: row.document_urls ?? [],
    videoUrl: row.video_url,
    triggeredAt: toIso(row.triggered_at),
    updatedAt: toIso(row.updated_at),
    seo: { metaTitle: row.meta_title, metaDescription: row.meta_description },
  };
}

export function serializeMilestoneForAdmin(row: MilestoneRow) {
  return { ...serializeMilestone(row), isPublic: row.is_public, createdBy: row.created_by };
}

export function serializeTour(row: TourRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.tour_name,
    type: row.tour_type,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    tourUrl: row.tour_url,
    embedCode: row.embed_code,
    modelKey: row.model_file_s3_key,
    fileSizeBytes: toNumber(row.file_size_bytes),
    featured: row.featured,
    viewCount: row.view_count,
    processingStatus: row.processing_status,
    uploadedAt: toIso(row.uploaded_at),
  };
}

export function serializeNews(row: NewsRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category,
    tags: row.tags ?? [],
    author: row.author_name ?? null,
    featuredImageUrl: row.featured_image_url,
    publishedAt: toIso(row.published_at),
    updatedAt: toIso(row.updated_at),
    seo: { metaTitle: row.meta_title, metaDescription: row.meta_description },
  };
}

/** List view omits the article body, which can be hundreds of kilobytes. */
export function serializeNewsSummary(row: NewsRow) {
  const { content, ...summary } = serializeNews(row);
  void content;
  return summary;
}

export function serializeUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    emailVerified: row.email_verified,
    twoFactorEnabled: row.two_factor_enabled,
    createdAt: toIso(row.created_at),
    lastLogin: toIso(row.last_login),
  };
}

/**
 * Submission list view for the admin dashboard.
 *
 * Contact details are masked in the list and only revealed on the detail
 * endpoint, so a shoulder-surfed dashboard or a screenshot does not expose
 * every enquirer's address at once.
 */
export function serializeSubmissionSummary(row: FormSubmissionRow) {
  return {
    id: row.id,
    formType: row.form_type,
    name: row.name,
    email: maskEmail(row.email),
    phone: maskPhone(row.phone),
    excerpt: row.message ? `${row.message.slice(0, 140)}${row.message.length > 140 ? '…' : ''}` : null,
    flaggedAsSpam: row.flagged_as_spam,
    spamScore: toNumber(row.spam_score),
    processed: row.processed,
    submittedAt: toIso(row.submitted_at),
    retainUntil: toIso(row.retain_until),
    anonymised: row.anonymised_at !== null,
  };
}

export function serializeSubmission(row: FormSubmissionRow) {
  return {
    ...serializeSubmissionSummary(row),
    email: row.email,
    phone: row.phone,
    message: row.message,
    metadata: row.metadata,
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
  };
}
