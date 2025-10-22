import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { AddFriendDialog } from "./AddFriendDialog";
import { NotificationsSheet } from "./NotificationsSheet";
import { MessagesSheet } from "./MessagesSheet";
import { cn } from "@/lib/utils";

export const TopNavBar = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Scrolling down
        setVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up
        setVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(profileData);
  };

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-transform duration-300",
        visible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="bg-[hsl(120,50%,20%)] px-4 py-3 flex items-center justify-between">
        {/* Left: Profile Picture */}
        <button
          onClick={() => navigate('/profile')}
          className="flex-shrink-0"
        >
          <Avatar className="h-10 w-10 border-2 border-white/20 hover:border-white/40 transition-colors">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="object-cover" />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground">
                {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() :
                 profile?.username ? profile.username.charAt(0).toUpperCase() : "?"}
              </AvatarFallback>
            )}
          </Avatar>
        </button>

        {/* Center: Title */}
        <h1 className="text-white font-bold text-xl flex-1 text-center">
          Gazz Golf
        </h1>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <AddFriendDialog />
          <NotificationsSheet />
          <MessagesSheet />
        </div>
      </div>
    </div>
  );
};
