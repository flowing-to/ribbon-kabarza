import { useTexture } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Vector3 } from "three";
import type { IimageShaderMaterial } from "./Experience";
import { debug } from "../../config";

let titlesList:{imageNum:number, img:string, title:string, titleM:string,texture:any}[] = [];
[...document.querySelectorAll("[data-flow-ribbon-nr]")].forEach(el => {
  const imageNum = parseInt(el.getAttribute("data-flow-ribbon-nr")!)
  const title = el.getAttribute("data-flow-ribbon-text")!
  const titleM = el.getAttribute("data-flow-ribbon-text-m")!
  const img = el.getAttribute("src")!

  titlesList.push({
    imageNum,
    title,
    titleM,
    img,
    texture:undefined
  })
})
titlesList = titlesList.sort((a,b) => a.imageNum-b.imageNum ).slice(0,12)
if (debug) console.log(titlesList)

export const carouselRadius = 26;
export const carouselCount = 12;
export const numPoints = 16 * 60;
export const progressLength = 0.916;

export const MOMENTUM_DECAY = 0.99;
export const MOMENTUM_BOOST = 0.02;
export const BASE_SPEED = 0.1;

export const MOBILE_BREAKPOINT = 768;

// Hook to get viewport size with mobile freeze functionality
export function useStableViewportSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const fixedSizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const updateSize = () => {
      const { clientWidth, clientHeight } = document.documentElement;
      const currentSize = { width: clientWidth, height: clientHeight };
      const isMobileViewport = clientWidth < MOBILE_BREAKPOINT;
      
      setIsMobile(isMobileViewport);
      
      // On mobile, freeze dimensions after first measurement
      if (isMobileViewport) {
        if (!fixedSizeRef.current) {
          fixedSizeRef.current = currentSize;
          setSize(currentSize);
        }
        // Don't update size on mobile after initial measurement
      } else {
        // On desktop, allow responsive behavior
        setSize(currentSize);
        fixedSizeRef.current = null;
      }
    };

    updateSize();

    // Prefer visualViewport if available for mobile UI chrome changes
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateSize);
      vv.addEventListener("scroll", updateSize);
      window.addEventListener("resize", updateSize);
      return () => {
        vv.removeEventListener("resize", updateSize);
        vv.removeEventListener("scroll", updateSize);
        window.removeEventListener("resize", updateSize);
      };
    } else {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }
  }, []);

  return { ...size, isMobile };
}

// Hook for stable font size calculation with mobile freeze
export function useStableFontSize() {
  const cachedMobileFontSizeRef = useRef<number | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  
  const getFontSize = useCallback((...text: string[]) => {
    const textLength = text.join("\n").split("\n").map(e => e.trim()).sort((a,b) => b.length-a.length)[0].length;
    const currentWidth = window.innerWidth;
    const isMobile = currentWidth < MOBILE_BREAKPOINT;
    
    if (isMobile !== isMobileLayout) {
      setIsMobileLayout(isMobile);
    }
    
    // On mobile, use cached value if available
    if (isMobile && cachedMobileFontSizeRef.current !== null) {
      return cachedMobileFontSizeRef.current;
    }
    
    const screenW = Math.min(currentWidth, 1100);
    const letterWidth = screenW / textLength;
    const boost = 1 / 1100 * screenW * 2;
    const pixelUnitToFont = 5.8;
    let finalSize = (letterWidth * (3 - boost)) / pixelUnitToFont;
    const calculatedSize = Math.floor(finalSize);
    
    // Cache the font size on mobile
    if (isMobile && cachedMobileFontSizeRef.current === null) {
      cachedMobileFontSizeRef.current = calculatedSize;
    }
    
    return calculatedSize;
  }, [isMobileLayout]);

  return { getFontSize, isMobileLayout };
}

function aspectMultiplier() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!w || !h) return 0;

  const aspect = Math.min(w, h) / Math.max(w, h); // 1 at square, →0 as it gets wider/taller
  const scale = 1.344; // chosen so 1920×1000 → 0.7 and 1920×500 → 0.35
  return Math.min(1, scale * aspect);
}


