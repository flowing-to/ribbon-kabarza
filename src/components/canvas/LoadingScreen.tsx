import { useProgress } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

type LoadingProps = {
  started: boolean;
  onStarted: () => void;
};

export default function LoadingScreen({ started, onStarted }: LoadingProps) {
  const { progress, total } = useProgress();
  const [readyToStart, setReadyToStart] = useState(false);

  // Add a delay to ensure textures are loaded even after progress reaches 100%
  useEffect(() => {
    if (progress === 100) {
      // Wait additional time to ensure textures are fully processed
      const timer = setTimeout(() => {
        setReadyToStart(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [progress]);

  // console.log('Loading:', { item, active, total, progress: Math.round(progress) })

  return (
    <AnimatePresence mode="wait">
      {!started && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, delay: 1 }}
          className={`loadingScreen flex-col w-screen h-screen bg-[#09090C] pt-40 md:pt-[220px] `}
        >
          <div className={`loadingScreen__logo `}></div>
          <div className="relative top-auto lg:-top-20 flex flex-col w-full justify-center items-center">
            <span
              className={`font-teko text-neutral-200 text-lg  ${total === 63 ? " opacity-0 transition-opacity duration-300" : ""}`}
            >
              {Math.floor((total * 100) / 65)}%
            </span>
            <button
              className="loadingScreen__button text-3xl font-teko hover:shadow-white hover:drop-shadow-lg hover:text-white/60 hover:blur-[1px]"
              disabled={!readyToStart}
              onClick={onStarted}
            >
              {readyToStart ? "Start the experience" : "Processing assets..."}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
