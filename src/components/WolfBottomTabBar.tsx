import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Info, Users, Trophy, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface WolfBottomTabBarProps {
  gameId: string;
}

export function WolfBottomTabBar({ gameId }: WolfBottomTabBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const tabs = [
    { id: "play", label: "Enter Score", icon: FileText, path: `/wolf/${gameId}/play` },
    { id: "info", label: "Game Info", icon: Info, path: `/wolf/${gameId}/info` },
    { id: "feed", label: "Game Feed", icon: Users, path: `/wolf/${gameId}/feed` },
    { id: "leaderboard", label: "Leaderboards", icon: Trophy, path: `/wolf/${gameId}/leaderboard` },
    { id: "settings", label: "Settings", icon: Settings, path: `/wolf/${gameId}/settings` },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
        {tabs.map((tab) => {
          const isActive = currentPath === tab.path;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon size={20} />
              <span className="text-[10px] mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
