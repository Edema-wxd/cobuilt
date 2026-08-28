import type { Role } from '@/lib/auth/rbac';

/** Row shapes as returned by PostgreSQL, and the DTOs the API serves. */

export type ProjectStatus = 'future' | 'ongoing' | 'completed';

export type MilestoneType =
  | 'commencement'
  | 'foundation'
  | 'superstructure'
  | 'roofing'
  | 'mep'
  | 'finishes'
  | 'practical_completion'
  | 'handover'
  | 'custom';

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';

export type TourType = 'threejs_model' | 'matterport_embed' | 'custom_viewer';

export type TourProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface ProjectRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  long_description: string | null;
  project_type_id: string | null;
  location_id: string | null;
  sector_id: string | null;
  status: ProjectStatus;
  featured_image_url: string | null;
  gallery_ids: string[];
  service_ids: string[];
  tag_ids: string[];
  passport_enabled: boolean;
  passport_start_date: Date | null;
  passport_completion_target: Date | null;
  investment_amount: string | null;
  expected_roi: string | null;
  investor_highlights: unknown;
  investor_highlights_approved: boolean;
  meta_title: string | null;
  meta_description: string | null;
  open_graph_image_url: string | null;
  canonical_url: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  created_by: string | null;
  // Joined taxonomy labels
  project_type_name?: string | null;
  location_name?: string | null;
  sector_name?: string | null;
}

export interface MilestoneRow {
  id: string;
  project_id: string;
  milestone_type: MilestoneType;
  title: string | null;
  description: string | null;
  scheduled_date: Date | null;
  actual_date: Date | null;
  status: MilestoneStatus;
  sort_order: number;
  photo_urls: string[];
  document_urls: string[];
  video_url: string | null;
  is_public: boolean;
  triggered_at: Date;
  updated_at: Date;
  created_by: string | null;
  meta_title: string | null;
  meta_description: string | null;
}

export interface TourRow {
  id: string;
  project_id: string;
  tour_name: string;
  tour_type: TourType;
  model_file_s3_key: string | null;
  file_size_bytes: string | null;
  thumbnail_url: string | null;
  tour_url: string | null;
  embed_code: string | null;
  description: string | null;
  featured: boolean;
  published: boolean;
  view_count: number;
  uploaded_at: Date;
  processing_status: TourProcessingStatus;
  processing_error: string | null;
  updated_at: Date;
}

export interface NewsRow {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  author_id: string | null;
  author_name?: string | null;
  category: string | null;
  featured_image_url: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  meta_title: string | null;
  meta_description: string | null;
  tags: string[];
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: Role;
  permissions: unknown;
  is_active: boolean;
  email_verified: boolean;
  two_factor_enabled: boolean;
  created_at: Date;
  last_login: Date | null;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface FormSubmissionRow {
  id: string;
  form_type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  spam_score: string | null;
  flagged_as_spam: boolean;
  submitted_at: Date;
  processed: boolean;
  processed_at: Date | null;
  retain_until: Date;
  anonymised_at: Date | null;
}

/** Envelope every list endpoint returns, so the frontend paginates uniformly. */
export interface Paginated<T> {
  results: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export function paginate<T>(
  results: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    },
  };
}
