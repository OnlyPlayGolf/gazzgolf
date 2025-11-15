import { TopNavBar } from "@/components/TopNavBar";
import ApproachControlComponent from "@/components/drills/ApproachControlComponent";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ApproachControlScore() {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
        <ApproachControlComponent />
      </div>
    </div>
  );
}
