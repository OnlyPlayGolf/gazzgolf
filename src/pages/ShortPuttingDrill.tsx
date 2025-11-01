import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { migrateStorageKeys } from "@/utils/storageManager";
import ShortPuttingScore from "./ShortPuttingScore";
import ShortPuttingLeaderboard from "./ShortPuttingLeaderboard";
import ShortPuttingFeed from "./ShortPuttingFeed";
import ShortPuttingMessages from "./ShortPuttingMessages";
import ShortPuttingInfo from "./ShortPuttingInfo";

const ShortPuttingDrill = () => {
  const navigate = useNavigate();

  useEffect(() => {
    migrateStorageKeys();
  }, []);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/drills/putting')}
              className="rounded-full"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Short Putting Test</h1>
              <p className="text-sm text-muted-foreground">Pressure-packed accuracy drill</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        <div className="bg-primary text-primary-foreground py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">PRACTICE DRILL</div>
              <div className="text-sm opacity-90">PUTTING</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">4</div>
              <div className="text-xs opacity-90">Tee Positions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">4ft+</div>
              <div className="text-xs opacity-90">Starting</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Routes>
          <Route index element={<Navigate to="score" replace />} />
          <Route path="score" element={<ShortPuttingScore />} />
          <Route path="leaderboard" element={<ShortPuttingLeaderboard />} />
          <Route path="feed" element={<ShortPuttingFeed />} />
          <Route path="messages" element={<ShortPuttingMessages />} />
          <Route path="info" element={<ShortPuttingInfo />} />
        </Routes>
      </div>
      
      <DrillBottomTabBar drillSlug="short-putting-test" />
    </div>
  );
};

export default ShortPuttingDrill;
