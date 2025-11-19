import { Routes, Route, Navigate } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import DriverControlScore from "./DriverControlScore";
import DriverControlInfo from "./DriverControlInfo";
import DriverControlFeed from "./DriverControlFeed";
import DriverControlLeaderboard from "./DriverControlLeaderboard";
import DriverControlMessages from "./DriverControlMessages";

export default function DriverControlDrill() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <Routes>
        <Route path="/" element={<Navigate to="score" replace />} />
        <Route path="score" element={<DriverControlScore />} />
        <Route path="info" element={<DriverControlInfo />} />
        <Route path="feed" element={<DriverControlFeed />} />
        <Route path="leaderboard" element={<DriverControlLeaderboard />} />
        <Route path="messages" element={<DriverControlMessages />} />
      </Routes>
      <DrillBottomTabBar drillSlug="driver-control" />
    </div>
  );
}
