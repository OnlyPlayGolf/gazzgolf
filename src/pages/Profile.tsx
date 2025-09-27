import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Trophy, Settings, Crown, Star } from "lucide-react";
import { APP_NAME, STORAGE_KEYS } from "@/constants/app";
import { getStorageItem, setStorageItem, migrateStorageKeys } from "@/utils/storageManager";

interface Score {
  name: string;
  score: number;
  timestamp: number;
}

interface Group {
  id: string;
  name: string;
  members: string[];
}

const Profile = () => {
  const [displayName, setDisplayName] = useState<string>("");
  const [friends, setFriends] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [favoriteGroupId, setFavoriteGroupId] = useState<string | null>(null);

  useEffect(() => {
    // Migrate storage keys on first load
    migrateStorageKeys();
    
    // Load data from storage
    setDisplayName(getStorageItem(STORAGE_KEYS.DISPLAY_NAME, ""));
    setFriends(getStorageItem(STORAGE_KEYS.FRIENDS, []));
    setGroups(getStorageItem(STORAGE_KEYS.GROUPS, []));
    setScores(getStorageItem(STORAGE_KEYS.PGA18_SCORES, []));
    setFavoriteGroupId(getStorageItem(STORAGE_KEYS.CURRENT_GROUP_ID, null));
  }, []);

  const handleSetDisplayName = () => {
    const name = prompt("Enter your display name:");
    if (name && name.trim()) {
      const trimmedName = name.trim();
      setDisplayName(trimmedName);
      setStorageItem(STORAGE_KEYS.DISPLAY_NAME, trimmedName);
    }
  };

  const getBestScore = () => {
    if (!displayName || scores.length === 0) return null;
    
    const userScores = scores.filter(score => score.name === displayName);
    if (userScores.length === 0) return null;
    
    // Find lowest score, then earliest timestamp if tied
    const bestScore = userScores.reduce((best, current) => {
      if (current.score < best.score) return current;
      if (current.score === best.score && current.timestamp < best.timestamp) return current;
      return best;
    });
    
    return bestScore;
  };

  const handleSetFavoriteGroup = (groupId: string | null) => {
    setFavoriteGroupId(groupId);
    if (groupId) {
      setStorageItem(STORAGE_KEYS.CURRENT_GROUP_ID, groupId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_GROUP_ID);
    }
  };

  const getFriendsLeaderboard = () => {
    // Mock leaderboard data - in production this would come from Supabase
    return scores
      .reduce((acc: Score[], score) => {
        const existing = acc.find(s => s.name === score.name);
        if (!existing || score.score < existing.score || 
           (score.score === existing.score && score.timestamp < existing.timestamp)) {
          return [...acc.filter(s => s.name !== score.name), score];
        }
        return acc;
      }, [])
      .sort((a, b) => a.score - b.score)
      .slice(0, 10);
  };

  const getGroupLeaderboard = () => {
    // Mock group leaderboard - same as friends for demo
    return getFriendsLeaderboard().slice(0, 10);
  };

  const bestScore = getBestScore();
  const favoriteGroup = groups.find(g => g.id === favoriteGroupId);

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-bold text-foreground">Profile</h1>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6 mt-6">
          {/* User Profile Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  {displayName ? (
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSetDisplayName}
                        className="text-muted-foreground hover:text-foreground p-0 h-auto"
                      >
                        Change name
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleSetDisplayName}
                      variant="outline"
                      className="text-sm"
                    >
                      Set display name
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Friends */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Users size={20} />
                My Friends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {friends.length > 0 ? (
                <div className="space-y-2">
                  {friends.map((friend, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                          {friend.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground">{friend}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No friends added yet</p>
              )}
            </CardContent>
          </Card>

          {/* My Groups */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Settings size={20} />
                My Groups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {groups.length > 0 ? (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">{group.name}</h4>
                            {favoriteGroupId === group.id && (
                              <Star size={16} className="text-yellow-500 fill-current" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetFavoriteGroup(favoriteGroupId === group.id ? null : group.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {favoriteGroupId === group.id ? 'Unfavorite' : 'Set Favorite'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No groups joined yet</p>
              )}
            </CardContent>
          </Card>

          {/* My Best Scores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Trophy size={20} />
                My Best Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                  <div>
                    <h4 className="font-medium text-foreground">PGA Tour 18 Holes</h4>
                    <p className="text-sm text-muted-foreground">Putting • Mixed distances</p>
                  </div>
                  <div className="text-right">
                    {bestScore ? (
                      <div>
                        <p className="font-semibold text-foreground">{bestScore.score}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(bestScore.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No score yet</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </TabsContent>
          
          <TabsContent value="leaderboards" className="space-y-6 mt-6">
            {/* Friends Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Users size={20} />
                  Friends Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                {friends.length > 0 ? (
                  <div className="space-y-3">
                    {getFriendsLeaderboard().map((score, index) => (
                      <div key={`${score.name}_${score.timestamp}`} className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                            {index < 3 ? (
                              index === 0 ? <Crown size={16} className="text-yellow-500" /> :
                              <Trophy size={16} className={index === 1 ? "text-gray-400" : "text-orange-500"} />
                            ) : (
                              <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>
                            )}
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={index < 3 ? 'bg-primary/20 text-primary' : 'bg-muted'}>
                              {score.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{score.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(score.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{score.score}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No friends added yet</p>
                )}
              </CardContent>
            </Card>

            {/* Group Leaderboard */}
            {favoriteGroup && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Trophy size={20} />
                    {favoriteGroup.name} Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getGroupLeaderboard().map((score, index) => (
                      <div key={`${score.name}_${score.timestamp}`} className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                            {index < 3 ? (
                              index === 0 ? <Crown size={16} className="text-yellow-500" /> :
                              <Trophy size={16} className={index === 1 ? "text-gray-400" : "text-orange-500"} />
                            ) : (
                              <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>
                            )}
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={index < 3 ? 'bg-primary/20 text-primary' : 'bg-muted'}>
                              {score.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{score.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(score.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{score.score}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!favoriteGroup && groups.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Trophy size={48} className="mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-foreground mb-2">No Favorite Group</h3>
                    <p className="text-muted-foreground mb-4">
                      Set a favorite group in the Profile tab to see group leaderboards
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;