import { shaderMaterial, Text } from "@react-three/drei";
import { extend, Object3DNode, useFrame } from "@react-three/fiber";
import { types } from "@theatre/core";
import { editable as e, useCurrentSheet } from "@theatre/r3f";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Vector3 } from "three";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import textVertex from "../../glsl/text/textVertex.glsl";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import textFragment from "../../glsl/text/textFragment.glsl";
import { easing } from "maath";
import { useCarouselTexts } from "./constants";

export const TextShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(0.2, 0.0, 0.1),
    uProgress1: 0,
    uProgress2: 0,
    uProgress3: 0,
    uResolution: new Vector3(1, 1, 1),
  },
  textVertex,
  textFragment
);
extend({ TextShaderMaterial });

export interface ITextShaderMaterial extends THREE.ShaderMaterial {
  uTime: number;
  uColor: THREE.Color;
  uProgress1: number;
  uProgress2: number;
  uProgress3: number;
  uResolution: Vector3;
}

declare module "@react-three/fiber" {
  interface ThreeElements {
    textShaderMaterial: Object3DNode<
      ITextShaderMaterial,
      typeof TextShaderMaterial
    >;
  }
}

// const titlesList = [
// 	{ imageNum: 0, title: 'FLOWING' },
// 	{ imageNum: 1, title: 'NEWYORK' },
// 	{ imageNum: 2, title: 'FURNITURE' },
// 	{ imageNum: 3, title: 'CS AGENCY' },
// 	{ imageNum: 4, title: 'ATELIER' },
// 	{ imageNum: 5, title: 'ANCHOR' },
// 	{ imageNum: 6, title: 'EXHITBITON' },
// 	{ imageNum: 7, title: 'ART & TECH' },
// 	{ imageNum: 8, title: 'ORCHARD' },
// 	{ imageNum: 9, title: 'EXHITBITON' },
// 	{ imageNum: 10, title: 'PEAK' },
// 	{ imageNum: 11, title: 'SOUL' },
// 	{ imageNum: 12, title: 'OTHER MONTHS' },
// ]

type TitleTextProps = {
  timeRef: MutableRefObject<number>;
  currentImage: MutableRefObject<number>;
  isMobile: boolean;
  screenWidth: number;
};

