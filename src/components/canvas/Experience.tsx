"use client";

import { shaderMaterial } from "@react-three/drei";
import { Object3DNode, ThreeEvent, useFrame, useThree, extend } from "@react-three/fiber";
import { editable as e, PerspectiveCamera } from "@theatre/r3f";
import { useIsClient } from "@uidotdev/usehooks";
import {
  MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
} from "react";
import type { ComponentProps } from "react";
import * as THREE from "three";
import { Vector3 } from "three";
import { debug } from "../../config";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import ribbonVertex from "../../glsl/ribbon/ribbonVertex.glsl";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import ribbonFragment from "../../glsl/ribbon/ribbonFragment.glsl";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import imageVertex from "../../glsl/image/imageVertex.glsl";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import imageFragment from "../../glsl/image/imageFragment.glsl";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import vertex from "../../glsl/shading/vertex.glsl";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import fragment from "../../glsl/shading/fragment.glsl";
import { useCarouselStore } from "../../lib/store/useCarouselStore";
import { easing } from "maath";
import { MathUtils } from "three";
import { extendBentPlane } from "./BentPlaneGeometry";
import { CarouselImage } from "./CarouselImage";
import {
  BASE_SPEED,
  baseCurvePoints,
  carouselCount,
  carouselRadius,
  getLandingTextData,
  MOMENTUM_BOOST,
  numPoints,
  progressLength,
  useCarouselImages,
  useFrenetDataTexture,
  useLinenTextures,
  useMomentum,
  useStableCameraFOV,
  yOffset,
} from "./constants";
import TitleText from "./TitleText";
import { registerMotionSource } from "../../../dev/motion-trace";

extendBentPlane();

/** ---------- Camera with constant horizontal FOV ---------- */
type TheatrePerspectiveProps = ComponentProps<typeof PerspectiveCamera>;
type ConstantHFovCameraProps = Omit<TheatrePerspectiveProps, "fov"> & {
  /** Optional baseline vertical FOV (deg) used only at mount to compute constant hFOV */
  fov?: number;
  /** Optional explicit baseline horizontal FOV (deg). If provided, overrides `fov` baseline. */
  hfov?: number;
};

/**
 * Keeps horizontal field-of-view constant, regardless of canvas height or any external writes to `camera.fov`.
 * This makes the camera effectively independent of vertical FOV animations or prop changes.
 */
const ConstantHFovCamera = forwardRef<THREE.PerspectiveCamera, ConstantHFovCameraProps>(
  function ConstantHFovCamera({ hfov, fov = 50, ...rest }, ref) {
    const { size } = useThree();
    const cam = useRef<THREE.PerspectiveCamera>(null!);
    useImperativeHandle(ref, () => cam.current);

    const hFovRad = useRef<number | null>(null);

    // Initialize baseline horizontal FOV once on mount
    useLayoutEffect(() => {
      const aspect0 = (size.width || 1) / (1000);
      if (hfov != null) {
        hFovRad.current = THREE.MathUtils.degToRad(hfov);
      } else {
        const v0 = THREE.MathUtils.degToRad(fov);
        hFovRad.current = 2 * Math.atan(Math.tan(v0 / 2) * aspect0);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Force vertical FOV derived from constant horizontal FOV every frame
    useFrame(() => {
      if (!cam.current || hFovRad.current == null) return;
      const aspect = (size.width || 1) / (size.height || 1);
      const v = 2 * Math.atan(Math.tan(hFovRad.current / 2) / aspect);
      const vDeg = THREE.MathUtils.radToDeg(v);
      if (Math.abs(cam.current.fov - vDeg) > 1e-3 || cam.current.aspect !== aspect) {
        cam.current.fov = vDeg;
        cam.current.aspect = aspect;
        cam.current.updateProjectionMatrix();
      }
    });

    // Do NOT pass fov to the underlying theatre camera; we control it above.
    return <PerspectiveCamera ref={cam} {...rest} />;
  }
);

/** ---------- Shader materials ---------- */
const RibbonShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(0.2, 0.0, 0.1),
    uSpatialTexture: new THREE.DataTexture(),
    uTextureSize: new THREE.Vector2(0, 0),
    uLengthRatio: 0,
    uObjSize: new Vector3(0),
    uOffset: -0.5,
    uTwistAmt: 0.1,
    uLightDirection: new Vector3(-0.5, 0.2, 0.5),
    uFabricTexture: null,
    uFabricTextureNormal: null,
    uFabricAO: null,
    uFabricRoughness: null,
  },
  ribbonVertex,
  ribbonFragment
);
extend({ RibbonShaderMaterial });

interface IRibbonShaderMaterial extends THREE.ShaderMaterial {
  uTime: number;
  uColor: THREE.Color;
  uSpatialTexture: THREE.DataTexture;
  uTextureSize: THREE.Vector2;
  uLengthRatio: number;
  uObjSize: Vector3;
  uOffset: number;
  uTwistAmt: number;
  uLightDirection: Vector3;
  uFabricTexture: THREE.Texture;
  uFabricTextureNormal: THREE.Texture;
  uFabricAO: THREE.Texture;
  uFabricRoughness: THREE.Texture;
}

declare module "@react-three/fiber" {
  interface ThreeElements {
    ribbonShaderMaterial: Object3DNode<IRibbonShaderMaterial, typeof RibbonShaderMaterial>;
  }
}

export const ImageShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uImageTexture: null,
    uLengthRatio: 0,
    uObjSize: new Vector3(0),
    uOffset: -0.5,
    uOffsetTotal: 0.0,
    uResolution: new THREE.Vector2(0, 0),
    uVelocity: 0,
    uProgress: 0,
  },
  imageVertex,
  imageFragment
);
extend({ ImageShaderMaterial });

