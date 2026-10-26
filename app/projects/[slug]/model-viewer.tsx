'use client';

import { useEffect, useRef, useState } from 'react';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ModelError, downloadModel, resourceKey, unpackModel } from './tour-model';

/**
 * The Three.js tour viewer — a `threejs_model` tour, rendered in the page.
 *
 * Three.js and its loaders are imported inside the effect, not at the top of
 * the module, so the ~700 KB of it is fetched only when someone actually enters
 * a model tour, and in parallel with the model itself. A chunk that fails to
 * load is then just another failed download, rather than an error that takes
 * the page down.
 *
 * Loading, failure and the viewer chrome (fullscreen, exit, tour switching)
 * belong to the project page; this component reports progress and the outcome
 * and draws the model. See docs/decisions.md §2.16.
 */

export type ModelFailure =
  /** It never arrived whole — trying again may work. */
  | 'network'
  /** It arrived but is not a model this viewer can read — trying again will not help. */
  | 'format'
  /** The device could not draw it: WebGL failed to start or the GPU dropped the context. */
  | 'render';

export interface ModelProgress {
  phase: 'download' | 'prepare';
  /** 0–1, or null when the size is unknown. */
  fraction: number | null;
}

interface ModelViewerProps {
  url: string;
  name: string;
  expectedBytes: number | null;
  onProgress: (progress: ModelProgress) => void;
  onReady: () => void;
  onError: (failure: ModelFailure) => void;
}

/** Draco-compressed meshes need a decoder served by this site; see public/vendor/draco. */
const DRACO_PATH = '/vendor/draco/';

