import { zipSync, strToU8 } from 'fflate';
import {
  HEAVY_MODEL_BYTES,
  ModelError,
  assessDevice,
  downloadModel,
  resourceKey,
  sniffFormat,
  unpackModel,
} from '../../app/projects/[slug]/tour-model';

/**
 * The Three.js tour viewer's groundwork: whether a device should try, what a
 * downloaded file is, and how a zip becomes a scene plus its resources. None of
 * it touches WebGL, which is why it lives apart from the viewer component.
 */

const glb = () => new Uint8Array([...strToU8('glTF'), 2, 0, 0, 0, 12, 0, 0, 0]);
const gltf = (json: object) => strToU8(JSON.stringify(json));

describe('assessDevice', () => {
  const heavy = HEAVY_MODEL_BYTES + 1;

  it('refuses outright without WebGL, whatever the size', () => {
    expect(assessDevice({ webgl: false }, 1_000)).toEqual({ kind: 'unsupported' });
  });

  it('loads a small model without asking, even on a weak device', () => {
    expect(assessDevice({ webgl: true, deviceMemory: 1, saveData: true }, 5_000_000)).toEqual({
      kind: 'ok',
    });
  });

  it('asks first when a heavy model meets little memory or a data saver', () => {
    expect(assessDevice({ webgl: true, deviceMemory: 2 }, heavy)).toEqual({
      kind: 'caution',
      reason: 'low-memory',
    });
    expect(assessDevice({ webgl: true, saveData: true }, heavy)).toEqual({
      kind: 'caution',
      reason: 'save-data',
    });
  });

  it('treats an unreported memory size as no evidence of a weak device', () => {
    expect(assessDevice({ webgl: true }, heavy)).toEqual({ kind: 'ok' });
  });

  it('treats an unknown file size as heavy', () => {
    expect(assessDevice({ webgl: true, deviceMemory: 1 }, null)).toEqual({
      kind: 'caution',
      reason: 'low-memory',
    });
  });
});

describe('sniffFormat', () => {
  it('reads the format from the bytes, not a file extension', () => {
    expect(sniffFormat(glb())).toBe('glb');
    expect(sniffFormat(gltf({ asset: { version: '2.0' } }))).toBe('gltf');
    expect(sniffFormat(zipSync({ 'a.txt': strToU8('a') }))).toBe('zip');
    expect(sniffFormat(strToU8('<!doctype html>'))).toBe('unknown');
    expect(sniffFormat(new Uint8Array())).toBe('unknown');
  });

  it('allows whitespace and a byte-order mark before a .gltf brace', () => {
    expect(sniffFormat(new Uint8Array([0xef, 0xbb, 0xbf, 0x0a, 0x20, 0x7b]))).toBe('gltf');
  });
});

describe('unpackModel', () => {
  it('passes a .glb through with no resources', () => {
    const result = unpackModel(glb());
    expect(result.scene).toBeInstanceOf(ArrayBuffer);
    expect(result.resources.size).toBe(0);
  });

  it('finds the scene in a zip and keys its resources relative to it', () => {
    const archive = zipSync({
      'export/house.gltf': gltf({ buffers: [{ uri: 'house.bin' }] }),
      'export/house.bin': new Uint8Array([1, 2, 3]),
      'export/textures/brick.png': new Uint8Array([4]),
      '__MACOSX/export/._house.gltf': new Uint8Array([0]),
    });

    const result = unpackModel(archive);

    expect(typeof result.scene).toBe('string');
    expect(JSON.parse(result.scene as string)).toEqual({ buffers: [{ uri: 'house.bin' }] });
    expect([...result.resources.keys()].sort()).toEqual(['house.bin', 'textures/brick.png']);
  });

  it('prefers a self-contained .glb when a zip holds both', () => {
    const archive = zipSync({ 'scene.gltf': gltf({}), 'scene.glb': glb() });
    expect(unpackModel(archive).scene).toBeInstanceOf(ArrayBuffer);
  });

  it('rejects a zip with no scene, and anything that is not a model', () => {
    expect(() => unpackModel(zipSync({ 'readme.txt': strToU8('hi') }))).toThrow(ModelError);
    expect(() => unpackModel(strToU8('<html>'))).toThrow(
      expect.objectContaining({ reason: 'format' }),
    );
  });
});

describe('resourceKey', () => {
  it('normalises a relative URI to its archive path', () => {
    expect(resourceKey('house.bin')).toBe('house.bin');
    expect(resourceKey('./textures/brick%20wall.png')).toBe('textures/brick wall.png');
  });

  it('leaves absolute and data URIs to the network', () => {
    expect(resourceKey('data:application/octet-stream;base64,AA==')).toBeNull();
    expect(resourceKey('https://cdn.example.com/a.bin')).toBeNull();
    expect(resourceKey('/root.bin')).toBeNull();
  });
});

describe('downloadModel', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  function respondWith(chunks: Uint8Array[], headers: Record<string, string> = {}, status = 200) {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              for (const chunk of chunks) controller.enqueue(chunk);
              controller.close();
            },
          }),
          { status, headers },
        ),
      ),
    );
  }

  it('reassembles the body and reports progress against Content-Length', async () => {
    respondWith([new Uint8Array([1, 2]), new Uint8Array([3, 4])], { 'content-length': '4' });
    const progress: Array<number | null> = [];

    const bytes = await downloadModel('https://files.example/model', {
      signal: new AbortController().signal,
      expectedBytes: null,
      onProgress: (fraction) => progress.push(fraction),
    });

    expect([...bytes]).toEqual([1, 2, 3, 4]);
    expect(progress).toEqual([0, 0.5, 1]);
  });

  it('falls back to the recorded size, then to indeterminate', async () => {
    respondWith([new Uint8Array([1, 2])]);
    const sized: Array<number | null> = [];
    await downloadModel('https://files.example/model', {
      signal: new AbortController().signal,
      expectedBytes: 4,
      onProgress: (fraction) => sized.push(fraction),
    });
    expect(sized).toEqual([0, 0.5]);

    respondWith([new Uint8Array([1, 2])]);
    const unsized: Array<number | null> = [];
    await downloadModel('https://files.example/model', {
      signal: new AbortController().signal,
      expectedBytes: null,
      onProgress: (fraction) => unsized.push(fraction),
    });
    expect(unsized).toEqual([null, null]);
  });

  it('reports a failed response as a network failure', async () => {
    respondWith([], {}, 404);
    await expect(
      downloadModel('https://files.example/model', {
        signal: new AbortController().signal,
        expectedBytes: null,
        onProgress: () => undefined,
      }),
    ).rejects.toMatchObject({ reason: 'network' });
  });
});
