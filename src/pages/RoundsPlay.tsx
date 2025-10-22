import { Play } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";

export default function RoundsPlay() {
  return (
    <div className="min-h-screen pb-20 px-4 flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Play size={40} className="text-primary" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-foreground">Coming Soon</h1>
        
        <p className="text-lg text-muted-foreground">
          Track rounds, compete with friends, and explore new game formats.
        </p>
      </div>
    </div>
  );
}