// Hook for stable camera FOV calculation with mobile freeze
export function useStableCameraFOV() {
  const cachedMobileFOVRef = useRef<number | null>(null);

  const getCameraFOV = useCallback((screenWidth: number) => {
    const isMobile = screenWidth < MOBILE_BREAKPOINT;
    
    // On mobile, use cached value if available
    if (isMobile && cachedMobileFOVRef.current !== null) {
      return cachedMobileFOVRef.current;
    }

    const num = 75000;

    function scaleInverted(x = 0, a = 0, b = 1000) {
      if (a === b) throw new Error("a and b must differ");
      const t = (b - x) / (b - a);
      const res = Math.max(0, Math.min(1, t));
      return res;
    }

    let screenWCalc = screenWidth * aspectMultiplier() 


    const calcT = num / screenWCalc ** 1.001 - 30 * scaleInverted(screenWCalc, 200, 800) - 15 * scaleInverted(screenWCalc, 800, 1500)
    

    const offS = 10;
    function GetVal() {
      if (360 > screenWidth) {
        return calcT;
      } else if (390 > screenWidth) {
        return 125 - offS;
      } else if (410 > screenWidth) {
        return 123 - offS;
      } else if (430 > screenWidth) {
        return 121 - offS;
      } else if (450 > screenWidth) {
        return 119 - offS;
      } else if (470 > screenWidth) {
        return 117 - offS;
      } else if (490 > screenWidth) {
        return 114 - offS;
      } else if (510 > screenWidth) {
        return 111 - offS;
      } else if (530 > screenWidth) {
        return 109 - offS;
      } else if (550 > screenWidth) {
        return 107 - offS;
      } else if (570 > screenWidth) {
        return 105 - offS;
      } else if (590 > screenWidth) {
        return 103 - offS;
      } else if (610 > screenWidth) {
        return 101 - offS;
      } else if (630 > screenWidth) {
        return 99 - offS;
      } else if (650 > screenWidth) {
        return 98 - offS;
      } else if (670 > screenWidth) {
        return 97 - offS;
      } else if (690 > screenWidth) {
        return 96 - offS;
      } else if (710 > screenWidth) {
        return 94 - offS;
      } else if (730 > screenWidth) {
        return 92 - offS;
      } else if (750 > screenWidth) {
        return 93 - offS;
      } else if (770 > screenWidth) {
        return 95 - offS;
      } else if (790 > screenWidth) {
        return 94 - offS;
      } else if (810 > screenWidth) {
        return 93 - offS;
      }
      return calcT;
    }

    const calculatedFOV = Math.min(Math.max(GetVal(), 55), 130);
    
    // Cache the FOV on mobile
    if (isMobile && cachedMobileFOVRef.current === null) {
      cachedMobileFOVRef.current = calculatedFOV;
    }
    
    return calculatedFOV;
  }, []);

  return { getCameraFOV };
}

// const carouselAxisAngle = new Vector3(-0.5, -1, 0)
// const carouselAngle = -0.4

const carouselPoints = new Array(carouselCount).fill(undefined).map((_, i) => {
  const v = new Vector3();
  v.x =
    Math.sin(((carouselCount - 1 - i) / carouselCount) * Math.PI * 2) *
    carouselRadius;
  v.y = 15;
  v.z =
    Math.cos(((carouselCount - 1 - i) / carouselCount) * Math.PI * 2) *
    carouselRadius;
  // v.applyAxisAngle(carouselAxisAngle, carouselAngle)
  v.applyEuler(new THREE.Euler(0, 0.0, -0.1));
  // v.applyQuaternion( new THREE.Quaternion().setFromAxisAngle(new Vector3(0,0,1), Math.PI / 8))
  return v;
});

export const baseCurvePoints: Vector3[] = [
  new Vector3(-20, 10, -70),
  new Vector3(50, 30, -80),
  new Vector3(30, 30, -75),
  new Vector3(50, 30, -70),
  new Vector3(30, 30, -65),
  new Vector3(50, 30, -60),
  new Vector3(50, 10, -45),
  new Vector3(35, 4, -35),
  new Vector3(20, -10, -60),
  new Vector3(-10, 20, -30),
  new Vector3(10, 30, -22),
  new Vector3(0, 25, -11),
  // new Vector3(-30, 10, 20),
  ...carouselPoints,
  new Vector3(
    carouselPoints[0].x - 10,
    carouselPoints[0].y + 20,
    carouselPoints[0].z + 20,
  ),
  new Vector3(60, 35, -30),
  new Vector3(30, 20, -30),
  new Vector3(20, 10, -35),
  new Vector3(10, 15, -48),
  new Vector3(5, 15, -58),
  new Vector3(25, 10, -85),
  new Vector3(50, -16, -82),
];

