import "./App.css";
import Scene from "./components/canvas/Scene";

function App() {
  return (
    <div className="flex w-screen h-screen items-center justify-center bg-[#d8d8d8] overflow-hidden ">
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "calc(100vw - 14px)",
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
