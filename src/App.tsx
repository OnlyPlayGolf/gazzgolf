import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BottomTabBar } from "@/components/BottomTabBar";
import Home from "./pages/Home";
import DrillsCategories from "./pages/DrillsCategories";
import PuttingDrills from "./pages/PuttingDrills";
import DrillDetail from "./pages/DrillDetail";
import AggressivePuttingDrill from "./pages/AggressivePuttingDrill";
import Levels from "./pages/Levels";
import Profile from "./pages/Profile";
import Menu from "./pages/Menu";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="relative">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/drills" element={<DrillsCategories />} />
            <Route path="/drills/putting" element={<PuttingDrills />} />
            <Route path="/drill/pga-tour-18" element={<DrillDetail />} />
            <Route path="/drill/aggressive-putting" element={<AggressivePuttingDrill />} />
            <Route path="/levels" element={<Levels />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomTabBar />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
