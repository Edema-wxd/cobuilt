import { unzipSync } from 'fflate';

/**
 * Everything the Three.js tour viewer does before WebGL is involved: deciding
 * whether this device should try, downloading the model with progress, and
 * working out what was downloaded.
 *
 * Kept apart from `model-viewer.tsx` so it carries no Three.js import and can
 * be tested without a browser.
 */

/**
 * Above this, a device that reports little memory or asks to save data is told
 * what the download is before it starts, rather than finding out halfway
 * through. Below it, a model is small enough to just load.
 */
export const HEAVY_MODEL_BYTES = 25_000_000;

/** `navigator.deviceMemory` is rounded down to a power of two; 2 GB is a budget phone. */
const LOW_MEMORY_GB = 2;

export type DeviceVerdict =
  /** Load without asking. */
  | { kind: 'ok' }
  /** Can display it, but say what it costs first and let the visitor choose. */
  | { kind: 'caution'; reason: 'low-memory' | 'save-data' }
  /** Cannot display a 3D model at all. */
  | { kind: 'unsupported' };

interface DeviceHints {
  webgl: boolean;
  /** Chromium only; undefined elsewhere, which is not evidence of anything. */
  deviceMemory?: number | undefined;
  saveData?: boolean | undefined;
}

export function assessDevice(hints: DeviceHints, fileSizeBytes: number | null): DeviceVerdict {
  if (!hints.webgl) return { kind: 'unsupported' };

  // An unknown size is treated as heavy: the visitor still gets to choose.
  const heavy = fileSizeBytes === null || fileSizeBytes > HEAVY_MODEL_BYTES;
  if (!heavy) return { kind: 'ok' };

  if (hints.saveData) return { kind: 'caution', reason: 'save-data' };
  if (hints.deviceMemory !== undefined && hints.deviceMemory <= LOW_MEMORY_GB) {
    return { kind: 'caution', reason: 'low-memory' };
  }
  return { kind: 'ok' };
}

/** Reads the hints `assessDevice` needs from the running browser. */
export function browserHints(): DeviceHints {
  let webgl = false;
  try {
    const canvas = document.createElement('canvas');
    webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    webgl = false;
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  return { webgl, deviceMemory: nav.deviceMemory, saveData: nav.connection?.saveData };
}

export type ModelFormat = 'glb' | 'gltf' | 'zip' | 'unknown';

/**
 * What a downloaded file is, from its first bytes. Storage URLs carry no
 * extension, so the content is the only reliable signal.
 */
export function sniffFormat(bytes: Uint8Array): ModelFormat {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));

  if (bytes.length >= 4 && ascii(0, 4) === 'glTF') return 'glb';
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'zip';
  }

  // A .gltf is JSON: the first non-whitespace character is a brace.
  for (const byte of bytes.subarray(0, 64)) {
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0xef || byte === 0xbb || byte === 0xbf) {
      continue;
    }
    return byte === 0x7b ? 'gltf' : 'unknown';
  }
  return 'unknown';
}

export class ModelError extends Error {
  constructor(
    /** `format`: the file is not something this viewer reads. `network`: it never arrived whole. */
    readonly reason: 'format' | 'network',
    message: string,
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

export interface ModelPackage {
  /** The scene document: a .glb's bytes, or a .gltf's JSON text. */
  scene: ArrayBuffer | string;
  /**
   * The other files the scene refers to — buffers and textures — by their
   * path inside the archive. Empty for a .glb, which carries its own.
   */
  resources: Map<string, Uint8Array>;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Turns a downloaded file into a scene plus its resources. The admin console
 * accepts .glb, .gltf and .zip, so all three arrive here; a zip is expected to
 * hold one scene and whatever it references.
 */
export function unpackModel(bytes: Uint8Array): ModelPackage {
  const format = sniffFormat(bytes);

  if (format === 'glb') return { scene: toArrayBuffer(bytes), resources: new Map() };
  if (format === 'gltf') return { scene: new TextDecoder().decode(bytes), resources: new Map() };
  if (format !== 'zip') throw new ModelError('format', 'Not a glTF model or a zip archive.');

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new ModelError('format', 'The archive could not be opened.');
  }

  const paths = Object.keys(entries)
    // macOS archive litter is never the scene.
    .filter((path) => !path.startsWith('__MACOSX/') && !path.endsWith('/'))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));

  // A .glb is self-contained, so it wins if both are present. The shallowest
  // path wins among equals, which picks the main scene over a nested variant.
  const scenePath =
    paths.find((path) => path.toLowerCase().endsWith('.glb')) ??
    paths.find((path) => path.toLowerCase().endsWith('.gltf'));
  if (!scenePath) throw new ModelError('format', 'The archive holds no .glb or .gltf file.');

  const sceneBytes = entries[scenePath]!;
  if (scenePath.toLowerCase().endsWith('.glb')) {
    return { scene: toArrayBuffer(sceneBytes), resources: new Map() };
  }

  // Resource URIs in a .gltf are relative to the .gltf itself, so the map is
  // keyed relative to the scene's folder.
  const folder = scenePath.includes('/') ? scenePath.slice(0, scenePath.lastIndexOf('/') + 1) : '';
  const resources = new Map<string, Uint8Array>();
  for (const path of paths) {
    if (path === scenePath || !path.startsWith(folder)) continue;
    resources.set(path.slice(folder.length), entries[path]!);
  }

  return { scene: new TextDecoder().decode(sceneBytes), resources };
}

/**
 * The archive path a resource URI from a .gltf refers to: percent-decoded,
 * with any `./` prefix dropped. Returns null for an absolute or data URI,
 * which is not something the archive can supply.
 */
export function resourceKey(uri: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(uri) || uri.startsWith('/')) return null;
  let path = uri;
  try {
    path = decodeURIComponent(uri);
  } catch {
    // A stray % is a literal character in the file name.
  }
  return path.replace(/^(\.\/)+/, '');
}

/**
 * Downloads a model, reporting progress as a fraction of the whole. `total`
 * comes from Content-Length when the server sends it and from the size the
 * admin recorded otherwise; with neither, progress is null (indeterminate).
 */
export async function downloadModel(
  url: string,
  options: {
    signal: AbortSignal;
    expectedBytes: number | null;
    onProgress: (fraction: number | null) => void;
  },
): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(url, { signal: options.signal, credentials: 'omit' });
  } catch (error) {
    if (options.signal.aborted) throw error;
    throw new ModelError('network', 'The model could not be fetched.');
  }
  if (!response.ok) throw new ModelError('network', `The model request failed (${response.status}).`);

  const header = Number(response.headers.get('content-length'));
  const total = Number.isFinite(header) && header > 0 ? header : options.expectedBytes;

  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    options.onProgress(1);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  options.onProgress(total ? 0 : null);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      options.onProgress(total ? Math.min(received / total, 1) : null);
    }
  } catch (error) {
    if (options.signal.aborted) throw error;
    throw new ModelError('network', 'The download was interrupted.');
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
