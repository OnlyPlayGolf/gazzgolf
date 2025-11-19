import { TopNavBar } from "@/components/TopNavBar";
import DrillLeaderboard from "@/components/DrillLeaderboard";

export default function DriverControlLeaderboard() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <DrillLeaderboard drillId="" drillName="Driver Control Drill" />
      </div>
    </div>
  );
}
