import { ThreeEvent, useFrame } from "@react-three/fiber";
import { easing } from "maath";
import type { Ref } from "react";
import { forwardRef, MutableRefObject, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { BASE_SPEED, useMomentum } from "./constants";
import { ImageShaderMaterial, type IimageShaderMaterial } from "./Experience";
// import { Environment } from '@react-three/drei'

interface CarouselImageProps {
  position: [number, number, number];
  rotation: [number, number, number];
  index: number;
  carouselStart: number;
  carouselEmergence: number;
  carouselCount: number;
  progressRef: MutableRefObject<number>;
  timeRef: MutableRefObject<number>;
  imageTexture: THREE.Texture;
  shaderRef: Ref<IimageShaderMaterial>;
  hovered: MutableRefObject<boolean>;
  onClick?: () => void;
  pointerDown: MutableRefObject<boolean>;
  pointerUp: MutableRefObject<boolean>;
  momentum: MutableRefObject<number>;
  currentImage: MutableRefObject<number>;
  rotationDone: MutableRefObject<boolean>;
  frontImageCheck: MutableRefObject<boolean>;
  isAnimating: MutableRefObject<boolean>;
  carouselSpeed: MutableRefObject<number>;
}

export const CarouselImage = forwardRef<THREE.Mesh, CarouselImageProps>(
  (
    {
      position,
      rotation,
      index,
      carouselStart,
      carouselEmergence,
      carouselCount,
      progressRef,
      timeRef,
      imageTexture,
      hovered,
      onClick,
      pointerDown,
      pointerUp,
      currentImage,
      rotationDone,
      frontImageCheck,
      isAnimating,
      carouselSpeed,
      shaderRef,
    },
    ref,
  ) => {
    const meshRef = useRef<THREE.Mesh | null>(null);
    const localMatRef = useRef<IimageShaderMaterial | null>(null);
    const { wasAtCarousel } = useMomentum();
    const carouselRef = useRef<THREE.Group>(null);

    const onPointerOver = (e: ThreeEvent<PointerEvent>) => (
      e.stopPropagation(),
      (hovered.current = true)
    );
    const onPointerOut = (e: ThreeEvent<PointerEvent>) => (
      e.stopPropagation(),
      (hovered.current = false)
    );
    const onPointerLeave = (e: ThreeEvent<PointerEvent>) => (
      e.stopPropagation(),
      (hovered.current = false)
    );
    const onPointerDown = (e: ThreeEvent<PointerEvent>) => (
      e.stopPropagation(),
      (pointerDown.current = true),
      (pointerUp.current = false)
    );
    // const onPointerUp = (e: ThreeEvent<PointerEvent>) => {e.stopPropagation(), pointerDown.current = false, pointerUp.current = true}

    useLayoutEffect(() => {
      const m = localMatRef.current;
      if (!m) return;
      imageTexture.colorSpace = THREE.SRGBColorSpace;
      imageTexture.needsUpdate = true;
      m.uniforms.uImageTexture.value = imageTexture;
      isSelected.current = false;
    }, [imageTexture]);

    const start = carouselStart + (index * carouselEmergence) / carouselCount;
    const end =
      carouselStart + ((index + 1) * carouselEmergence) / carouselCount;
    const m = localMatRef.current;

    const originalLocalPosition = useRef(new THREE.Vector3(0));
    // const originalLocalScale = useRef(new THREE.Vector3())
    const isSelected = useRef(false);
    const targetWorldPosition = useRef(new THREE.Vector3(0, -9, -5)); // Static world position - moved closer to camera
    // const tempMatrix = useRef(new THREE.Matrix4())
    const tempVector = useRef(new THREE.Vector3());
    // const tempVectorScale = useRef(new THREE.Vector3())
    const originalWorldScale = new THREE.Vector3(1, 1, 1);
    // const targetWorldScale = new THREE.Vector3(1.15, 1.15, 1.15);

    const targetWorldScale = new THREE.Vector3(1.2, 1.15, 1.4); // Increased scale from 1.15
    // const basePosition = new THREE.Vector3(0,0,0)
    // const ribbonSheet = useCurrentSheet()

    // const imageProgressRef = useRef(0)

    // const imgProgress = ribbonSheet?.object('imageProgress',
    // 			{
    // 				x: types.number(0,
    // 					{
    // 						range: [-1, 1.5],
    // 						nudgeMultiplier: 0.0001
    // 					}
    // 				)
    // 			},
    // 			{ reconfigure: true }
    // 		)
    // 		imgProgress?.onValuesChange((value) => {
    // 			imageProgressRef.current = value.x
    // 		}
    // 		)

    const animationState = useRef<
      "idle" | "damping-up" | "damping-down" | "scaledUp"
    >("idle");

    useFrame((state) => {
      if (!m) return;

      const elapsed = state.clock.getElapsedTime();

      if (m.uniforms.uProgress.value === 0) {
        isAnimating.current = false;
      } else {
        isAnimating.current = true;
      }

      if (carouselRef.current && meshRef.current) {
        if (currentImage.current === index + 1) {
          if (!isSelected.current) {
            // Store original position when first selected
            // originalLocalPosition.current.copy(basePosition)
            isSelected.current = true;
            // Start animation sequence
            animationState.current = "damping-up";
            isAnimating.current = true;
          }

          // Get current world position
          carouselRef.current.getWorldPosition(tempVector.current);
          // carouselRef.current.getWorldScale(tempVectorScale.current)

          // Calculate the difference between current world pos and target
          const worldOffset = new THREE.Vector3();
          worldOffset.subVectors(
            targetWorldPosition.current,
            tempVector.current,
          );

          // Convert world offset to local offset
          const localOffset = worldOffset.clone();
          if (carouselRef.current.parent) {
            // Remove the parent's rotation from the offset
            const parentRotation = new THREE.Matrix4();
            parentRotation.extractRotation(
              carouselRef.current.parent.matrixWorld,
            );
            parentRotation.invert();
            localOffset.applyMatrix4(parentRotation);
          }
          if (rotationDone.current || frontImageCheck.current) {
            // Apply the offset to current position
            const newLocalPos = carouselRef.current.position
              .clone()
              .add(localOffset);
            carouselRef.current.position.lerp(newLocalPos, 0.01 * 3);
            carouselRef.current.scale.lerp(targetWorldScale, 0.01 * 3.5);
            // Handle animation sequence
            if (animationState.current === "damping-up") {
              easing.damp(
                m.uniforms.uProgress,
                "value",
                1,
                0.25,
                0.01,
                0.1,
                (t: number) => 1 - Math.pow(1 - t, 3),
              );

              // Check if we've reached close to 1
              if (m.uniforms.uProgress.value > 0.98) {
                // m.uniforms.uProgress.value = 1
                animationState.current = "damping-down";
              }
            } else if (animationState.current === "damping-down") {
              easing.damp(
                m.uniforms.uProgress,
                "value",
                0,
                0.1,
                0.01,
                0.4,
                (t: number) => t * t,
              );
              if (m.uniforms.uProgress.value < 0.1) {
                animationState.current = "scaledUp";
              }
              // if (m.uniforms.uProgress.value < 0.05){
              // 	m.uniforms.uProgress.value = 0
              // }
            }
          }
        } else {
          // Return to original position
          carouselRef.current.position.lerp(
            originalLocalPosition.current,
            0.01 * 3,
          );
          carouselRef.current.scale.lerp(originalWorldScale, 0.01 * 2);
          if (animationState.current === "scaledUp") {
            if (isSelected.current) {
              // Reset animation when deselected
              // animationState.current = 'damping-up'
              isAnimating.current = true;
              if (animationState.current === "scaledUp") {
                easing.damp(m.uniforms.uProgress, "value", 1, 0.13, 0.01);

                if (m.uniforms.uProgress.value > 0.98) {
                  // m.uniforms.uProgress.value = 1
                  animationState.current = "damping-down";
                }
              } else if (animationState.current === "damping-down") {
                easing.damp(m.uniforms.uProgress, "value", 0, 0.13, 0.01);
                if (m.uniforms.uProgress.value < 0.01) {
                  m.uniforms.uProgress.value = 0;
                  animationState.current = "idle";
                  isSelected.current = false;
                }
              }
            }
          } else {
            easing.damp(m.uniforms.uProgress, "value", 0, 0.13, 0.01);
            if (m.uniforms.uProgress.value < 0.01) {
              m.uniforms.uProgress.value = 0;
              animationState.current = "idle";
              isSelected.current = false;
            }
          }
        }
      }

      const p = progressRef.current;
      // total progress
      m.uniforms.uOffsetTotal.value = p;
      // this card’s slice

      const smooth = THREE.MathUtils.smootherstep(p, start, end);
      m.uniforms.uOffset.value = smooth;

      // time
      m.uniforms.uTime.value = timeRef.current;

      if (p >= 0.9) {
        m.uniforms.uTime.value = elapsed;

        if (currentImage.current === 0) {
          easing.damp(
            m.uniforms.uVelocity,
            "value",
            (Math.abs(carouselSpeed.current) - BASE_SPEED) * 0.28,
            0.6,
            0.01,
          );
        } else {
          easing.damp(m.uniforms.uVelocity, "value", 0, 0.1, 0.01);
        }
      }

      const isRibbonAtCarousel = progressRef.current >= carouselStart;
      wasAtCarousel.current = isRibbonAtCarousel;
    });

    return (
      <group ref={carouselRef}>
        <mesh
          ref={(instance) => {
            meshRef.current = instance as THREE.Mesh;
            if (typeof ref === "function") {
              ref(instance as THREE.Mesh);
            } else if (ref) {
              (ref as MutableRefObject<THREE.Mesh | null>).current =
                instance as THREE.Mesh;
            }
          }}
          position={position}
          rotation={rotation}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerLeave}
          // onPointerUp={onPointerUp}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <bentPlaneGeometry args={[0.95, 13.8, 8, 200, 100]} />
          <imageShaderMaterial
            ref={(instance) => {
              localMatRef.current = instance;
              if (typeof shaderRef === "function") shaderRef(instance);
              else if (shaderRef)
                (shaderRef as React.MutableRefObject<unknown>).current =
                  instance;
            }}
            key={ImageShaderMaterial.key}
            transparent
            toneMapped={false}
            side={THREE.DoubleSide}
            // shadowSide={THREE.FrontSide}
          />
          {/* <Environment preset='city' /> */}
        </mesh>
      </group>
    );
  },
);

CarouselImage.displayName = "CarouselImage";
