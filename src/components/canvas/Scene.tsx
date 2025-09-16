// Scene.tsx
import projectState from "./Ribbon r3f Project.theatre-project-state.json";
import {
  PerformanceMonitor,
  Preload,
  Stats,
  useProgress,
  useTexture,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { getProject, types } from "@theatre/core";
import { SheetProvider } from "@theatre/r3f";
import { Leva } from "leva";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Experience from "./Experience";
import { useIsClient } from "@uidotdev/usehooks";
import { useCarouselImages } from "./constants";
import { debug } from "../../config";

const isProd = true;

export const project = getProject(
  "Ribbon r3f Project",
  isProd ? { state: projectState } : undefined
);
export const ribbonSheet = project.sheet("Ribbon r3f Sheet");

// ---- hook: viewport client size (excludes scrollbar)
function useViewportClientSize() {
  const isClient = useIsClient();
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!isClient) return;
    const update = () => {
      const { clientWidth, clientHeight } = document.documentElement;
      setSize({ width: clientWidth, height: clientHeight });
    };
    update();

    // Prefer visualViewport if available for mobile UI chrome changes
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      window.addEventListener("resize", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
      };
    } else {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
  }, [isClient]);

  return size;
}

function PreloadAssets() {
  const { imageUrls } = useCarouselImages();
  useTexture([...imageUrls]);
  useTexture("https://flowing-canvas.vercel.app/linen/Plain_Grey_Texture_col.jpg");
  useTexture("https://flowing-canvas.vercel.app/linen/Plain_Grey_Texture_nrm.jpg");
  return null;
}

export default function Scene() {
  const [isMobile, setIsMobile] = useState(true);
  const [animationStart, setAnimationStart] = useState(false);
  const { total, progress } = useProgress();
  const [readyToStart, setReadyToStart] = useState(false);
  const [dpr, setDpr] = useState(2);
  const isClient = useIsClient();

  // viewport width/height excluding scrollbar
  const { width: viewportWidth } = useViewportClientSize();

  useEffect(() => {
    if (debug) console.log("total", total);
    if (debug) console.log("progress", progress);
    if (total > 13 && progress === 100) setReadyToStart(true);
  }, [total, progress]);

  const progressRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    let id: number;
    const loop = () => {
      timeRef.current += 0.01;
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(id);
  }, []);

  const animationProgress = ribbonSheet?.object(
    "progress",
    { x: types.number(0, { range: [-1, 1.5], nudgeMultiplier: 0.0001 }) },
    { reconfigure: true }
  );
  animationProgress?.onValuesChange((v) => (progressRef.current = v.x));

  const time = ribbonSheet?.object(
    "time",
    { t: types.number(0, { range: [0, 100], nudgeMultiplier: 0.0001 }) },
    { reconfigure: true }
  );
  time?.onValuesChange((v) => (timeRef.current = v.t));

  useEffect(() => {
    ribbonSheet.sequence.position = 0;
    if (readyToStart) {
      const t = setTimeout(() => {
        project.ready.then(() => {
          setAnimationStart(true);
          window.onFlowingRibbonStart?.forEach((e) => e());
          ribbonSheet.sequence.play({ range: [0, 6 + 22 / 30] });
        });
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [readyToStart]);

  if (!isClient) return null;

  return (
    <>
      {debug && <Leva />}
      <Canvas
        shadows
        gl={{
          antialias: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          toneMappingExposure: 2,
          precision: "highp",
        }}
        onCreated={({ gl }) => {
          gl.clearDepth();
          gl.toneMapping = THREE.NoToneMapping;
          gl.getContext().getExtension("OES_texture_float");
        }}
        dpr={dpr}
        style={{
          zIndex: 50,
          position: "fixed",
          top: 0,
          left: 0,
          // previously: width: "calc(100vw - 14px)"
          width: viewportWidth || undefined, // number → px, excludes scrollbar
          height: "100vh",
          pointerEvents: "auto",
          touchAction: "pan-y",
          backgroundColor: "transparent",
        }}
      >
        {debug && <Stats />}

        <Suspense fallback={null}>
          <SheetProvider sheet={ribbonSheet}>
            {readyToStart && (
              <group visible={animationStart} dispose={null}>
                <Experience
                  progressRef={progressRef}
                  timeRef={timeRef}
                  isMobile={isMobile}
                  screenWidth={viewportWidth || 1000}
                />
                <PerformanceMonitor
                  bounds={(r) => (r > 90 ? [90, 120] : [50, 70])}
                  onIncline={() => setDpr(2)}
                  onDecline={() => setDpr(1)}
                  flipflops={3}
                  onFallback={(api) => {
                    if (debug) console.log("api", api);
                    if (dpr === 2 && api.fps < 55) setDpr(1);
                  }}
                />
              </group>
            )}
            <PreloadAssets />
            <Preload all />
          </SheetProvider>
        </Suspense>
      </Canvas>
    </>
  );
}
