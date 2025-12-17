import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RoundCard, RoundCardData } from "./RoundCard";

interface ProfileRoundsSectionProps {
  rounds: RoundCardData[];
  totalCount: number;
  userId: string;
  isOwnProfile: boolean;
  isFriend: boolean;
  displayName?: string;
}

export function ProfileRoundsSection({
  rounds,
  totalCount,
  userId,
  isOwnProfile,
  isFriend,
  displayName = "this user"
}: ProfileRoundsSectionProps) {
  const navigate = useNavigate();

  const handleViewAll = () => {
    if (isOwnProfile) {
      navigate('/played-rounds');
    } else {
      navigate(`/user/${userId}/rounds`);
    }
  };

  const canViewRounds = isOwnProfile || isFriend;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-foreground">Rounds ({totalCount})</h2>
        {canViewRounds && rounds.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary gap-1"
            onClick={handleViewAll}
          >
            View all
            <ChevronRight size={16} />
          </Button>
        )}
      </div>

      {canViewRounds ? (
        rounds.length > 0 ? (
          <div className="space-y-3">
            {rounds.map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No rounds played yet</p>
              {isOwnProfile && (
                <Button
                  variant="link"
                  className="text-primary mt-2"
                  onClick={() => navigate('/rounds/play')}
                >
                  Start your first round
                </Button>
              )}
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Lock size={24} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Add {displayName} as a friend to see their rounds</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