export default function ModelViewer({
  url,
  name,
  expectedBytes,
  onProgress,
  onReady,
  onError,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [ready, setReady] = useState(false);

  // The callbacks change identity on every parent render; the load must not.
  const callbacks = useRef({ onProgress, onReady, onError });
  callbacks.current = { onProgress, onReady, onError };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const controller = new AbortController();
    const cleanup: Array<() => void> = [];
    let disposed = false;

    async function load(target: HTMLDivElement): Promise<void> {
      const [bytes, THREE, gltfModule, dracoModule, controlsModule, roomModule, meshoptModule] =
        await Promise.all([
          downloadModel(url, {
            signal: controller.signal,
            expectedBytes,
            onProgress: (fraction) => callbacks.current.onProgress({ phase: 'download', fraction }),
          }),
          import('three'),
          import('three/addons/loaders/GLTFLoader.js'),
          import('three/addons/loaders/DRACOLoader.js'),
          import('three/addons/controls/OrbitControls.js'),
          import('three/addons/environments/RoomEnvironment.js'),
          import('three/addons/libs/meshopt_decoder.module.js'),
        ]).catch((error: unknown) => {
          // A failed chunk import is a network failure from the visitor's side.
          if (error instanceof ModelError || controller.signal.aborted) throw error;
          throw new ModelError('network', 'The viewer could not be loaded.');
        });
      if (disposed) return;

      callbacks.current.onProgress({ phase: 'prepare', fraction: null });
      const model = unpackModel(bytes);

      // Files from a zip are handed to the loader as blob URLs, matched on the
      // relative path the .gltf asks for.
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((requested) => {
        const key = resourceKey(requested);
        const data = key === null ? undefined : model.resources.get(key);
        if (!data) return requested;
        const blobUrl = URL.createObjectURL(new Blob([data as BlobPart]));
        cleanup.push(() => URL.revokeObjectURL(blobUrl));
        return blobUrl;
      });

      const draco = new dracoModule.DRACOLoader(manager).setDecoderPath(DRACO_PATH);
      cleanup.push(() => draco.dispose());
      const loader = new gltfModule.GLTFLoader(manager)
        .setDRACOLoader(draco)
        .setMeshoptDecoder(meshoptModule.MeshoptDecoder);

      // A lone .gltf resolves its resources against its own URL; one from a zip
      // resolves them through the URL modifier above.
      const resourcePath =
        typeof model.scene === 'string' && model.resources.size === 0
          ? THREE.LoaderUtils.extractUrlBase(url)
          : '';

      let gltf;
      try {
        gltf = await loader.parseAsync(model.scene, resourcePath);
      } catch {
        throw new ModelError('format', 'The model could not be read.');
      }
      if (disposed) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
      } catch {
        callbacks.current.onError('render');
        return;
      }
      cleanup.push(() => {
        renderer.setAnimationLoop(null);
        renderer.dispose();
        // Hands the GPU context back now rather than at garbage collection:
        // phones cap how many a page may hold.
        renderer.forceContextLoss();
        renderer.domElement.remove();
      });

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      // Neutral rather than ACES: ACES shifts saturated colours, and a
      // specified material — the brand orange included — should read as itself.
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.domElement.className = 'block size-full';
      renderer.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        if (!disposed) callbacks.current.onError('render');
      });
      target.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      // --ink-deep, so the canvas reads as part of the viewer frame.
      scene.background = new THREE.Color('#141414');
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = pmrem.fromScene(new roomModule.RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      scene.environment = environment;
      scene.add(gltf.scene);
      cleanup.push(() => {
        environment.dispose();
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry.dispose();
          const materials: Array<Record<string, unknown> & { dispose: () => void }> = Array.isArray(
            object.material,
          )
            ? object.material
            : [object.material];
          for (const material of materials) {
            for (const value of Object.values(material)) {
              if (value instanceof THREE.Texture) value.dispose();
            }
            material.dispose();
          }
        });
      });

      // Frame the model: whatever its units and wherever its origin, it opens
      // filling the view from a three-quarter angle.
      const box = new THREE.Box3().setFromObject(gltf.scene);
      if (box.isEmpty()) throw new ModelError('format', 'The model has no geometry.');
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;

      const camera = new THREE.PerspectiveCamera(45, 1, radius / 100, radius * 100);
      // A little beyond a tight fit, so the base clears the help strip.
      const distance = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15;
      camera.position
        .copy(center)
        .add(new THREE.Vector3(1, 0.6, 1).normalize().multiplyScalar(distance));

      const controls = new controlsModule.OrbitControls(camera, renderer.domElement);
      controls.target.copy(center);
      controls.enableDamping = true;
      controls.minDistance = radius * 0.05;
      controls.maxDistance = distance * 4;
      controls.listenToKeyEvents(target);
      controls.update();
      controls.saveState();
      controlsRef.current = controls;
      cleanup.push(() => {
        controls.stopListenToKeyEvents();
        controls.dispose();
        controlsRef.current = null;
      });

      const resize = () => {
        const width = target.clientWidth;
        const height = target.clientHeight;
        if (width === 0 || height === 0) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resize();
      // Covers fullscreen too, which only changes the container's size.
      const observer = new ResizeObserver(resize);
      observer.observe(target);
      cleanup.push(() => observer.disconnect());

      renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
      });

      setReady(true);
      callbacks.current.onReady();
    }

    load(container).catch((error: unknown) => {
      if (disposed || controller.signal.aborted) return;
      callbacks.current.onError(error instanceof ModelError ? error.reason : 'format');
    });

    return () => {
      disposed = true;
      controller.abort();
      for (const step of cleanup.reverse()) step();
    };
  }, [url, expectedBytes]);

  return (
    <>
      {/*
        Focusable so the arrow keys can pan the model; `application` tells a
        screen reader to pass those keys through rather than read with them.
      */}
      <div
        ref={containerRef}
        className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange"
        role="application"
        aria-roledescription="3D model viewer"
        aria-label={`${name} — 3D model`}
        aria-describedby={ready ? 'model-viewer-help' : undefined}
        tabIndex={ready ? 0 : -1}
      />
      {ready ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-2.5">
          <p
            id="model-viewer-help"
            className="bg-ink-deep/80 px-2.5 py-1.5 text-[0.719rem] leading-[1.5] text-zinc-200"
          >
            Drag to turn · Pinch<span className="hidden sm:inline"> or scroll</span> to zoom
            <span className="hidden sm:inline"> · Two fingers or right-drag to move · Arrow keys pan</span>
          </p>
          <button
            type="button"
            className="pointer-events-auto min-h-target flex-none cursor-pointer bg-ink-deep/80 px-3.5 text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-white hover:text-orange-on-dark"
            onClick={() => controlsRef.current?.reset()}
          >
            Reset view
          </button>
        </div>
      ) : null}
    </>
  );
}