export interface IimageShaderMaterial extends THREE.ShaderMaterial {
  uTime: number;
  uLengthRatio: number;
  uObjSize: Vector3;
  uOffset: number;
  uOffsetTotal: number;
  uImageTexture: THREE.Texture;
  uResolution: THREE.Vector2;
  uVelocity: number;
  uProgress: number;
}

declare module "@react-three/fiber" {
  interface ThreeElements {
    imageShaderMaterial: Object3DNode<IimageShaderMaterial, typeof ImageShaderMaterial>;
  }
}

const SphereShaderMaterial = shaderMaterial(
  {
    uColor: new THREE.Color("#d8d8d8"),
  },
  vertex,
  fragment
);
extend({ SphereShaderMaterial });

interface ISphereShaderMaterial extends THREE.ShaderMaterial {
  uTime: number;
  uColor: THREE.Color;
}

declare module "@react-three/fiber" {
  interface ThreeElements {
    sphereShaderMaterial: Object3DNode<ISphereShaderMaterial, typeof SphereShaderMaterial>;
  }
}

/** ---------- Experience ---------- */
type ExperienceProps = {
  progressRef: MutableRefObject<number>;
  timeRef: MutableRefObject<number>;
  isMobile: boolean;
  screenWidth: number;
};

export default function Experience({
  progressRef,
  timeRef,
  isMobile,
  screenWidth,
}: ExperienceProps) {
  const isClient = useIsClient();

  const text = useMemo(() => getLandingTextData(), []);

  const lookAtTarget = new THREE.Vector3(0, 0, 0);
  const cameraLookAtRef = useRef<THREE.Mesh>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [ribbonMat, setRibbonMat] = useState<IRibbonShaderMaterial | null>(null);
  const planeRef = useRef<THREE.Mesh>(null);
  const carouselRef = useRef<THREE.Group>(null);
  const setCurrentText = useCarouselStore((state) => state.setCurrentText);
  const carouselSpeed = useRef(1);
  const hovered = useRef(false);
  const pointerDown = useRef(false);
  const pointerUp = useRef(false);
  const lastPointerX = useRef(0);
  const lastPointerTime = useRef(performance.now());
  const pointerVelocity = useRef(0);
  const checkClick = useRef(true);
  const currentImage = useRef(0);
  const rotationDone = useRef(true);
  const frontImageCheck = useRef(false);
  const isAnimating = useRef(false);
  const ribbonEndFired = useRef(false);
  const lastClickedImage = useRef(0);

  const { col, normal } = useLinenTextures();
  const { imageUrlsWithTexture, imageShaderRefs } = useCarouselImages();
  const { momentum, wasAtCarousel } = useMomentum();
  const { getCameraFOV } = useStableCameraFOV();

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([...baseCurvePoints], false, "chordal", 0.5),
    []
  );

  const curveSegments = curve.points.length * 10;
  const totalLen = curve.getLength() * progressLength;
  const startLen = curve.getLengths(curveSegments)[10 * 13] * progressLength;
  const endLen = curve.getLengths(curveSegments)[10 * 25] * progressLength;
  const carouselStartPoint = startLen / totalLen - 0.01;
  const carouselEmergingLength = endLen / totalLen - carouselStartPoint;
  const cPoints = curve.getSpacedPoints(numPoints);
  const tex = useFrenetDataTexture(curve, cPoints, numPoints);

  useEffect(() => {
    if (!ribbonMat || !planeRef.current) return;

    const geo = planeRef.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const box = new THREE.Box3().setFromBufferAttribute(posAttr);
    const size = new THREE.Vector3();
    box.getSize(size);

    ribbonMat.uSpatialTexture = tex;
    ribbonMat.uTextureSize = new THREE.Vector2(numPoints + 1, 4);
    ribbonMat.uLengthRatio = size.z / curve.getLength();
    ribbonMat.uObjSize = size;
    ribbonMat.uFabricTexture = col;
    ribbonMat.uFabricTextureNormal = normal;
    ribbonMat.needsUpdate = true;
  }, [ribbonMat, tex, curve, col, normal]);

  const initialEuler = new THREE.Euler(0, 0, -0.1);

  const clicked = useRef(false);
  const targetQuaternion = useRef<THREE.Quaternion | null>(null);
  const axis = new THREE.Vector3(-0.1, -1, -0.0).normalize();
  const anglePer = (2 * Math.PI) / carouselCount;
  const baseQ = new THREE.Quaternion().setFromEuler(initialEuler);
  const targetQuaternionContinuous = useRef(new THREE.Quaternion().setFromEuler(initialEuler));

  const handleCarouselClick = (idx: number) => {
    if (!checkClick.current) return;
    dragMomentum.current = 0;

    const targetAngle = anglePer * (5 - idx) + Math.PI / 36;
    const targetQ = new THREE.Quaternion().setFromAxisAngle(axis, targetAngle).multiply(baseQ);

    if (carouselRef.current && carouselRef.current.quaternion.angleTo(targetQ) > 0.1) {
      if (rotationDone.current) {
        targetQuaternion.current = targetQ;
        currentImage.current = idx + 1;
        lastClickedImage.current = idx + 1;
      }
      frontImageCheck.current = false;
    } else {
      frontImageCheck.current = true;
      currentImage.current = idx + 1;
      lastClickedImage.current = idx + 1;
    }
  };

  useEffect(() => {
    const handlePointerUp = () => {
      if (pointerDown.current && !clicked.current) {
        pointerUp.current = true;
        const momentumDir = pointerVelocity.current > 0 ? -1 : 1;
        momentum.current = momentumDir * MathUtils.clamp(Math.abs(pointerVelocity.current) * 2, 0.3, 10);
        pointerDown.current = false;
      }
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointerout", handlePointerUp);
    window.addEventListener("pointerleave", handlePointerUp);

    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointerout", handlePointerUp);
      window.removeEventListener("pointerleave", handlePointerUp);
    };
  });

  const clickObserver = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!pointerUp.current) dragMomentum.current = 0;
    if (debug) console.log("Click outside detected, currentImage:", currentImage.current);

    if (currentImage.current !== 0) {
      if (typeof window !== "undefined") {
        window.offFlowingClick?.forEach((e) => e(lastClickedImage.current));
      }
      currentImage.current = 0;
      if (debug) console.log("Reset to FLOWING");
    }
  };

  const tempVelocityQuanternion = new THREE.Quaternion();
  const rotatingCarouselQuanternion = new THREE.Quaternion();
  const defaultMomentum = useRef(0);
  const dragMomentum = useRef(0);
  const firstPointerDown = useRef(false);
  const setIsCarouselReady = useCarouselStore((state) => state.setIsCarouselReady);

  const dxLerp = useRef(0);
  const prevDx = useRef(0);
  const frameDelta = useRef(0);

  useEffect(() => registerMotionSource('carousel', () => ({
    dt: frameDelta.current,
    progress: progressRef.current, time: timeRef.current,
    quaternion: carouselRef.current?.quaternion.toArray(),
    targetQuaternion: targetQuaternion.current?.toArray(),
    continuousQuaternion: targetQuaternionContinuous.current.toArray(),
    camera: cameraRef.current && { position: cameraRef.current.position.toArray(), quaternion: cameraRef.current.quaternion.toArray(), fov: cameraRef.current.fov, aspect: cameraRef.current.aspect },
    momentum: momentum.current, defaultMomentum: defaultMomentum.current, dragMomentum: dragMomentum.current,
    pointerVelocity: pointerVelocity.current, dxLerp: dxLerp.current,
    speed: carouselSpeed.current, hovered: hovered.current, pointerDown: pointerDown.current,
    selected: currentImage.current, rotationDone: rotationDone.current, clicked: clicked.current,
  })), []);

  useFrame((state, delta) => {
    frameDelta.current = delta;
    const isRibbonAtCarousel = progressRef.current >= carouselStartPoint;

    if (planeRef.current) {
      if (progressRef.current >= 0.9) {
        if (planeRef.current) {
          setIsCarouselReady(true);
        }
        planeRef.current.visible = false;
      } else {
        planeRef.current.visible = true;
      }
    }

    if (progressRef.current > 0.86) {
      setCurrentText(1);
    } else {
      setCurrentText(0);
    }

    const ribbonEndThreshold = 0.9;
    if (progressRef.current >= ribbonEndThreshold && ribbonEndFired.current == false && progressRef.current !== 1.5) {
      ribbonEndFired.current = true;
      if (typeof window !== "undefined") {
        window.onFlowingRibbonEnd?.forEach((e) => e());
      }
    }

    if (cameraRef.current && cameraLookAtRef.current) {
      cameraRef.current.position.y = -yOffset / 2.9;
      cameraRef.current.lookAt(cameraLookAtRef.current.position);
    }

    if (ribbonMat) {
      ribbonMat.uTime = timeRef.current;
      ribbonMat.uOffset = progressRef.current;

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ribbonProgress", {
            detail: {
              progress: progressRef.current,
              isAtCarousel: progressRef.current >= carouselStartPoint,
            },
          })
        );
      }
    }

    if (!wasAtCarousel.current) {
      momentum.current += MOMENTUM_BOOST;
      defaultMomentum.current = momentum.current;
    }
    wasAtCarousel.current = isRibbonAtCarousel;

    if (carouselRef.current) {
      if (!isRibbonAtCarousel) {
        carouselRef.current.quaternion.setFromEuler(initialEuler);
      } else {
        easing.damp(defaultMomentum, "current", 0, 2.1, 0.01);
        easing.damp(dragMomentum, "current", 0, 1.2, 0.01);

        momentum.current = pointerVelocity.current === 0 ? defaultMomentum.current : dragMomentum.current;
        momentum.current =
          momentum.current > 0
            ? Math.max(0, MathUtils.clamp(momentum.current, 0.0, 28))
            : Math.min(0, MathUtils.clamp(momentum.current, -28, 0.0));

        carouselSpeed.current = BASE_SPEED + momentum.current;

        if (hovered.current && !clicked.current && carouselSpeed.current < BASE_SPEED + 2) {
          carouselSpeed.current = MathUtils.damp(carouselSpeed.current, 0, 70, delta);
        }
        if (targetQuaternion.current) {
          clicked.current = true;

          easing.dampQ(carouselRef.current.quaternion, targetQuaternion.current);

          if (carouselRef.current.quaternion.angleTo(targetQuaternion.current) < 0.2) {
            rotationDone.current = true;
            clicked.current = false;
          } else {
            rotationDone.current = false;
          }

          if (carouselRef.current.quaternion.angleTo(targetQuaternion.current) < 0.001) {
            targetQuaternionContinuous.current = targetQuaternion.current;
            targetQuaternion.current = null;
          }
          return;
        } else {
          if (!pointerDown.current && !pointerUp.current && currentImage.current === 0) {
            rotatingCarouselQuanternion.setFromAxisAngle(axis, carouselSpeed.current * delta);

            targetQuaternionContinuous.current.multiplyQuaternions(
              rotatingCarouselQuanternion,
              targetQuaternionContinuous.current
            );

            easing.dampQ(carouselRef.current.quaternion, targetQuaternionContinuous.current, 0.1, 0.01);
          } else if (pointerDown.current && !pointerUp.current && !clicked.current && currentImage.current === 0) {
            if (!firstPointerDown.current) {
              lastPointerX.current = state.pointer.x;
              firstPointerDown.current = true;
            } else {
              const now = performance.now();
              const dx = state.pointer.x - lastPointerX.current;

              if (Math.abs(dx) > 0.1) {
                checkClick.current = false;
              } else {
                checkClick.current = true;
              }
              const dt = (now - lastPointerTime.current) / 5000;

              if (Math.abs(prevDx.current) >= Math.abs(dx)) {
                easing.damp(dxLerp, "current", dx, 1.5, 0.01);
                prevDx.current = dx;
              } else {
                dxLerp.current = dx;
                prevDx.current = dx;
              }

              if (dt > 0) {
                pointerVelocity.current = dxLerp.current / dt;
              }
              lastPointerX.current = state.pointer.x;
              lastPointerTime.current = now;

              tempVelocityQuanternion.setFromAxisAngle(axis, -dxLerp.current * 1.2);
              targetQuaternionContinuous.current.multiplyQuaternions(
                tempVelocityQuanternion,
                targetQuaternionContinuous.current
              );

              easing.dampQ(carouselRef.current.quaternion, targetQuaternionContinuous.current, 0.1, 0.01);
            }
            if (pointerDown.current && !clicked.current) {
              dragMomentum.current = -pointerVelocity.current;
              dragMomentum.current =
                dragMomentum.current > 0
                  ? Math.max(0, MathUtils.clamp(dragMomentum.current, 0.0, 4))
                  : Math.min(0, MathUtils.clamp(dragMomentum.current, -4, 0.0));
            }
          } else if (!pointerDown.current && pointerUp.current) {
            firstPointerDown.current = false;
            easing.damp(dxLerp, "current", 0, 0.05, 0.01);
            pointerUp.current = false;
          }
        }
      }
    }
  });

  if (!isClient) return null;

  // Use stable camera FOV that freezes on mobile
  const cameraFOV = getCameraFOV(screenWidth);

  return (
    <>
      {/* Camera: constant horizontal FOV, independent of vertical fov changes */}
      <ConstantHFovCamera
        ref={cameraRef}
        theatreKey="Camera"
        makeDefault
        // Use stable FOV that freezes on mobile to prevent flickering
        fov={cameraFOV}
        // fov={100}
        position={[0, 2, 10]}
        near={0.001}
        far={55000}
      />

      <e.mesh theatreKey="lookAt" ref={cameraLookAtRef} position={lookAtTarget} visible={false}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshBasicMaterial color="hotpink" />
      </e.mesh>

      <mesh position={[0, 0, 70]} onClick={(e) => clickObserver(e)}>
        <planeGeometry args={[3000, 3000, 1, 1]} />
        <meshBasicMaterial color={"#000000"} side={THREE.DoubleSide} transparent opacity={0} alphaTest={0.001} />
      </mesh>

      {/* ribbon */}
      <mesh ref={planeRef} frustumCulled={false}>
        <boxGeometry
          args={[8, 180, 0.4, 10, 1000]}
          onUpdate={(geo) => {
            geo.rotateX(-Math.PI / 2);
            geo.translate(0, 0, 90);
            geo.attributes.position.needsUpdate = true;
          }}
        />
        <ribbonShaderMaterial ref={setRibbonMat} key={RibbonShaderMaterial.key} side={THREE.DoubleSide} blending={THREE.NormalBlending} transparent />
      </mesh>

      {/* carousel */}
      <group ref={carouselRef} rotation={initialEuler}>
        {new Array(carouselCount).fill(undefined).map((_, i) => {
          return (
            <CarouselImage
              key={i}
              position={[
                Math.sin(((carouselCount - 1 - i) / carouselCount) * Math.PI * 2) * carouselRadius,
                15 - yOffset,
                Math.cos(((carouselCount - 1 - i) / carouselCount) * Math.PI * 2) * carouselRadius,
              ]}
              rotation={[0, 2 * Math.PI + ((carouselCount - 1 - i) / carouselCount) * Math.PI * 2, 0]}
              index={i}
              carouselStart={carouselStartPoint}
              carouselEmergence={carouselEmergingLength}
              carouselCount={carouselCount}
              progressRef={progressRef}
              timeRef={timeRef}
              imageTexture={imageUrlsWithTexture[i].texture[0]}
              shaderRef={(el) => {
                imageShaderRefs.current[i] = el;
              }}
              hovered={hovered}
              onClick={() => handleCarouselClick(i)}
              pointerDown={pointerDown}
              pointerUp={pointerUp}
              momentum={momentum}
              currentImage={currentImage}
              rotationDone={rotationDone}
              frontImageCheck={frontImageCheck}
              isAnimating={isAnimating}
              carouselSpeed={carouselSpeed}
            />
          );
        })}
      </group>

      <TitleText timeRef={timeRef} currentImage={currentImage} isMobile={isMobile} screenWidth={screenWidth} text={text} />
    </>
  );
}
