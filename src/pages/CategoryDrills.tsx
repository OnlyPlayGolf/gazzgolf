import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Zap, Hammer, Activity, Star } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getFavorites, addToFavorites, removeFromFavorites, isFavorite, FavoriteDrill } from "@/utils/favoritesManager";

const allDrills = [
  {
    id: 'aggressive-putting',
    title: 'Aggressive Putting',
    shortDescription: 'The Aggressive Putting drill helps you commit with confidence inside six meters. We\'re training speed and confidence - no hesitant strokes.',
    category: 'putting', 
    icon: Target,
  },
  {
    id: 'pga-tour-18',
    title: 'PGA Tour 18 Holes',
    shortDescription: '18 putts that represent an average putting round on the PGA Tour. A great drill to use for overall putting practice, compete with friends, test yourself against tour standards or dial in your speed control.',
    category: 'putting',
    icon: Target,
  },
  {
    id: 'short-putting-test',
    title: 'Short Putting Test',
    shortDescription: 'Short putts under pressure.',
    category: 'putting',
    icon: Target,
  },
  {
    id: 'up-down-putting',
    title: 'Up & Down Putting Drill',
    shortDescription: 'A speed control test that challenges you on both uphill and downhill putts. Learn how elevation changes affect your pace and break.',
    category: 'putting',
    icon: Target,
  },
  {
    id: '8-ball-drill',
    title: '8-Ball Drill',
    shortDescription: 'Complete 8 stations (chip/pitch/lob/bunker) and score each rep. Do the circuit 5 times.',
    category: 'shortgame',
    icon: Zap,
  },
  {
    id: 'wedges-distance-control',
    title: 'Wedges 40–80 m — Distance Control',
    shortDescription: 'Hit specified distances in carry with precise distance control. Score points for accuracy.',
    category: 'wedges',
    icon: Hammer,
  },
  {
    id: 'wedges-2-laps',
    title: 'Wedges 40–80 m — 2 Laps',
    shortDescription: 'Hit the specified distances. One shot per length, 2 laps.',
    category: 'wedges',
    icon: Hammer,
  },
  {
    id: 'shot-shape-master',
    title: 'Shot Shape Master',
    shortDescription: '14 tee shots testing your ability to shape shots on command. Master draws, fades, and fairway finding with bonus streaks.',
    category: 'teeshots',
    icon: Target,
  },
  {
    id: 'approach-control',
    title: 'Approach Control',
    shortDescription: '14 randomized approach shots from 130-180 meters. Test your precision and control with PGA Tour-based scoring.',
    category: 'approach',
    icon: Activity,
  },
];

const categoryNames = {
  putting: 'Putting',
  shortgame: 'Short Game',
  wedges: 'Wedges',
  approach: 'Approach',
  teeshots: 'Tee Shots',
  favorites: 'Favorites',
};

const CategoryDrills = () => {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const [favorites, setFavorites] = useState<FavoriteDrill[]>([]);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  const toggleFavorite = (drill: typeof allDrills[0]) => {
    const drillIsFavorite = isFavorite(drill.id);
    
    if (drillIsFavorite) {
      const updated = removeFromFavorites(drill.id);
      setFavorites(updated);
    } else {
      const updated = addToFavorites({
        id: drill.id,
        title: drill.title,
        category: drill.category,
      });
      setFavorites(updated);
    }
  };

  const getDrillsForCategory = () => {
    if (categoryId === 'favorites') {
      return favorites.map(fav => 
        allDrills.find(drill => drill.id === fav.id)
      ).filter(Boolean).sort((a, b) => a!.title.localeCompare(b!.title));
    }
    
    return allDrills
      .filter(drill => drill.category === categoryId)
      .sort((a, b) => a.title.localeCompare(b.title));
  };

  const drills = getDrillsForCategory();
  const categoryName = categoryNames[categoryId as keyof typeof categoryNames] || 'Drills';

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/categories')}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{categoryName}</h1>
            <p className="text-muted-foreground">Choose a drill to start practicing</p>
          </div>
        </div>

        {categoryId === 'favorites' && drills.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Star className="text-muted-foreground mb-4" size={48} />
              <p className="text-muted-foreground text-center">
                No favorites yet — tap ★ on any drill to add it.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {drills.map((drill) => {
              if (!drill) return null;
              const Icon = drill.icon;
              const drillIsFavorite = isFavorite(drill.id);
              
              // Drills with new game mode structure
              const gameModeDrills = [
                'aggressive-putting',
                'pga-tour-18',
                'up-down-putting',
                'short-putting-test',
                '8-ball-drill',
                'shot-shape-master',
                'approach-control'
              ];
              
              const handleDrillClick = () => {
                if (gameModeDrills.includes(drill.id)) {
                  navigate(`/drill/${drill.id}/score`);
                } else {
                  navigate(`/drills/${drill.id}/detail`);
                }
              };
              
              return (
                <Card 
                  key={drill.id} 
                  className="border-golf-light hover:border-primary transition-all duration-200 cursor-pointer"
                  onClick={handleDrillClick}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-foreground">
                      <Icon size={24} className="text-primary" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span>{drill.title}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(drill);
                            }}
                          >
                            <Star 
                              size={16} 
                              className={cn(
                                "transition-colors",
                                drillIsFavorite 
                                  ? "text-yellow-500 fill-yellow-500" 
                                  : "text-muted-foreground hover:text-yellow-500"
                              )}
                            />
                          </Button>
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {drill.shortDescription}
                    </p>
                    
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrillClick();
                      }}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Start
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryDrills;