import { useEffect, useState, useRef } from "react";
import "./App.css";
import Scene from "./components/canvas/Scene";

const MOBILE_BREAKPOINT = 768;

function App() {
  const [viewportWidth, setViewportWidth] = useState(
    document.documentElement.clientWidth
  );
  const frozenWidthRef = useRef<number | null>(null);

  useEffect(() => {
    function handleResize() {
      const currentWidth = document.documentElement.clientWidth;
      const isMobile = currentWidth < MOBILE_BREAKPOINT;
      
      if (isMobile) {
        // On mobile, freeze the width after first measurement
        if (frozenWidthRef.current === null) {
          frozenWidthRef.current = currentWidth;
          setViewportWidth(currentWidth);
        }
        // Don't update viewport width on mobile resize
      } else {
        // On desktop, allow responsive behavior
        setViewportWidth(currentWidth);
        frozenWidthRef.current = null; // Reset when switching to desktop
      }
    }
    
    // Initial call to set up the correct width
    handleResize();
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{ width: viewportWidth }}
      className="flex h-screen items-center justify-center bg-[#d8d8d8] overflow-hidden"
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: viewportWidth,
          height: "100vh",
          pointerEvents: "none",
        }}
      >
        <Scene />
      </div>
    </div>
  );
}

export default App;
