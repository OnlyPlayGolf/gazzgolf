import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, CheckCircle, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLevelsWithProgress, getCompletionStats, completeLevelz, getLevelProgress } from "@/utils/levelsManager";
import { Level } from "@/types/levels";
import { supabase } from "@/integrations/supabase/client";

const capitalize = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const Levels = () => {
  const navigate = useNavigate();
  const { difficulty } = useParams<{ difficulty: string }>();
  const [levels, setLevels] = useState<Level[]>([]);
  const [stats, setStats] = useState({ completed: 0, total: 0, percentage: 0, totalCompleted: 0, totalLevels: 0 });
  const [activeTab, setActiveTab] = useState("play");
  const [profile, setProfile] = useState<any>(null);
  const [isLevelStarted, setIsLevelStarted] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const allLevels = getLevelsWithProgress();
      const filteredLevels = allLevels.filter(
        (level) => level.difficulty.toLowerCase() === (difficulty || "beginner").toLowerCase()
      );

      const completed = filteredLevels.filter((level) => level.completed).length;
      const total = filteredLevels.length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Calculate total completed across all difficulties
      const totalCompleted = allLevels.filter((level) => level.completed).length;
      const totalLevels = allLevels.length;

      setLevels(filteredLevels);
      setStats({ completed, total, percentage, totalCompleted, totalLevels });
      setIsLevelStarted(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, username, country, handicap, home_club")
          .eq("id", user.id)
          .single();
        setProfile(profileData);
      }
    };
    loadData();
  }, [difficulty]);

  const handleStartLevel = () => {
    setIsLevelStarted(true);
  };

  const handleCompleteLevel = (levelId: string) => {
    // Get current progress to increment attempts
    const progress = getLevelProgress();
    const currentAttempts = progress[levelId]?.attempts || 0;
    
    completeLevelz(levelId, currentAttempts + 1, true);
    const allLevels = getLevelsWithProgress();
    const levelsData = allLevels.filter(
      (level) => level.difficulty.toLowerCase() === (difficulty || "beginner").toLowerCase()
    );
    const completed = levelsData.filter((l) => l.completed).length;
    const total = levelsData.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Calculate total completed across all difficulties
    const totalCompleted = allLevels.filter((level) => level.completed).length;
    const totalLevels = allLevels.length;
    
    setLevels(levelsData);
    setStats({ completed, total, percentage, totalCompleted, totalLevels });
    setIsLevelStarted(false);
  };

  const handleFailLevel = (levelId: string) => {
    // Get current progress to increment attempts
    const progress = getLevelProgress();
    const currentAttempts = progress[levelId]?.attempts || 0;
    
    // Increment attempts without completing
    completeLevelz(levelId, currentAttempts + 1, false);
    
    // Refresh levels data
    const allLevels = getLevelsWithProgress();
    const levelsData = allLevels.filter(
      (level) => level.difficulty.toLowerCase() === (difficulty || "beginner").toLowerCase()
    );
    setLevels(levelsData);
    setIsLevelStarted(false);
  };

  const currentLevel = levels.find((level) => !level.completed) || levels[levels.length - 1];
  const currentLevelNumber = currentLevel?.level || 1;

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "putt":
        return "bg-primary text-primary-foreground";
      case "chip":
        return "bg-secondary text-secondary-foreground";
      case "driver":
        return "bg-accent text-accent-foreground";
      case "approach":
        return "bg-blue-500 text-white";
      case "bunker":
        return "bg-amber-500 text-white";
      case "wedge":
        return "bg-purple-500 text-white";
      case "play":
        return "bg-green-500 text-white";
      case "wood":
        return "bg-orange-600 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getDifficultyColor = (d: string) => {
    switch (d.toLowerCase()) {
      case "beginner":
      case "intermediate":
      case "advanced":
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        {/* Header styled like Drills page */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/levels")}
              className="rounded-full"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">{capitalize(difficulty)} Levels</h1>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground">Complete the levels honestly and be honest with yourself — only true practice builds real skill</p>
            </div>
          </div>
        </div>

        {/* Player Dashboard */}
        <Card className="mb-6 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {profile?.display_name || profile?.username || "Player Name"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {profile?.handicap ? `Handicap: ${profile.handicap}` : "Handicap: Not set"}
                  {profile?.home_club && ` • ${profile.home_club}`}
                  {profile?.country && ` • ${profile.country}`}
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-lg font-semibold text-foreground">
                  {stats.completed} of {stats.total}
                </p>
              </div>
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Current Level</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold text-foreground">{currentLevelNumber}</p>
                  <Badge className={`text-xs rounded-full ${getTypeColor(currentLevel?.type || "putt")}`}>
                    {currentLevel?.type || "Putt"}
                  </Badge>
                </div>
              </div>
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Completed Levels</p>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">
                    {stats.totalCompleted} of 500 ({Math.round((stats.totalCompleted / 500) * 100) || 0}%)
                  </p>
                  <Progress value={Math.round((stats.totalCompleted / 500) * 100) || 0} className="h-1" />
                </div>
              </div>
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Categories</p>
                <div className="grid grid-cols-2 gap-1">
                  {Array.from(new Set(levels.map(l => l.type)))
                    .filter(type => !["Chip/Putt", "Bunker/Putt", "Pitch/Putt", "Wedge/Putt", "Chip/Bunker/Putt", "Approach/Driver"].includes(type))
                    .sort((a, b) => {
                      // Custom sorting based on difficulty level
                      if (difficulty?.toLowerCase() === "professional") {
                        const order = ["Putt", "Chip", "Wedge", "Bunker", "Driver", "Play", "Approach"];
                        return order.indexOf(a) - order.indexOf(b);
                      } else if (difficulty?.toLowerCase() === "amateur") {
                        const order = ["Putt", "Chip", "Approach", "Pitch", "Wedge", "Bunker"];
                        return order.indexOf(a) - order.indexOf(b);
                      } else if (difficulty?.toLowerCase() === "tour") {
                        const order = ["Putt", "Chip", "Wedge", "Bunker", "Driver", "Wood", "Approach", "Play"];
                        return order.indexOf(a) - order.indexOf(b);
                      }
                      return a.localeCompare(b);
                    })
                    .map(type => (
                      <Badge key={type} className={`text-xs rounded-full ${getTypeColor(type)}`}>
                        {type}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="play">Play</TabsTrigger>
            <TabsTrigger value="all-levels">All Levels ({stats.total})</TabsTrigger>
          </TabsList>

          {/* Play Tab - Current Level */}
          <TabsContent value="play" className="mt-0">
            {currentLevel && (
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold text-foreground">
                          Level {currentLevel.level}: {currentLevel.title}
                        </h3>
                        <Badge className={`text-xs rounded-full ${getTypeColor(currentLevel.type)}`}>
                          {currentLevel.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Distance</p>
                      <p className="font-semibold text-foreground">{currentLevel.distance}</p>
                    </div>
                  </div>

                  <p className="text-muted-foreground mb-4">{currentLevel.description}</p>

                  <div className="flex items-center gap-2 mb-6">
                    <Target size={16} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground"><strong>Target:</strong> <strong>{currentLevel.target}</strong></span>
                    <Badge variant="outline" className={getDifficultyColor(currentLevel.difficulty)}>
                      {currentLevel.difficulty}
                    </Badge>
                  </div>

                  {!isLevelStarted ? (
                    <Button
                      onClick={handleStartLevel}
                      className="w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90"
                      size="lg"
                    >
                      Start Level
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => handleCompleteLevel(currentLevel.id)}
                        className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                        size="lg"
                      >
                        Completed
                      </Button>
                      <Button
                        onClick={() => handleFailLevel(currentLevel.id)}
                        variant="outline"
                        className="rounded-2xl"
                        size="lg"
                      >
                        Failed
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* All Levels Tab */}
          <TabsContent value="all-levels" className="mt-0">
            <div className="space-y-3">
              {levels.map((level) => (
                <Card
                  key={level.id}
                  className={`rounded-2xl transition-all ${level.completed ? "bg-muted/50 opacity-75" : "shadow-sm"}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">Level {level.level}: {level.title}</h4>
                          <Badge className={`text-xs rounded-full ${getTypeColor(level.type)}`}>{level.type}</Badge>
                          {level.completed && <CheckCircle size={16} className="text-primary" />}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{level.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Target size={12} />
                            <span><strong>Target:</strong> <strong>{level.target}</strong></span>
                          </div>
                          <Badge variant="outline" className={`${getDifficultyColor(level.difficulty)} text-xs`}>
                            {level.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-foreground mb-2">{level.distance}</p>
                        {level.completed && (
                          <Badge variant="outline" className="text-xs">Completed</Badge>
                        )}
                        {(level as any).attempts && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {(level as any).attempts} attempt{(level as any).attempts > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Levels;
