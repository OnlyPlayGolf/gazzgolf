import { TopNavBar } from "@/components/TopNavBar";
import { DrillHistory } from "@/components/DrillHistory";

export default function ApproachControlFeed() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <DrillHistory drillTitle="Approach Control" />
      </div>
    </div>
  );
}
