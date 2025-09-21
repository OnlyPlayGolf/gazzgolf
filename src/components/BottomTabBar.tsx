import { Home, Target, TrendingUp, User, Menu } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'drills', label: 'Drills', icon: Target, path: '/drills' },
  { id: 'levels', label: 'Levels', icon: TrendingUp, path: '/levels' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
  { id: 'menu', label: 'Menu', icon: Menu, path: '/menu' },
];

export const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-3 px-2 min-h-[60px] text-xs font-medium transition-colors",
                isActive 
                  ? "text-primary bg-golf-light/20" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon 
                size={24} 
                className={cn(
                  "mb-1",
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