export const yOffset = 5

export function useLinenTextures() {
  const col = useTexture(
    "https://flowing-canvas.vercel.app/linen/Plain_Grey_Texture_col.jpg",
  );
  const normal = useTexture(
    "https://flowing-canvas.vercel.app/linen/Plain_Grey_Texture_nrm.jpg",
  );

  for (const t of [col, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
  }
  col.colorSpace = THREE.SRGBColorSpace;

  return { col, normal };
}

export function getLandingTextData() {
  const el = document.querySelector(`[data-flow-default-text]`)
  if (el === null) {
    console.warn("No element with attribute data-flow-default-text set")
    return "fallback Text"
  }

  if (window.innerWidth < 500) {
return  (el.getAttribute("data-flow-default-text-m")?? "fallback Text").replaceAll("\\n", `
`)
  }

return  (el.getAttribute("data-flow-default-text")?? "fallback Text").replaceAll("\\n", `
`)
}

export function useCarouselImages() {
  const imageUrls = useMemo(() => {
    if (titlesList.length > 0) {
      return titlesList
    } else {
      console.log("FALLBACK IMAGES USED")
      return Array(carouselCount)
        .fill(undefined)
        .map(
          (_, i) =>
            ({img: `https://flowing-canvas.vercel.app/images/img${Math.floor(i % carouselCount) + 1}_.webp`, imageNum:i, texture:useTexture([`https://flowing-canvas.vercel.app/images/img${Math.floor(i % carouselCount) + 1}_.webp`])}),
        );
    }
  }, []);

  const imageShaderRefs = useRef<(IimageShaderMaterial | null)[]>([]);
  useMemo(() => {
    imageShaderRefs.current = Array(carouselCount).fill(null);
  }, []);

    const imageUrlsWithTexture = titlesList.map(e => ({...e,texture :useTexture([e.img]) }))

  return { imageUrls,imageUrlsWithTexture,  imageShaderRefs };
}

export function useCarouselTexts() {
  const [domReady, setDomReady] = useState(false);

  useEffect(() => {
    // Wait for DOM to be fully loaded
    if (document.readyState === "complete") {
      setDomReady(true);
    } else {
      const handleLoad = () => setDomReady(true);
      window.addEventListener("load", handleLoad);
      return () => window.removeEventListener("load", handleLoad);
    }
  }, []);

  const imageTexts = useMemo(() => {
    if (debug) console.log("useCarouselTexts - domReady:", domReady);
    if (debug) console.log("webflowTexts:",  titlesList);

    // If we have DOM texts, use them, otherwise fallback to titlesList
    if (titlesList.length > 1) {
      return titlesList;
    } else {
      if (debug) console.log("Using fallback titlesList");
      return titlesList;
    }
  }, [domReady]);

  return { imageTexts };
}

export function useMomentum() {
  const momentum = useRef(0);
  const wasAtCarousel = useRef(false);
  return { momentum, wasAtCarousel };
}

export function useFrenetDataTexture(
  curve: THREE.CatmullRomCurve3,
  cPoints: Vector3[],
  numPoints: number,
): THREE.DataTexture {
  return useMemo(() => {
    // compute Frenet frames once
    const { binormals, normals, tangents } = curve.computeFrenetFrames(
      numPoints,
      false,
    );

    // pack into a flat array
    const data: number[] = [];
    cPoints.forEach((v) => data.push(v.x, v.y, v.z));
    binormals.forEach((v) => data.push(v.x, v.y, v.z));
    normals.forEach((v) => data.push(v.x, v.y, v.z));
    tangents.forEach((v) => data.push(v.x, v.y, v.z));

    // build the DataTexture
    const tex = new THREE.DataTexture(
      new Float32Array(data),
      numPoints + 1,
      4,
      THREE.RGBFormat,
      THREE.FloatType,
    );
    tex.internalFormat = "RGB32F";
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }, [curve, cPoints, numPoints]);
}
