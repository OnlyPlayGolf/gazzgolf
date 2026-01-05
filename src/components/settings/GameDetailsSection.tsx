import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MapPin, Calendar, Flag, Hash, Trophy, Tag } from "lucide-react";
import { format } from "date-fns";

export interface GamePlayer {
  name: string;
  handicap?: number | null;
  tee?: string | null;
  team?: string | null;
  avatarUrl?: string | null;
}

const roundTypeLabels: Record<string, string> = {
  fun_practice: "Fun/Practice",
  qualifying: "Qualifying",
  tournament: "Tournament",
};

export interface GameDetailsData {
  format: string;
  additionalFormats?: string[];
  courseName: string;
  datePlayed: string;
  players: GamePlayer[];
  teeInfo: string;
  holesPlayed: number;
  currentHole?: number;
  scoring: string;
  roundName?: string | null;
  roundType?: string | null;
}

interface GameDetailsSectionProps {
  data: GameDetailsData;
  onViewPlayers: () => void;
}

export function GameDetailsSection({ data, onViewPlayers }: GameDetailsSectionProps) {
  const formatDisplay = data.additionalFormats && data.additionalFormats.length > 0
    ? `${data.format} + ${data.additionalFormats.length} more`
    : data.format;

  const holesDisplay = data.currentHole 
    ? `${data.currentHole} / ${data.holesPlayed}` 
    : `${data.holesPlayed} holes`;

  const formattedDate = (() => {
    try {
      return format(new Date(data.datePlayed), "MMM d, yyyy");
    } catch {
      return data.datePlayed;
    }
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Game Details
        </CardTitle>
        {data.roundName && (
          <p className="text-sm text-muted-foreground mt-1">{data.roundName}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <Flag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs">Format</p>
              <p className="font-medium">{formatDisplay}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs">Course</p>
              <p className="font-medium truncate">{data.courseName}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs">Date</p>
              <p className="font-medium">{formattedDate}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs">Players</p>
              <div className="flex items-center gap-2">
                <span className="font-medium">{data.players.length}</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-primary"
                  onClick={onViewPlayers}
                >
                  View
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="h-4 w-4 flex items-center justify-center text-muted-foreground mt-0.5 shrink-0">
              <span className="text-xs font-bold">T</span>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tees</p>
              <p className="font-medium">{data.teeInfo}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs">Holes</p>
              <p className="font-medium">{holesDisplay}</p>
            </div>
          </div>

          {data.roundType && (
            <div className="flex items-start gap-2">
              <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Type</p>
                <p className="font-medium">{roundTypeLabels[data.roundType] || data.roundType}</p>
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t">
          <p className="text-muted-foreground text-xs">Scoring</p>
          <p className="text-sm font-medium">{data.scoring}</p>
        </div>
      </CardContent>
    </Card>
  );
}
