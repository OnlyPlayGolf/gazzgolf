import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Zap, Hammer, Activity, Star } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getFavorites, addToFavorites, removeFromFavorites, isFavorite, FavoriteDrill } from "@/utils/favoritesManager";

const allDrills = [
  {
    id: 'pga-tour-18',
    title: 'PGA Tour 18 Holes',
    shortDescription: 'Practice putting from tournament-style distances across 18 holes for consistency under pressure.',
    category: 'putting',
    icon: Target,
  },
  {
    id: 'aggressive-putting',
    title: 'Aggressive Putting',
    shortDescription: 'Putt from a fixed cycle of 4m, 5m, then 6m, repeating in that order to reach 15 points quickly.',
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
];

const categoryNames = {
  putting: 'Putting',
  shortgame: 'Short Game',
  wedges: 'Wedges',
  longgame: 'Long Game',
  favourites: 'Favourites',
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
    if (categoryId === 'favourites') {
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

        {categoryId === 'favourites' && drills.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Star className="text-muted-foreground mb-4" size={48} />
              <p className="text-muted-foreground text-center">
                No favourites yet — tap ★ on any drill to add it.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {drills.map((drill) => {
              if (!drill) return null;
              
              const Icon = drill.icon;
              const drillIsFavorite = isFavorite(drill.id);
              
              return (
                <Card key={drill.id} className="border-golf-light hover:border-primary transition-all duration-200">
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
                      onClick={() => navigate(`/drills/${drill.id}/detail`)}
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