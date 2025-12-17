import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, MapPin, Calendar, Users, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface RoundCardData {
  id: string;
  round_name?: string | null;
  course_name: string;
  date: string;
  score: number;
  playerCount: number;
  gameMode: string;
}

interface RoundCardProps {
  round: RoundCardData;
}

export function RoundCard({ round }: RoundCardProps) {
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatScore = (score: number) => {
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : `${score}`;
  };

  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-colors border-border"
      onClick={() => navigate(`/rounds/${round.id}/detail`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {round.round_name || 'Round'}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin size={14} className="flex-shrink-0" />
              <span className="truncate">{round.course_name}</span>
            </div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {formatDate(round.date)}
              </span>
              <span className="flex items-center gap-1">
                <Trophy size={12} />
                {round.gameMode}
              </span>
              <span className="flex items-center gap-1">
                <Users size={12} />
                {round.playerCount}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <div className={`text-2xl font-bold ${round.score <= 0 ? 'text-emerald-600' : 'text-foreground'}`}>
              {formatScore(round.score)}
            </div>
            <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
