import type { TourRow } from '@/types/models';
import * as tours from '@/lib/repositories/tours';
import * as audit from '@/lib/repositories/audit';
import * as storage from '@/lib/storage/uploadthing';
import handler from '../../pages/api/admin/tours/[tourId]';
import { callRoute } from '../setup/helpers';

/**
 * PATCH /api/admin/tours/[tourId]. The repository, audit log and storage are
 * mocked: what is under test is which fields each tour format accepts, and
 * that the payload constraint is enforced before it reaches the database.
 */

jest.mock('@/lib/repositories/tours');
jest.mock('@/lib/repositories/audit', () => ({
  ...jest.requireActual('@/lib/repositories/audit'),
  record: jest.fn(),
}));
jest.mock('@/lib/storage/uploadthing', () => ({
  isStorageConfigured: jest.fn(() => true),
  lookupFile: jest.fn(),
  deleteFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/rateLimit', () => ({
  ...jest.requireActual('@/lib/rateLimit'),
  consume: jest.fn(() => Promise.resolve({ allowed: true, limit: 100, remaining: 99, resetSeconds: 60 })),
}));

const toursRepo = jest.mocked(tours);
const storageMock = jest.mocked(storage);

const TOUR_ID = '11111111-1111-4111-8111-111111111111';

function row(overrides: Partial<TourRow> = {}): TourRow {
  return {
    id: TOUR_ID,
    project_id: '22222222-2222-4222-8222-222222222222',
    tour_name: 'Show flat',
    tour_type: 'matterport_embed',
    model_file_key: null,
    file_size_bytes: null,
    thumbnail_url: null,
    tour_url: 'https://my.matterport.com/show/?m=abc',
    embed_code: null,
    description: null,
    featured: false,
    published: true,
    view_count: 0,
    uploaded_at: new Date('2026-10-01T09:00:00Z'),
    processing_status: 'ready',
    processing_error: null,
    updated_at: new Date('2026-10-01T09:00:00Z'),
    ...overrides,
  };
}

function patch(body: unknown, as: 'admin' | 'editor' | 'viewer' = 'editor') {
  return callRoute(handler, { method: 'PATCH', query: { tourId: TOUR_ID }, body: body as object, as });
}

beforeEach(() => {
  jest.clearAllMocks();
  toursRepo.update.mockImplementation((_id, input) =>
    Promise.resolve(
      row({
        tour_name: input.tourName ?? 'Show flat',
        published: input.published ?? true,
        model_file_key: input.modelFileKey ?? null,
      }),
    ),
  );
});

describe('PATCH /api/admin/tours/[tourId]', () => {
  it('lets an editor update the shared fields and records the change', async () => {
    toursRepo.findById.mockResolvedValue(row());

    const res = await patch({ tourName: 'Show flat, block B', published: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Show flat, block B', published: false });
    expect(toursRepo.update).toHaveBeenCalledWith(
      TOUR_ID,
      expect.objectContaining({ tourName: 'Show flat, block B', published: false }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tour.updated',
        changes: expect.objectContaining({ fields: ['tourName', 'published'] }),
      }),
    );
  });

  it('refuses a viewer', async () => {
    const res = await patch({ tourName: 'Renamed' }, 'viewer');
    expect(res.status).toBe(403);
    expect(toursRepo.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a tour that does not exist', async () => {
    toursRepo.findById.mockResolvedValue(null);
    const res = await patch({ tourName: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('does not accept a change of format', async () => {
    toursRepo.findById.mockResolvedValue(row());
    const res = await patch({ tourType: 'custom_viewer' });
    expect(res.status).toBe(422);
  });

  it('refuses to clear the last payload of a Matterport tour', async () => {
    toursRepo.findById.mockResolvedValue(row());

    const res = await patch({ tourUrl: null });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('embedCode');
    expect(toursRepo.update).not.toHaveBeenCalled();
  });

  it('allows clearing the link when the embed code remains', async () => {
    toursRepo.findById.mockResolvedValue(row({ embed_code: '<iframe></iframe>' }));
    const res = await patch({ tourUrl: null });
    expect(res.status).toBe(200);
  });

  it('refuses a model key on a tour that is not a Three.js model', async () => {
    toursRepo.findById.mockResolvedValue(row({ tour_type: 'custom_viewer' }));
    const res = await patch({ modelKey: 'abc' });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('modelKey');
  });

  describe('a Three.js tour', () => {
    const threejs = () =>
      row({
        tour_type: 'threejs_model',
        model_file_key: 'old-key',
        tour_url: 'https://utfs.io/f/old-key',
        file_size_bytes: '1000',
      });

    it('refuses a hand-entered URL', async () => {
      toursRepo.findById.mockResolvedValue(threejs());
      const res = await patch({ tourUrl: 'https://example.com/model.glb' });
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].field).toBe('tourUrl');
    });

    it('replaces the model file and deletes the old one', async () => {
      toursRepo.findById.mockResolvedValue(threejs());
      storageMock.lookupFile.mockResolvedValue({
        exists: true,
        sizeBytes: 2048,
        url: 'https://utfs.io/f/new-key',
      });

      const res = await patch({ modelKey: 'new-key' });

      expect(res.status).toBe(200);
      expect(toursRepo.update).toHaveBeenCalledWith(TOUR_ID, {
        tourName: undefined,
        thumbnailUrl: undefined,
        description: undefined,
        featured: undefined,
        published: undefined,
        modelFileKey: 'new-key',
        fileSizeBytes: 2048,
        tourUrl: 'https://utfs.io/f/new-key',
      });
      expect(storageMock.deleteFile).toHaveBeenCalledWith('old-key');
    });

    it('refuses a replacement that was never uploaded', async () => {
      toursRepo.findById.mockResolvedValue(threejs());
      storageMock.lookupFile.mockResolvedValue({ exists: false, sizeBytes: 0, url: null });

      const res = await patch({ modelKey: 'missing-key' });

      expect(res.status).toBe(400);
      expect(toursRepo.update).not.toHaveBeenCalled();
      expect(storageMock.deleteFile).not.toHaveBeenCalled();
    });
  });
});