export default function TitleText({ currentImage, isMobile }: TitleTextProps) {
  const textGroupRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);

  const textMatRef = useRef<ITextShaderMaterial>(null);
  const textProgress1Ref = useRef(0);
  const textProgress2Ref = useRef(0);
  const textProgress3Ref = useRef(0);

  const textRef = useRef(null);
  const selectedImage = useRef(0);
  const ribbonSheet = useCurrentSheet();
  const transferTop = useRef(false);
  const animationStart = useRef(false);
  // const onAnimationImage = useRef(0)

  const [imageIndex, setImageIndex] = useState(0);

  const { imageTexts } = useCarouselTexts();
  // console.log(imageTexts)

  const animationState = useRef<
    "idle" | "first-chunk" | "text-change" | "second-chunk"
  >("idle");

  function getFontSize(textLength: number) {
    const letterWidth = (window.innerWidth * 0.8) / textLength;
    
    //average
    const pixelUnitToFont = 7.5;
    
    const finalSize = Math.min(
      Math.max(Math.floor(letterWidth / pixelUnitToFont), 10),
      30
    );
    console.log(finalSize, Math.floor(letterWidth / pixelUnitToFont));
    
    console.log({finalSize})
    return Math.floor(finalSize);
  }

  // Update font size on resize
  useEffect(() => {
    const handleResize = () => {
      const currentText = imageTexts.find(
        (item) => item.imageNum === imageIndex
      )?.title;
      if (currentText && textRef.current) {
        const newFontSize = getFontSize(currentText.length);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        textRef.current.fontSize = newFontSize;
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imageTexts, imageIndex]);

  useEffect(() => {
    const imageText = imageTexts.find(
      (item) => item.imageNum === imageIndex
    )?.title;
    // if (animationState.current !== 'idle') return // Prevent multiple animations
    if (!imageText || !ribbonSheet) return;
    // if(state === 'normal'){
    // Start the animation sequence
    animationState.current = "first-chunk";

    // First chunk: animate from (6 + 22/30) to (7 + 23/30)
    // ribbonSheet.sequence.position = 6 + 22 / 30

    // Use Theatre.js's built-in animation
    ribbonSheet.sequence
      .play({
        range: [6 + 22 / 30, 7 + 23 / 30],
        rate: 1.5,
      })
      .then(() => {
        // Change text after first chunk completes
        if (textRef.current) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          textRef.current.text = imageText;


          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          textRef.current.fontSize = getFontSize(imageText.length);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          // textRef.current.anchorY =
          //   transferTop.current && isMobile ? "bottom-baseline" : "middle";
          textRef.current.anchorY = "middle";
        }
        animationState.current = "text-change";

        // Small delay to let text change be visible
        setTimeout(() => {
          // animationState.current = 'idle'
          selectedImage.current = imageIndex;
          // Second chunk: animate from (7 + 23/30) to (9 + 8/30)
          ribbonSheet.sequence
            .play({
              range: [7 + 23 / 30, 9 + 8 / 30],
              rate: 1,
            })
            .then(() => {
              animationStart.current = false;
              animationState.current = "idle";
              // 	// animationState.current = 'second-chunk'
              // 	// selectedImage.current = imageIndex
            });
        }, 30); // Small delay for text visibility
      });
    // } else {
    // 	if (textRef.current) {
    // 		textRef.current.text = isMobile ? imageTextMobile : imageText
    // 		const fontSizeDesktop = imageText.length > 10 ? 32 : 40
    // 		const fontSizeMobile = currentImage.current === 0 ? 24 : imageText.length > 9 ? 18 : 20
    // 		textRef.current.fontSize = isMobile ? fontSizeMobile : fontSizeDesktop
    // 		textRef.current.anchorY = (transferTop.current && isMobile) ? 'bottom-baseline' : 'middle'
    // 	}
    // 	animationState.current = 'text-change'

    // 	ribbonSheet.sequence.position = 7 + 23 / 30
    // 	// Small delay to let text change be visible
    // 	setTimeout(() => {
    // 		animationState.current = 'idle'
    // 		selectedImage.current = imageIndex
    // 		// Second chunk: animate from (7 + 23/30) to (9 + 8/30)
    // 		ribbonSheet.sequence.play({
    // 			range: [7 + 23 / 30, 9 + 8 / 30],
    // 			rate: 1,
    // 		})
    // 		.then(() => {
    // 			animationStart.current = false
    // 		// 	// animationState.current = 'second-chunk'
    // 		// 	// selectedImage.current = imageIndex
    // 		})
    // 	}, 30) // Small delay for text visibility
    // }
  }, [ribbonSheet, imageIndex]);

  const txtProgress1 = ribbonSheet?.object(
    "txtProgress1",
    {
      x: types.number(0, {
        range: [-1, 1.5],
        nudgeMultiplier: 0.0001,
      }),
    },
    { reconfigure: true }
  );
  txtProgress1?.onValuesChange((value) => {
    textProgress1Ref.current = value.x;
  });

  const txtProgress2 = ribbonSheet?.object(
    "txtProgress2",
    {
      x: types.number(0, {
        range: [-1, 1.5],
        nudgeMultiplier: 0.0001,
      }),
    },
    { reconfigure: true }
  );
  txtProgress2?.onValuesChange((value) => {
    textProgress2Ref.current = value.x;
  });

  const txtProgress3 = ribbonSheet?.object(
    "txtProgress3",
    {
      x: types.number(0, {
        range: [-1, 1.5],
        nudgeMultiplier: 0.0001,
      }),
    },
    { reconfigure: true }
  );
  txtProgress3?.onValuesChange((value) => {
    textProgress3Ref.current = value.x;
  });

  useFrame((state) => {
    if (!textGroupRef.current || !textMatRef.current || !groupRef.current)
      return;

    textMatRef.current.uResolution.set(state.size.width, state.size.height, 1);

    // if(currentImage.current === 0){
    textMatRef.current.uProgress1 = textProgress1Ref.current;
    textMatRef.current.uProgress2 = textProgress2Ref.current;
    textMatRef.current.uProgress3 = textProgress3Ref.current;
    // } else {
    if (selectedImage.current !== currentImage.current && ribbonSheet) {
      // if(!animationStart.current){
      // 	onAnimationImage.current = currentImage.current
      // 	animationStart.current = true
      // }
      // handleImageClick(currentImage.current)
      // if(currentImage.current === onAnimationImage.current){

      // handleImageClick(currentImage.current, 'normal')
      setImageIndex(currentImage.current);

      // 	console.log('normal')
      // } else {
      // 	handleImageClick(currentImage.current, 'intrupted')
      // 	console.log('intruptted')
      // }
      // console.log('onAnimationImage', onAnimationImage.current)
      // console.log('animationStart',animationStart.current)
    }
    // }
    if (!isMobile) {
      groupRef.current.position.x = -3;
    } else {
      groupRef.current.position.x = 1;
      if (transferTop.current) {
        easing.damp(groupRef.current.position, "y", -12);
      } else {
        easing.damp(groupRef.current.position, "y", 0);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <e.group theatreKey="title group" ref={textGroupRef}>
        <e.group theatreKey="titleText">
          <Text
            ref={textRef}
            font={
              isMobile
                ? "https://flowing-canvas.vercel.app/fonts/Manrope-Bold.ttf"
                : "https://flowing-canvas.vercel.app/fonts/Manrope-SemiBold.ttf"
            }
            fontSize={getFontSize("FLOWING".length)}
            anchorX="center"
            anchorY="middle"
            fontWeight={800}
            textAlign={"center"}
            lineHeight={0.9}
            strokeWidth={0}
            strokeOpacity={0}
            outlineOpacity={0}
            outlineWidth={0}
            sdfGlyphSize={256}
          >
            {"FLOWING"}
            <textShaderMaterial
              key={TextShaderMaterial.key}
              ref={textMatRef}
              side={THREE.DoubleSide}
            />
          </Text>
        </e.group>
      </e.group>
    </group>
  );
}
