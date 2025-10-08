import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BottomTabBar } from "@/components/BottomTabBar";
import DrillsCategories from "./pages/DrillsCategories";
import CategoryDrills from "./pages/CategoryDrills";
import Drills from "./pages/Drills";
import DrillDetail from "./pages/DrillDetail";
import Auth from "./pages/Auth";
import LevelSelection from "./pages/LevelSelection";
import Levels from "./pages/Levels";
import Profile from "./pages/Profile";
import Menu from "./pages/Menu";
import NotFound from "./pages/NotFound";
import UserDrills from "./pages/UserDrills";
import CreateDrill from "./pages/CreateDrill";
import RunDrill from "./pages/RunDrill";
import DrillResults from "./pages/DrillResults";
import GroupDetail from "./pages/GroupDetail";
import AcceptInvite from "./pages/AcceptInvite";
import Rounds from "./pages/Rounds";
import RoundSetup from "./pages/RoundSetup";
import HoleTracker from "./pages/HoleTracker";
import RoundSummary from "./pages/RoundSummary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="relative">
          <Routes>
            <Route path="/" element={<DrillsCategories />} />
            <Route path="/categories" element={<DrillsCategories />} />
            <Route path="/drills" element={<DrillsCategories />} />
            <Route path="/drills/:categoryId" element={<CategoryDrills />} />
            <Route path="/drills/:drillId/detail" element={<DrillDetail />} />
            <Route path="/levels" element={<LevelSelection />} />
            <Route path="/levels/:difficulty" element={<Levels />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/user-drills" element={<UserDrills />} />
            <Route path="/create-drill" element={<CreateDrill />} />
            <Route path="/run-drill/:drillId" element={<RunDrill />} />
            <Route path="/drill-results/:drillId" element={<DrillResults />} />
            <Route path="/group/:groupId" element={<GroupDetail />} />
            <Route path="/invite/:code" element={<AcceptInvite />} />
            <Route path="/rounds" element={<Rounds />} />
            <Route path="/rounds/setup" element={<RoundSetup />} />
            <Route path="/rounds/:roundId/track" element={<HoleTracker />} />
            <Route path="/rounds/:roundId/summary" element={<RoundSummary />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomTabBar />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
