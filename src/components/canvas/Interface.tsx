import { useCarouselStore } from "../../lib/store/useCarouselStore";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// const title = 'FLOWING'

export default function Interface() {
  const { carouselReady } = useCarouselStore();

  // for a physic like animation use this one

  // const spring = {
  // 	type: "spring",
  // 	damping: 16,
  // 	stiffness: 130
  // }

  // for a time based animation use this one
  // const spring = {
  // 	type: "spring",
  // 	duration: 0.4,
  // 	bounce: 0.1
  // }

  const ctaSpring = {
    type: "spring",
    duration: 1.2,
    bounce: 0.1,
  };
  const [textWidth, setTextWidth] = useState(0);
  const buttonTextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (buttonTextRef.current) {
      const width = buttonTextRef.current.getBoundingClientRect().width;
      setTextWidth(width);
      console.log(textWidth, "textWidth");
    }
  }, [setTextWidth, buttonTextRef, textWidth]);

  return (
    <div className="relative flex flex-col w-full h-full items-center justify-end  ">
      <AnimatePresence>
        {carouselReady && (
          <motion.div className=" flex flex-col w-full h-full justify-end gap-4 lg:gap-6 items-center  ">
            <motion.div
              initial={{
                y: 300,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              transition={{
                ...ctaSpring,
                // duration: 1,
                delay: 0,
              }}
              className=" flex w-[75%] lg:w-[32rem] h-14 items-center bg-black rounded-full py-2 px-2 z-50 "
            >
              <input
                type="text"
                placeholder="Enter your email"
                className=" w-full h-full rounded-full bg-transparent text-white px-4 placeholder:text-slate-300/40 focus:border-none focus:ring-0 focus:outline-none"
              />
              <button className="relative uppercase bg-white text-nowrap text-base font-medium w-[7rem] h-full rounded-full overflow-hidden">
                <motion.span
                  ref={buttonTextRef}
                  initial={{ x: 0 }}
                  animate={{ x: -159.58 }}
                  transition={{
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: 3.5,
                    ease: "linear",
                  }}
                  className=" flex text-black "
                >
                  join our waitlist join our waitlist
                </motion.span>
              </button>
            </motion.div>
            <motion.p
              initial={{
                y: 300,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              transition={{
                ...ctaSpring,
                delay: 0.1,
              }}
              className="flex w-[80%] lg:w-[32rem] min-h-44 lg:min-h-20 text-base lg:text-lg text-center z-50"
            >
              We’ve been making high end websites for our clients and here,We
              share every tool, trick & component with you ...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
