import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TopNavBar } from "@/components/TopNavBar";
import { RoundCard, RoundCardData } from "@/components/RoundCard";
import { loadUnifiedRounds } from "@/utils/unifiedRoundsLoader";

export default function FriendRounds() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const [rounds, setRounds] = useState<RoundCardData[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRounds();
  }, [userId]);

  const loadRounds = async () => {
    if (!userId) return;

    setLoading(true);

    // Get current user to check friendship
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    // Check if they are friends
    const { data: friendship } = await supabase
      .from('friendships')
      .select('status')
      .or(`and(requester.eq.${user.id},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${user.id})`)
      .eq('status', 'accepted')
      .single();

    if (!friendship) {
      toast({
        title: "Access denied",
        description: "You can only view rounds of friends",
        variant: "destructive"
      });
      navigate(-1);
      return;
    }

    // Get profile name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', userId)
      .single();

    if (profile) {
      setDisplayName(profile.display_name || profile.username || 'User');
    }

    // Load all rounds using unified loader (includes all game types)
    const unifiedRounds = await loadUnifiedRounds(userId);
    setRounds(unifiedRounds);

    setLoading(false);
  };

  // Group rounds by year
  const roundsByYear = useMemo(() => {
    const grouped: Record<string, RoundCardData[]> = {};
    
    rounds.forEach(round => {
      const year = new Date(round.date).getFullYear().toString();
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(round);
    });

    // Sort years descending
    return Object.entries(grouped)
      .sort(([a], [b]) => parseInt(b) - parseInt(a));
  }, [rounds]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      
      {/* Header */}
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
          
          <h1 className="text-2xl font-bold">{displayName}'s Rounds</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rounds.length} round{rounds.length !== 1 ? 's' : ''} played
          </p>
        </div>
      </div>

      {/* Rounds List */}
      <div className="max-w-2xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading rounds...
          </div>
        ) : rounds.length > 0 ? (
          <div className="space-y-6">
            {roundsByYear.map(([year, yearRounds]) => (
              <div key={year}>
                <h2 className="text-lg font-semibold text-foreground mb-3 sticky top-16 bg-background py-2 z-10">
                  {year}
                </h2>
                <div className="space-y-3">
                  {yearRounds.map((round) => (
                    <RoundCard key={`${round.gameType || 'round'}-${round.id}`} round={round} />
                  ))}
                </div>
              </div>
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
