import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import VisorPage from "@/pages/VisorPage";
import UnrealPage from "@/pages/UnrealPage";
import HallwayPage from "@/pages/HallwayPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<VisorPage />} />
        <Route path="/hallway" element={<HallwayPage />} />
        <Route path="/unreal" element={<UnrealPage />} />
      </Routes>
      <Toaster theme="dark" position="bottom-center" />
    </BrowserRouter>
  );
}

export default App;
