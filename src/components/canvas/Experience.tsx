"use client";

import { shaderMaterial } from "@react-three/drei";
import { Object3DNode, ThreeEvent, useFrame } from "@react-three/fiber";
import { editable as e, PerspectiveCamera } from "@theatre/r3f";
import { useIsClient } from "@uidotdev/usehooks";
import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
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
import { extend } from "@react-three/fiber";
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
  yOffset,
} from "./constants";
import TitleText from "./TitleText";

extendBentPlane();

const RibbonShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(0.2, 0.0, 0.1),
    uSpatialTexture: new THREE.DataTexture(),
    uTextureSize: new THREE.Vector2(0, 0),
    uLengthRatio: 0, // more or less real lenght along the path
    uObjSize: new Vector3(0), // lenght
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
    ribbonShaderMaterial: Object3DNode<
      IRibbonShaderMaterial,
      typeof RibbonShaderMaterial
    >;
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
    imageShaderMaterial: Object3DNode<
      IimageShaderMaterial,
      typeof ImageShaderMaterial
    >;
  }
}

const SphereShaderMaterial = shaderMaterial(
  {
    // uTime: 0,
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
    sphereShaderMaterial: Object3DNode<
      ISphereShaderMaterial,
      typeof SphereShaderMaterial
    >;
  }
}

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

  const text = useMemo(() => getLandingTextData(), [])

  const lookAtTarget = new THREE.Vector3(0, 0, 0);
  const cameraLookAtRef = useRef<THREE.Mesh>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [ribbonMat, setRibbonMat] = useState<IRibbonShaderMaterial | null>(
    null
  );
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
  const { imageTextures, imageShaderRefs } = useCarouselImages();
  const { momentum, wasAtCarousel } = useMomentum();

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([...baseCurvePoints], false, "chordal", 0.5),
    []
  );

  // derive the progress thresholds…
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
    // compute size
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const box = new THREE.Box3().setFromBufferAttribute(posAttr);
    const size = new THREE.Vector3();
    box.getSize(size);
    // assign every uniform once
    ribbonMat.uSpatialTexture = tex;
    ribbonMat.uTextureSize = new THREE.Vector2(numPoints + 1, 4);
    ribbonMat.uLengthRatio = size.z / curve.getLength();
    ribbonMat.uObjSize = size;
    ribbonMat.uFabricTexture = col;
    ribbonMat.uFabricTextureNormal = normal;
    // mark update if you want
    ribbonMat.needsUpdate = true;
  }, [ribbonMat, tex, curve, col, normal]);

  const initialEuler = new THREE.Euler(0, 0, -0.1);

  const clicked = useRef(false);
  const targetQuaternion = useRef<THREE.Quaternion | null>(null);
  const axis = new THREE.Vector3(-0.1, -1, -0.0).normalize();
  const anglePer = (2 * Math.PI) / carouselCount;
  const baseQ = new THREE.Quaternion().setFromEuler(initialEuler);
  // const currentAngle = useRef(0)

  // const incrementQuaternion = new THREE.Quaternion()
  const targetQuaternionContinuous = useRef(
    new THREE.Quaternion().setFromEuler(initialEuler)
  );

  const handleCarouselClick = (idx: number) => {
    if (!checkClick.current) return;
    dragMomentum.current = 0;
    // hovered.current = true
    // if(currentImage.current !== idx + 1){
    // 	rotationDone.current = false
    // }
    // angle so that slice #idx lands at front (angle=0)
    // the front image at inital position is image #6 ( 6-1 = 5)
    const targetAngle = anglePer * (5 - idx) + Math.PI / 36;
    const targetQ = new THREE.Quaternion()
      .setFromAxisAngle(axis, targetAngle)
      .multiply(baseQ);
    // check if selected image is not at the front position
    if (
      carouselRef.current &&
      carouselRef.current.quaternion.angleTo(targetQ) > 0.1
    ) {
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
      // find out the direction of the swipe
      if (pointerDown.current && !clicked.current) {
        pointerUp.current = true;
        const momentumDir = pointerVelocity.current > 0 ? -1 : 1;
        // Set momentum based on last pointer velocity
        momentum.current =
          momentumDir *
          MathUtils.clamp(Math.abs(pointerVelocity.current) * 2, 0.3, 10);
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
    if (debug) console.log('Click outside detected, currentImage:', currentImage.current);
    
    // Reset to FLOWING text when clicking outside the carousel
    if (currentImage.current !== 0) {
      if (typeof window !== 'undefined') {
        window.offFlowingClick?.forEach(e => e(lastClickedImage.current));
      }
      currentImage.current = 0;
      if (debug) console.log('Reset to FLOWING');
    }
  };

  // const velocityQuanternion = new THREE.Quaternion()
  const tempVelocityQuanternion = new THREE.Quaternion();
  const rotatingCarouselQuanternion = new THREE.Quaternion();
  const defaultMomentum = useRef(0);
  const dragMomentum = useRef(0);
  const firstPointerDown = useRef(false);
  // const targetEuler = useRef(new THREE.Euler(0, 0, -0.1))
  const setIsCarouselReady = useCarouselStore(
    (state) => state.setIsCarouselReady
  );

  const dxLerp = useRef(0);
  const prevDx = useRef(0);

  // Handle all updates in useFrame
  useFrame((state, delta) => {
    // let currentDampedOffset = ribbonMat ? ribbonMat.uOffset : -0.5 // Get current or initial
    const isRibbonAtCarousel = progressRef.current >= carouselStartPoint;

    if (planeRef.current) {
      if (progressRef.current >= 0.9) {
        
        if (planeRef.current) {
          setIsCarouselReady(true);
        };
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

    const ribbonEndThreshold = 0.9
    if (progressRef.current >= ribbonEndThreshold && ribbonEndFired.current == false && progressRef.current !== 1.5) {
      ribbonEndFired.current = true;
      if (typeof window !== 'undefined') {
        window.onFlowingRibbonEnd?.forEach(e => e());
      }
    }

    if (cameraRef.current && cameraLookAtRef.current) {
      cameraRef.current.position.y = -yOffset/2.8
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
    // When ribbon reaches the carousel, add momentum
    if (!wasAtCarousel.current) {
      momentum.current += MOMENTUM_BOOST;
      defaultMomentum.current = momentum.current;
    }
    wasAtCarousel.current = isRibbonAtCarousel;

    if (carouselRef.current) {
      if (!isRibbonAtCarousel) {
        carouselRef.current.quaternion.setFromEuler(initialEuler);
      } else {
        // if the momentum is getting from the grabbing function the decay should be more powerfull
        // momentum.current *= pointerVelocity.current === 0 ? MOMENTUM_DECAY : (MOMENTUM_DECAY - 0.02)
        // const defaultMomentum = MathUtils.lerp(momentum.current, 0, delta * 3 )

        easing.damp(defaultMomentum, "current", 0, 2.1, 0.01);

        // const dragMomentum = MathUtils.lerp(momentum.current, 0, delta * 3  )
        // dragMomentum.current = momentum.current
        easing.damp(dragMomentum, "current", 0, 1.2, 0.01);

        momentum.current =
          pointerVelocity.current === 0
            ? defaultMomentum.current
            : dragMomentum.current;

        momentum.current =
          momentum.current > 0
            ? Math.max(0, MathUtils.clamp(momentum.current, 0.0, 28))
            : Math.min(0, MathUtils.clamp(momentum.current, -28, 0.0));

        carouselSpeed.current = BASE_SPEED + momentum.current;

        if (
          hovered.current &&
          !clicked.current &&
          carouselSpeed.current < BASE_SPEED + 2
        ) {
          carouselSpeed.current = MathUtils.damp(
            carouselSpeed.current,
            0,
            70,
            delta
          );
          // easing.damp(carouselSpeed, 'current', -1, 0.1, 0.01, 0.02)
          // easing.dampQ(carouselRef.current.quaternion, targetQuaternionContinuous.current, 0.01, 0.01)
        }
        if (targetQuaternion.current) {
          clicked.current = true;
          // carouselRef.current.quaternion.rotateTowards(
          // 	targetQuaternion.current,
          // 	carouselSpeed.current * 10 * delta
          // )
          // carouselRef.current.quaternion.slerpQuaternions(carouselRef.current.quaternion, targetQuaternion.current, delta * 3)
          easing.dampQ(
            carouselRef.current.quaternion,
            targetQuaternion.current
          );

          if (
            carouselRef.current.quaternion.angleTo(targetQuaternion.current) <
            0.2
          ) {
            rotationDone.current = true;
            clicked.current = false;
          } else {
            rotationDone.current = false;
          }

          // once “close enough”, clear it and resume auto‑spin
          if (
            carouselRef.current.quaternion.angleTo(targetQuaternion.current) <
            0.001
          ) {
            targetQuaternionContinuous.current = targetQuaternion.current;
            targetQuaternion.current = null;
          }
          return;
        } else {
          // const clampedDelta = Math.min(delta, 1 / 30)
          if (
            !pointerDown.current &&
            !pointerUp.current &&
            currentImage.current === 0
          ) {
            // Create incremental rotation
            rotatingCarouselQuanternion.setFromAxisAngle(
              axis,
              carouselSpeed.current * delta
            );

            // Apply to target quaternion
            targetQuaternionContinuous.current.multiplyQuaternions(
              rotatingCarouselQuanternion,
              targetQuaternionContinuous.current
            );

            // Smooth interpolation
            easing.dampQ(
              carouselRef.current.quaternion,
              targetQuaternionContinuous.current,
              0.1,
              0.01
            );
            // lastPointerX.current = state.pointer.x
          } else if (
            pointerDown.current &&
            !pointerUp.current &&
            !clicked.current &&
            currentImage.current === 0
          ) {
            if (!firstPointerDown.current) {
              lastPointerX.current = state.pointer.x;
              firstPointerDown.current = true;
            } else {
              // Calculate velocity
              const now = performance.now();
              const dx = state.pointer.x - lastPointerX.current;

              if (Math.abs(dx) > 0.1) {
                checkClick.current = false;
              } else {
                checkClick.current = true;
              }
              const dt = (now - lastPointerTime.current) / 5000; // seconds
              // const dt = delta

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

              tempVelocityQuanternion.setFromAxisAngle(
                axis,
                -dxLerp.current * 1.2
              );
              // console.log('dx', dxLerp.current)
              targetQuaternionContinuous.current.multiplyQuaternions(
                tempVelocityQuanternion,
                targetQuaternionContinuous.current
              );

              easing.dampQ(
                carouselRef.current.quaternion,
                targetQuaternionContinuous.current,
                0.1,
                0.01
              );
            }
            if (pointerDown.current && !clicked.current) {
              // Set momentum based on last pointer velocity

              dragMomentum.current = -pointerVelocity.current;
              // console.log('velocity', -pointerVelocity.current)
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
          // if (currentImage.current === 0) {
          // carouselRef.current.quaternion.multiplyQuaternions(
          // 	incrementQuaternion,
          // 	carouselRef.current.quaternion
          // )
          // easing.dampQ(carouselRef.current.quaternion, incrementQuaternion)
          // carouselRef.current.quaternion.slerpQuaternions(carouselRef.current.quaternion, rotatingCarouselQuanternion, delta )
          // }
        }
      }
    }
  });

  if (!isClient) return null;

  const num = 75000

   const scale = (x: number): number =>



    Math.max(0, Math.min(1, 1 - x / 1000));

   function scaleInverted(x = 0, a = 0, b = 1000) {
  if (a === b) throw new Error("a and b must differ");
  const t = (b - x) / (b - a);        // 1 at x=a, 0 at x=b
  const res = Math.max(0, Math.min(1, t))
  console.log({res})
  return res
}

  // const calc = num / screenWidth ** 1.001 + 10 * scaleInverted(screenWidth,1000,200)
  const calcT = (num / screenWidth ** 1.001) - 30 * scaleInverted(screenWidth,200,800)

  console.log(calcT, Math.min(Math.max(calcT, 55), 130))

  //I hate that kabarza forced me to do this. It's the result of his existance.
  function GetVal() {
    if (360 > screenWidth ) {
    return calcT
    } else if (390 > screenWidth) {
      return 125
    } else if (410 > screenWidth) {
      return 123
    } else if (430 > screenWidth) {
      return 121
    } else if (450 > screenWidth) {
      return 119
    } else if (470 > screenWidth) {
      return 117
    } else if (490 > screenWidth) {
      return 114
    } else if (510 > screenWidth) {
      return 111
    }else if (530 > screenWidth) {
      return 109
    }else if (550 > screenWidth) {
      return 107
    }else if (570 > screenWidth) {
      return 105
    }else if (590 > screenWidth) {
      return 103
    }else if (610 > screenWidth) {
      return 101
    }else if (630 > screenWidth) {
      return 99
    }else if (650 > screenWidth) {
      return 98
    }else if (670 > screenWidth) {
      return 97
    }else if (690 > screenWidth) {
      return 96
    }else if (710 > screenWidth) {
      return 94
    }else if (730 > screenWidth) {
      return 92
    }else if (750 > screenWidth) {
      return 93
    }else if (770 > screenWidth) {
      return 95
    }else if (790 > screenWidth) {
      return 94
    }else if (810 > screenWidth) {
      return 93
    }
    return calcT

  }

  // console.log("final", Math.min(Math.max(GetVal(), 55), 130))

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        theatreKey="Camera"
        makeDefault
        // fov={Math.min(Math.max(75000 / screenWidth, 70), 115)}
        // fov={Math.min(Math.max(75000 / screenWidth ** 1.001, 55), 108)}
        // fov={Math.min(Math.max(75000 / screenWidth ** 1.001, 55), 130)}
        fov={Math.min(Math.max(GetVal(), 55), 130)}
        position={[0, 2, 10]}
        near={0.001}
        far={55000}
      />

      <e.mesh
        theatreKey="lookAt"
        ref={cameraLookAtRef}
        position={lookAtTarget}
        visible={false}
      >
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshBasicMaterial color="hotpink" />
      </e.mesh>

      {/* <mesh>
				<sphereGeometry args={[500, 200, 200]} />
				<sphereShaderMaterial key={SphereShaderMaterial.key} side={THREE.BackSide} />
			</mesh> */}

      <mesh position={[0, 0, 70]} onClick={(e) => clickObserver(e)}>
        <planeGeometry args={[3000, 3000, 1, 1]} />
        <meshBasicMaterial
          color={"transparent"}
          side={THREE.DoubleSide}
          transparent
          opacity={0}
          alphaTest={0.001}
        />
      </mesh>

      {/* ribbon */}
      <mesh ref={planeRef} frustumCulled={false}>
        <boxGeometry
          args={[8, 180, 0.4, 10, 1000]}
          onUpdate={(geo) => {
            // runs once on mount (and again on HMR)
            geo.rotateX(-Math.PI / 2);
            geo.translate(0, 0, 90);
            // ensure the positions get re‑uploaded
            geo.attributes.position.needsUpdate = true;
          }}
        />
        <ribbonShaderMaterial
          ref={setRibbonMat}
          key={RibbonShaderMaterial.key}
          side={THREE.DoubleSide}
          blending={THREE.NormalBlending}
          transparent
        />
      </mesh>

      {/* <CatmullRomLine
				points={cPoints}
				closed={false}
				curveType="centripetal"
				tension={0.9}
				color="white"
				lineWidth={2}
				dashed={false}
			/> */}

      {/* carousel  */}
      <group ref={carouselRef} rotation={initialEuler}>
        {new Array(carouselCount).fill(undefined).map((_, i) => {
          return (
          <CarouselImage
            key={i}
            position={[
              Math.sin(
                ((carouselCount - 1 - i) / carouselCount) * Math.PI * 2
              ) * carouselRadius,
              // 15,
              15 - yOffset,
              Math.cos(
                ((carouselCount - 1 - i) / carouselCount) * Math.PI * 2
              ) * carouselRadius,
            ]}
            rotation={[
              0,
              2 * Math.PI +
                ((carouselCount - 1 - i) / carouselCount) * Math.PI * 2,
              0,
            ]}
            index={i}
            carouselStart={carouselStartPoint}
            carouselEmergence={carouselEmergingLength}
            carouselCount={carouselCount}
            progressRef={progressRef}
            timeRef={timeRef}
            imageTexture={imageTextures[i]}
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
        )})}
      </group>

      <TitleText
        timeRef={timeRef}
        currentImage={currentImage}
        isMobile={isMobile}
        screenWidth={screenWidth}
        text={text}
      />

      {/* <OrbitControls /> */}
      {/* <GizmoHelper
				alignment="bottom-right" // widget alignment within scene
				margin={[80, 80]} // widget margins (X, Y)
			>
				<GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="black" />
			</GizmoHelper> */}
    </>
  );
}
