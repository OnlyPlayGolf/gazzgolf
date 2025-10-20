import { Home, Target, TrendingUp, User, Menu } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'drills', label: 'Drills', icon: Target, path: '/categories' },
  { id: 'levels', label: 'Levels', icon: TrendingUp, path: '/levels' },
  { id: 'groups', label: 'Groups', icon: User, path: '/profile' },
];

export const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide the tab bar on immersive round flows (tracking, summary, setup)
  const hideTabBar = location.pathname.startsWith('/rounds/') && location.pathname !== '/rounds';
  if (hideTabBar) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            location.pathname === tab.path ||
            (tab.path === '/levels' && location.pathname.startsWith('/levels'));
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[56px] text-[10px] font-medium transition-colors",
                isActive 
                  ? "text-primary bg-golf-light/20" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon 
                size={20} 
                className={cn(
                  "mb-0.5",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} 
              />
              <span className={cn(isActive ? "text-primary" : "text-muted-foreground")}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};