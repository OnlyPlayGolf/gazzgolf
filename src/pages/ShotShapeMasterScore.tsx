import { TopNavBar } from "@/components/TopNavBar";
import ShotShapeMasterComponent from "@/components/drills/ShotShapeMasterComponent";

export default function ShotShapeMasterScore() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <ShotShapeMasterComponent />
      </div>
    </div>
  );
}
