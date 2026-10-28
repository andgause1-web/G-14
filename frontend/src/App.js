import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import VisorPage from "@/pages/VisorPage";
import UnrealPage from "@/pages/UnrealPage";
import HallwayPage from "@/pages/HallwayPage";
import BaselinePage from "@/pages/BaselinePage";
import RulesPage from "@/pages/RulesPage";
import { RulesProvider } from "@/lib/rules";

function App() {
  return (
    <RulesProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<VisorPage />} />
        <Route path="/hallway" element={<HallwayPage />} />
        <Route path="/baseline" element={<BaselinePage />} />
        <Route path="/unreal" element={<UnrealPage />} />
        <Route path="/rules" element={<RulesPage />} />
      </Routes>
      <Toaster theme="dark" position="bottom-center" />
    </BrowserRouter>
    </RulesProvider>
  );
}

export default App;
