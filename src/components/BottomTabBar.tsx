import { Home, Target, Users, Play, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'practice', label: 'Practice', icon: Target, path: '/practice' },
  { id: 'play', label: 'Play', icon: Play, path: '/rounds-play' },
  { id: 'groups', label: 'Groups', icon: Users, path: '/groups' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
];

export const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide the tab bar on immersive round flows (tracking, summary, setup), drill game modes, umbriago, and wolf
  const hideTabBar = (
    (location.pathname.startsWith('/rounds/') && location.pathname !== '/rounds') ||
    location.pathname.startsWith('/drill/') ||
    location.pathname.startsWith('/umbriago/') ||
    location.pathname.startsWith('/wolf/')
  );
  if (hideTabBar) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            location.pathname === tab.path ||
            (tab.path === '/practice' && (location.pathname.startsWith('/drills') || location.pathname.startsWith('/levels') || location.pathname === '/categories'));
          
          // Special styling for Play tab
          if (tab.id === 'play') {
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className="flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[56px] transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-green-500 flex flex-col items-center justify-center">
                  <Icon size={20} className="text-white mb-0.5" />
                  <span className="text-[10px] font-medium text-white">{tab.label}</span>
                </div>
              </button>
            );
          }
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[56px] text-[10px] font-medium transition-colors",
                isActive 
                  ? "text-green-500" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon 
                size={20} 
                className={cn(
                  "mb-0.5",
                  isActive ? "text-green-500" : "text-muted-foreground"
                )} 
              />
              <span className={cn(isActive ? "text-green-500" : "text-muted-foreground")}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};