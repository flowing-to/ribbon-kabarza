import { useEffect, useState } from "react";
import "./App.css";
import Scene from "./components/canvas/Scene";

function App() {
  const [viewportWidth, setViewportWidth] = useState(
    document.documentElement.clientWidth
  );

  useEffect(() => {
    function handleResize() {
      setViewportWidth(document.documentElement.clientWidth);
    }
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
