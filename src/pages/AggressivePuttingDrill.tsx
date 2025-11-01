import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { migrateStorageKeys } from "@/utils/storageManager";
import AggressivePuttingScore from "./AggressivePuttingScore";
import AggressivePuttingLeaderboard from "./AggressivePuttingLeaderboard";
import AggressivePuttingInfo from "./AggressivePuttingInfo";

const AggressivePuttingDrill = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    migrateStorageKeys();
  }, []);

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/drills/putting')}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Aggressive Putting</h1>
            <p className="text-muted-foreground">Reach 15 points as quickly as possible</p>
          </div>
        </div>

        <div className="space-y-6">
          <Routes>
            <Route index element={<Navigate to="score" replace />} />
            <Route path="score" element={<AggressivePuttingScore />} />
            <Route path="leaderboard" element={<AggressivePuttingLeaderboard />} />
            <Route path="info" element={<AggressivePuttingInfo />} />
          </Routes>
        </div>
      </div>
      
      <DrillBottomTabBar drillSlug="aggressive-putting" />
    </div>
  );
};

export default AggressivePuttingDrill;