import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, CheckCircle, Circle, Trophy, Target } from "lucide-react";
import { useState, useEffect } from "react";
import { getLevelsWithProgress, getCompletionStats, completeLevelz } from "@/utils/levelsManager";
import { Level } from "@/types/levels";

const Levels = () => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [stats, setStats] = useState({ completed: 0, total: 0, percentage: 0 });

  useEffect(() => {
    const loadData = () => {
      const levelsData = getLevelsWithProgress();
      const statsData = getCompletionStats();
      setLevels(levelsData);
      setStats(statsData);
    };
    loadData();
  }, []);

  const handleCompleteLevel = (levelId: string) => {
    completeLevelz(levelId);
    // Reload data
    const levelsData = getLevelsWithProgress();
    const statsData = getCompletionStats();
    setLevels(levelsData);
    setStats(statsData);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'putt': return <Target size={16} />;
      case 'chip': return <Trophy size={16} />;
      default: return <Circle size={16} />;
    }
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Levels</h1>
          <p className="text-muted-foreground">Track your skill progression</p>
        </div>

        {/* Progress Overview */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-primary" size={20} />
                  <span className="font-semibold">Overall Progress</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {stats.completed} / {stats.total} completed
                </span>
              </div>
              <Progress value={stats.percentage} className="h-2" />
              <div className="text-center">
                <span className="text-2xl font-bold text-primary">{stats.percentage}%</span>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Levels Grid */}
        <div className="space-y-3">
          {levels.map((level) => (
            <Card key={level.id} className={`transition-all ${level.completed ? 'bg-green-50/50 border-green-200' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                        Level {level.level}
                      </span>
                      <Badge variant="outline" className={getDifficultyColor(level.difficulty)}>
                        {level.difficulty}
                      </Badge>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {getTypeIcon(level.type)}
                        <span className="text-xs">{level.type}</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1 truncate">
                      {level.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {level.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Distance: {level.distance}</span>
                      <span>Target: {level.target}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    {level.completed ? (
                      <CheckCircle className="text-green-600" size={24} />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCompleteLevel(level.id)}
                        className="text-xs"
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Levels;