import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TopNavBar } from "@/components/TopNavBar";

interface Round {
  id: string;
  course_name: string;
  date_played: string;
  holes_played: number;
  score: number;
  totalScore: number;
  totalPar: number;
}

export default function FriendRounds() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const [rounds, setRounds] = useState<Round[]>([]);
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

    // Load all rounds
    const { data: roundsData } = await supabase
      .from('rounds')
      .select('id, course_name, date_played, holes_played')
      .eq('user_id', userId)
      .or('origin.is.null,origin.eq.tracker,origin.eq.play')
      .order('date_played', { ascending: false });

    if (roundsData && roundsData.length > 0) {
      const roundsWithScores = await Promise.all(
        roundsData.map(async (round) => {
          const { data: holesData } = await supabase
            .from('holes')
            .select('score, par')
            .eq('round_id', round.id);

          const totalScore = holesData?.reduce((sum, hole) => sum + hole.score, 0) || 0;
          const totalPar = holesData?.reduce((sum, hole) => sum + hole.par, 0) || 0;
          const scoreToPar = totalScore - totalPar;

          return {
            id: round.id,
            course_name: round.course_name || 'Unknown Course',
            date_played: round.date_played,
            holes_played: round.holes_played,
            score: scoreToPar,
            totalScore,
            totalPar
          };
        })
      );

      setRounds(roundsWithScores);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      <div className="px-4 py-6 pt-20">
        {/* Back button and title */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{displayName}'s Rounds</h1>
        </div>

        {rounds.length > 0 ? (
          <div className="space-y-3">
            {rounds.map((round) => (
              <Card key={round.id} className="bg-[hsl(120,30%,95%)] border-[hsl(120,30%,85%)]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {new Date(round.date_played).toLocaleDateString()}
                      </h3>
                      <p className="text-sm text-muted-foreground">{round.course_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {round.holes_played} holes • {round.totalScore} ({round.totalPar} par)
                      </p>
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                      {round.score > 0 ? '+' : ''}{round.score}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No rounds played yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
