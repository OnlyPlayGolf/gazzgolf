import { Play } from "lucide-react";

export default function RoundsPlay() {
  return (
    <div className="min-h-screen pb-20 px-4 flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
      <div className="text-center space-y-6 max-w-md">
        {/* Golf Flag Design - Play button as flag, 'l' as pole */}
        <div className="flex flex-col items-center">
          {/* Flag (Play Button) */}
          <div className="w-20 h-20 rounded-lg bg-primary flex items-center justify-center shadow-lg relative z-10">
            <Play size={40} className="text-primary-foreground fill-current" />
          </div>
          
          {/* Flag Pole (the 'l' in Play) */}
          <div className="w-1 h-16 bg-primary -mt-2" />
          
          {/* Text with custom 'l' */}
          <div className="text-6xl font-bold text-foreground mt-2 flex items-end justify-center gap-1">
            <span>P</span>
            <span className="inline-block h-12 w-1 bg-transparent" />
            <span>ay</span>
          </div>
        </div>
        
        <h2 className="text-4xl font-bold text-foreground mt-8">Coming Soon</h2>
        
        <p className="text-lg text-muted-foreground">
          Track rounds, compete with friends, and explore new game formats.
        </p>
      </div>
    </div>
  );
}
