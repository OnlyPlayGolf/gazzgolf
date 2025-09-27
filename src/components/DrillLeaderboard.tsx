import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Crown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  timestamp: number;
}

interface DrillLeaderboardProps {
  drillName: string;
  friendsLeaderboard: LeaderboardEntry[];
  groupLeaderboard: LeaderboardEntry[];
  groupName?: string;
}

const DrillLeaderboard = ({ drillName, friendsLeaderboard, groupLeaderboard, groupName }: DrillLeaderboardProps) => {
  const renderLeaderboardItem = (entry: LeaderboardEntry, index: number, isFriend: boolean = true) => {
    const getRankIcon = (rank: number) => {
      if (rank === 1) return <Crown size={16} className="text-yellow-500" />;
      if (rank === 2) return <Trophy size={16} className="text-gray-400" />;
      if (rank === 3) return <Trophy size={16} className="text-orange-500" />;
      return <span className="text-sm font-bold text-muted-foreground w-4 text-center">{rank}</span>;
    };

    return (
      <div key={entry.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6">
            {getRankIcon(index + 1)}
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className={`text-sm ${index < 3 ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>
              {entry.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{entry.name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(entry.timestamp).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-foreground">
          {entry.score}
        </Badge>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Friends Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Users size={18} />
            Friends Top 3
          </CardTitle>
        </CardHeader>
        <CardContent>
          {friendsLeaderboard.length > 0 ? (
            <div className="space-y-2">
              {friendsLeaderboard.slice(0, 3).map((entry, index) => 
                renderLeaderboardItem(entry, index, true)
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No friends have completed this drill yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Group Leaderboard */}
      {groupName && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Trophy size={18} />
              {groupName} Top 3
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupLeaderboard.length > 0 ? (
              <div className="space-y-2">
                {groupLeaderboard.slice(0, 3).map((entry, index) => 
                  renderLeaderboardItem(entry, index, false)
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No group members have completed this drill yet
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DrillLeaderboard;

// Also export as named export for compatibility
export { DrillLeaderboard };