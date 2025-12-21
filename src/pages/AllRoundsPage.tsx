import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TopNavBar } from "@/components/TopNavBar";
import { RoundCard, RoundCardData } from "@/components/RoundCard";
import { loadUnifiedRounds } from "@/utils/unifiedRoundsLoader";

export default function AllRoundsPage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [rounds, setRounds] = useState<RoundCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string>("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    loadRounds();
  }, [userId]);

  const loadRounds = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      navigate('/auth');
      return;
    }

    setIsOwnProfile(!userId || userId === user?.id);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', targetUserId)
      .single();

    if (profileData) {
      setProfileName(profileData.display_name || profileData.username || 'User');
    }

    const unifiedRounds = await loadUnifiedRounds(targetUserId);
    setRounds(unifiedRounds);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      
      <div className="bg-card border-b border-border pt-16">
        <div className="p-4 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-3 -ml-2"
          >
            <ChevronLeft size={20} className="mr-1" />
            Back
          </Button>
          
          <h1 className="text-2xl font-bold">
            {isOwnProfile ? 'My Rounds' : `${profileName}'s Rounds`}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rounds.length} round{rounds.length !== 1 ? 's' : ''} played
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading rounds...
          </div>
        ) : rounds.length > 0 ? (
          <div className="space-y-3">
            {rounds.map((round) => (
              <RoundCard key={`${round.gameType || 'round'}-${round.id}`} round={round} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No rounds found
          </div>
        )}
      </div>
    </div>
  );
}
