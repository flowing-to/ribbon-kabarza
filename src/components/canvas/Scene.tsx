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
import { useCarouselImages, useStableViewportSize, MOBILE_BREAKPOINT } from "./constants";
import { debug } from "../../config";

const isProd = true;

export const project = getProject(
  "Ribbon r3f Project",
  isProd ? { state: projectState } : undefined
);
export const ribbonSheet = project.sheet("Ribbon r3f Sheet");


function PreloadAssets() {
  const { imageUrls } = useCarouselImages();
  useTexture([...imageUrls.map(e => e.img)]);
  useTexture("https://flowing-canvas.vercel.app/linen/Plain_Grey_Texture_col.jpg");
  useTexture("https://flowing-canvas.vercel.app/linen/Plain_Grey_Texture_nrm.jpg");
  return null;
}

export default function Scene() {
  const [animationStart, setAnimationStart] = useState(false);
  const { total, progress } = useProgress();
  const [readyToStart, setReadyToStart] = useState(false);
  const [dpr, setDpr] = useState(2);
  const isClient = useIsClient();

  // stable viewport size with mobile freeze functionality
  const { width: viewportWidth, isMobile } = useStableViewportSize();
  
  // Additional resize handling for mobile stability
  const [stableCanvasSize, setStableCanvasSize] = useState({ width: viewportWidth, height: window.innerHeight });
  const frozenCanvasSizeRef = useRef<{ width: number; height: number } | null>(null);
  
  useEffect(() => {
    const handleResize = () => {
      const currentWidth = viewportWidth || window.innerWidth;
      const currentHeight = window.innerHeight;
      const isMobileViewport = currentWidth < MOBILE_BREAKPOINT;
      
      if (isMobileViewport) {
        // On mobile, freeze canvas dimensions after first measurement
        if (!frozenCanvasSizeRef.current) {
          frozenCanvasSizeRef.current = { width: currentWidth, height: currentHeight };
          setStableCanvasSize({ width: currentWidth, height: currentHeight });
        }
        // Don't update canvas size on mobile
      } else {
        // On desktop, allow responsive behavior
        setStableCanvasSize({ width: currentWidth, height: currentHeight });
        frozenCanvasSizeRef.current = null;
      }
    };
    
    // Initial setup
    handleResize();
    
    // Only listen to resize events that aren't already handled by App.tsx width changes
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewportWidth]);

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
          // Use stable canvas size to prevent resize jittering on mobile
          width: stableCanvasSize.width || undefined,
          height: isMobile ? stableCanvasSize.height : "100vh", // Use fixed height on mobile
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
                  screenWidth={stableCanvasSize.width || 1000}
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
