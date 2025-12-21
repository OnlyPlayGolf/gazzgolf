import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TopNavBar } from "@/components/TopNavBar";
import { RoundCard, RoundCardData } from "@/components/RoundCard";

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
    
    // Determine which user's rounds to load
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      navigate('/auth');
      return;
    }

    setIsOwnProfile(!userId || userId === user?.id);

    // Load profile name
    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', targetUserId)
      .single();

    if (profileData) {
      setProfileName(profileData.display_name || profileData.username || 'User');
    }

    // Get round IDs where user is a participant
    const { data: participantRounds } = await supabase
      .from('round_players')
      .select('round_id')
      .eq('user_id', targetUserId);
    
    const participantRoundIds = participantRounds?.map(rp => rp.round_id) || [];

    // Load all rounds (RLS handles access)
    const { data: roundsData, error } = await supabase
      .from('rounds')
      .select('id, course_name, round_name, date_played, origin, user_id')
      .order('date_played', { ascending: false });
    
    // Filter to only include rounds where user is owner OR participant, excluding pro_stats
    const filteredRounds = (roundsData || []).filter(round => {
      const isParticipant = round.user_id === targetUserId || participantRoundIds.includes(round.id);
      const isPlayRound = !round.origin || round.origin === 'tracker' || round.origin === 'play';
      return isParticipant && isPlayRound;
    });

    if (error) {
      console.error('Error loading rounds:', error);
      setLoading(false);
      return;
    }

    if (filteredRounds.length > 0) {
      // Get scores and player counts for each round
      const roundsWithDetails = await Promise.all(
        filteredRounds.map(async (round) => {
          const { data: holesData } = await supabase
            .from('holes')
            .select('score, par')
            .eq('round_id', round.id);

          const { count: playerCount } = await supabase
            .from('round_players')
            .select('*', { count: 'exact', head: true })
            .eq('round_id', round.id);

          const totalScore = holesData?.reduce((sum, hole) => sum + hole.score, 0) || 0;
          const totalPar = holesData?.reduce((sum, hole) => sum + hole.par, 0) || 0;
          const scoreToPar = totalScore - totalPar;

          return {
            id: round.id,
            course_name: round.course_name || 'Unknown Course',
            round_name: round.round_name,
            date: round.date_played,
            score: scoreToPar,
            playerCount: playerCount || 1,
            gameMode: 'Stroke Play'
          };
        })
      );

      setRounds(roundsWithDetails);
    }

    setLoading(false);
  };

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
          
          <h1 className="text-2xl font-bold">
            {isOwnProfile ? 'My Rounds' : `${profileName}'s Rounds`}
          </h1>
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
          <div className="space-y-3">
            {rounds.map((round) => (
              <RoundCard key={round.id} round={round} />
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
