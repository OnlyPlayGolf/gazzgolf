import { TopNavBar } from "@/components/TopNavBar";
import ApproachControlComponent from "@/components/drills/ApproachControlComponent";

export default function ApproachControlScore() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <ApproachControlComponent />
      </div>
    </div>
  );
}
