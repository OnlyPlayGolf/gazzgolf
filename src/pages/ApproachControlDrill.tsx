import { Routes, Route, Navigate } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import ApproachControlScore from "./ApproachControlScore";
import ApproachControlInfo from "./ApproachControlInfo";
import ApproachControlFeed from "./ApproachControlFeed";
import ApproachControlLeaderboard from "./ApproachControlLeaderboard";
import ApproachControlMessages from "./ApproachControlMessages";

export default function ApproachControlDrill() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <Routes>
        <Route path="/" element={<Navigate to="score" replace />} />
        <Route path="score" element={<ApproachControlScore />} />
        <Route path="info" element={<ApproachControlInfo />} />
        <Route path="feed" element={<ApproachControlFeed />} />
        <Route path="leaderboard" element={<ApproachControlLeaderboard />} />
        <Route path="messages" element={<ApproachControlMessages />} />
      </Routes>
      <DrillBottomTabBar drillSlug="approach-control" />
    </div>
  );
}
