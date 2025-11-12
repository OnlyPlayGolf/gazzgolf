import { Routes, Route, Navigate } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import ShotShapeMasterScore from "./ShotShapeMasterScore";
import ShotShapeMasterInfo from "./ShotShapeMasterInfo";
import ShotShapeMasterFeed from "./ShotShapeMasterFeed";
import ShotShapeMasterLeaderboard from "./ShotShapeMasterLeaderboard";
import ShotShapeMasterMessages from "./ShotShapeMasterMessages";

export default function ShotShapeMasterDrill() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <Routes>
        <Route path="/" element={<Navigate to="score" replace />} />
        <Route path="score" element={<ShotShapeMasterScore />} />
        <Route path="info" element={<ShotShapeMasterInfo />} />
        <Route path="feed" element={<ShotShapeMasterFeed />} />
        <Route path="leaderboard" element={<ShotShapeMasterLeaderboard />} />
        <Route path="messages" element={<ShotShapeMasterMessages />} />
      </Routes>
      <DrillBottomTabBar drillSlug="shot-shape-master" />
    </div>
  );
}
