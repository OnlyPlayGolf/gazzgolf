import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight, MapPin, Flag } from "lucide-react";

interface LiveRoundCardProps {
  gameId: string;
  gameType: 'round' | 'match_play' | 'umbriago' | 'wolf' | 'copenhagen';
  ownerProfile: {
    id: string;
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
  courseName: string;
  holesPlayed: number;
  totalHoles: number;
  status?: string; // e.g., "3 Up" for match play, points for umbriago
  players?: string[];
  createdAt: string;
}

export function LiveRoundCard({
  gameId,
  gameType,
  ownerProfile,
  courseName,
  holesPlayed,
  totalHoles,
  status,
  players,
  createdAt,
}: LiveRoundCardProps) {
  const navigate = useNavigate();

  const getGameTypeLabel = () => {
    switch (gameType) {
      case 'match_play': return 'Match Play';
      case 'umbriago': return 'Umbriago';
      case 'wolf': return 'Wolf';
      case 'copenhagen': return 'Copenhagen';
      default: return 'Stroke Play';
    }
  };

  const getSpectatorPath = () => {
    switch (gameType) {
      case 'match_play': return `/spectate/match-play/${gameId}`;
      case 'umbriago': return `/spectate/umbriago/${gameId}`;
      case 'wolf': return `/spectate/wolf/${gameId}`;
      case 'copenhagen': return `/spectate/copenhagen/${gameId}`;
      default: return `/spectate/round/${gameId}`;
    }
  };

  const displayName = ownerProfile.display_name || ownerProfile.username || 'Friend';
  const initials = displayName.charAt(0).toUpperCase();

  // Calculate time ago
  const getTimeAgo = () => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <Card
      className="p-4 cursor-pointer hover:border-primary transition-colors"
      onClick={() => navigate(getSpectatorPath())}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Avatar className="h-12 w-12 border-2 border-primary/20">
          {ownerProfile.avatar_url ? (
            <img src={ownerProfile.avatar_url} alt={displayName} className="object-cover" />
          ) : (
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">{displayName}</p>
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              {getGameTypeLabel()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
            <MapPin size={12} />
            <span className="truncate">{courseName}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Flag size={12} />
              <span>Hole {holesPlayed}/{totalHoles}</span>
            </div>
            {status && (
              <span className="text-xs font-medium text-primary">{status}</span>
            )}
            <span className="text-xs text-muted-foreground">{getTimeAgo()}</span>
          </div>
        </div>

        {/* Live indicator + Arrow */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-green-600">LIVE</span>
          </div>
          <ChevronRight size={20} className="text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}
