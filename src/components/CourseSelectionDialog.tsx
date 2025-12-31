import { useState, useEffect } from "react";
import { Search, MapPin, Star, Clock, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { AddCourseDialog } from "./AddCourseDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
interface Course {
  id: string;
  name: string;
  location: string;
  tee_names?: Record<string, string> | null;
}

// Country patterns map for both flag detection and search
const countryPatterns: Record<string, { flag: string; keywords: string[] }> = {
  usa: {
    flag: "🇺🇸",
    keywords: ["usa", "united states", "america", "california", "florida", "texas", "arizona", 
               "georgia", "new york", "nevada", "carolina", "michigan", "ohio", "oregon", 
               "washington", "colorado", "hawaii", "pebble beach", ", ca", ", fl", ", tx", 
               ", az", ", ny", ", nv", ", ga", "monterey", "san francisco", "los angeles"]
  },
  uk: {
    flag: "🇬🇧",
    keywords: ["scotland", "england", "wales", "united kingdom", "uk", "britain", "st andrews", "northern ireland"]
  },
  ireland: { flag: "🇮🇪", keywords: ["ireland", "irish"] },
  spain: { flag: "🇪🇸", keywords: ["spain", "españa", "spanish"] },
  france: { flag: "🇫🇷", keywords: ["france", "french"] },
  germany: { flag: "🇩🇪", keywords: ["germany", "deutschland", "german"] },
  italy: { flag: "🇮🇹", keywords: ["italy", "italia", "italian"] },
  portugal: { flag: "🇵🇹", keywords: ["portugal", "portuguese"] },
  australia: { flag: "🇦🇺", keywords: ["australia", "australian"] },
  japan: { flag: "🇯🇵", keywords: ["japan", "日本", "japanese"] },
  canada: { flag: "🇨🇦", keywords: ["canada", "canadian"] },
  mexico: { flag: "🇲🇽", keywords: ["mexico", "méxico", "mexican"] },
  uae: { flag: "🇦🇪", keywords: ["dubai", "uae", "emirates", "abu dhabi"] },
  southafrica: { flag: "🇿🇦", keywords: ["south africa", "african"] },
  sweden: { flag: "🇸🇪", keywords: ["sweden", "sverige", "swedish"] },
  denmark: { flag: "🇩🇰", keywords: ["denmark", "danmark", "danish"] },
  norway: { flag: "🇳🇴", keywords: ["norway", "norge", "norwegian"] },
  netherlands: { flag: "🇳🇱", keywords: ["netherlands", "holland", "dutch"] },
  belgium: { flag: "🇧🇪", keywords: ["belgium", "belgian"] },
  switzerland: { flag: "🇨🇭", keywords: ["switzerland", "schweiz", "swiss"] },
  austria: { flag: "🇦🇹", keywords: ["austria", "österreich", "austrian"] },
  thailand: { flag: "🇹🇭", keywords: ["thailand", "thai"] },
  korea: { flag: "🇰🇷", keywords: ["korea", "korean"] },
  china: { flag: "🇨🇳", keywords: ["china", "中国", "chinese"] },
  newzealand: { flag: "🇳🇿", keywords: ["new zealand", "kiwi"] },
};

// Get country flag emoji from location string
const getCountryFlag = (location: string): string => {
  if (!location) return "🏌️";
  const loc = location.toLowerCase();
  
  for (const country of Object.values(countryPatterns)) {
    if (country.keywords.some(kw => loc.includes(kw))) {
      return country.flag;
    }
  }
  
  return "🏌️"; // Default golf flag for unknown locations
};

// Check if a course matches a country search term
const matchesCountrySearch = (location: string, searchTerm: string): boolean => {
  if (!location || !searchTerm) return false;
  const search = searchTerm.toLowerCase();
  const loc = location.toLowerCase();
  
  for (const country of Object.values(countryPatterns)) {
    // Check if search term matches any country keyword
    const searchMatchesCountry = country.keywords.some(kw => kw.includes(search) || search.includes(kw));
    // Check if location matches that country
    const locationMatchesCountry = country.keywords.some(kw => loc.includes(kw));
    
    if (searchMatchesCountry && locationMatchesCountry) {
      return true;
    }
  }
  return false;
};

interface CourseSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCourse: (course: Course) => void;
}

export function CourseSelectionDialog({ isOpen, onClose, onSelectCourse }: CourseSelectionDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);
  const [favoriteCourses, setFavoriteCourses] = useState<Course[]>([]);
  const [favoriteCourseIds, setFavoriteCourseIds] = useState<Set<string>>(new Set());
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
      fetchRecentCourses();
      fetchFavoriteCourses();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = allCourses.filter((course) =>
        course.name.toLowerCase().includes(query) ||
        (course.location && course.location.toLowerCase().includes(query)) ||
        matchesCountrySearch(course.location, query)
      );
      setFilteredCourses(filtered);
    } else {
      setFilteredCourses(allCourses);
    }
  }, [searchQuery, allCourses]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, location, tee_names")
        .order("name");

      if (error) throw error;
      const coursesWithTees = (data || []).map(c => ({
        ...c,
        location: c.location || "",
        tee_names: c.tee_names as Record<string, string> | null
      }));
      setAllCourses(coursesWithTees);
      setFilteredCourses(coursesWithTees);
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  const fetchRecentCourses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("rounds")
        .select("course_name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get unique course names and match with courses
      const uniqueCourseNames = [...new Set(data?.map(r => r.course_name) || [])];
      const recentCoursesData = allCourses.filter(c => uniqueCourseNames.includes(c.name)).slice(0, 5);
      
      // If we don't have matched courses yet, try to create placeholder entries
      if (recentCoursesData.length === 0 && uniqueCourseNames.length > 0) {
        const placeholders = uniqueCourseNames.slice(0, 5).map((name, i) => ({
          id: `recent-${i}`,
          name,
          location: ""
        }));
        setRecentCourses(placeholders);
      } else {
        setRecentCourses(recentCoursesData);
      }
    } catch (error) {
      console.error("Error fetching recent courses:", error);
    }
  };

  const fetchFavoriteCourses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("favorite_courses")
        .select("course_id, courses(id, name, location, tee_names)")
        .eq("user_id", user.id);

      if (error) throw error;

      const favoriteIds = new Set<string>();
      const favorites: Course[] = [];
      
      data?.forEach((fav: any) => {
        if (fav.courses) {
          favoriteIds.add(fav.course_id);
          favorites.push({
            id: fav.courses.id,
            name: fav.courses.name,
            location: fav.courses.location || "",
            tee_names: fav.courses.tee_names as Record<string, string> | null
          });
        }
      });

      setFavoriteCourseIds(favoriteIds);
      setFavoriteCourses(favorites);
    } catch (error) {
      console.error("Error fetching favorite courses:", error);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, course: Course) => {
    e.stopPropagation();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save favorites");
        return;
      }

      const isFavorite = favoriteCourseIds.has(course.id);

      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from("favorite_courses")
          .delete()
          .eq("user_id", user.id)
          .eq("course_id", course.id);

        if (error) throw error;

        setFavoriteCourseIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(course.id);
          return newSet;
        });
        setFavoriteCourses(prev => prev.filter(c => c.id !== course.id));
        toast.success("Removed from favorites");
      } else {
        // Add to favorites
        const { error } = await supabase
          .from("favorite_courses")
          .insert({ user_id: user.id, course_id: course.id });

        if (error) throw error;

        setFavoriteCourseIds(prev => new Set([...prev, course.id]));
        setFavoriteCourses(prev => [...prev, course]);
        toast.success("Added to favorites");
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorites");
    }
  };


  const handleSelectCourse = (course: Course) => {
    onSelectCourse(course);
    onClose();
  };

  const handleCourseAdded = (course: Course) => {
    setShowAddCourse(false);
    // Refresh courses list and select the new course
    fetchCourses();
    handleSelectCourse(course);
  };

  const CourseItem = ({ course }: { course: Course }) => {
    const isFavorite = favoriteCourseIds.has(course.id);
    
    return (
      <button
        onClick={() => handleSelectCourse(course)}
        className="w-full p-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3 text-left border"
      >
        <span className="text-xl shrink-0">{getCountryFlag(course.location)}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{course.name}</p>
          {course.location && (
            <p className="text-sm text-muted-foreground truncate">{course.location}</p>
          )}
        </div>
        <button
          onClick={(e) => toggleFavorite(e, course)}
          className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <Star
            size={20}
            className={cn(
              "transition-colors",
              isFavorite
                ? "text-yellow-500 fill-yellow-500"
                : "text-muted-foreground hover:text-yellow-500"
            )}
          />
        </button>
      </button>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Select Course
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-3 mx-4 shrink-0">
              <TabsTrigger value="search" className="text-xs">
                <Search className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="favorites" className="text-xs">
                <Star className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="recent" className="text-xs">
                <Clock className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="flex-1 flex flex-col min-h-0 mt-0 p-4 pt-4 data-[state=inactive]:hidden">
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Button
                variant="outline"
                onClick={() => setShowAddCourse(true)}
                className="w-full shrink-0 mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Course
              </Button>

              <div className="flex-1 min-h-0 overflow-y-auto mt-4">
                <div className="space-y-2 pb-4">
                  {filteredCourses.map((course) => (
                    <CourseItem key={course.id} course={course} />
                  ))}
                  {filteredCourses.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No courses found
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="favorites" className="flex-1 min-h-0 mt-0 p-4 data-[state=inactive]:hidden">
              <div className="h-full overflow-y-auto">
                <div className="space-y-2 pb-4">
                  {favoriteCourses.length > 0 ? (
                    favoriteCourses.map((course) => (
                      <CourseItem key={course.id} course={course} />
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Star className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">No favorite courses yet</p>
                      <p className="text-sm text-muted-foreground">Star courses to add them here</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recent" className="flex-1 min-h-0 mt-0 p-4 data-[state=inactive]:hidden">
              <div className="h-full overflow-y-auto">
                <div className="space-y-2 pb-4">
                  {recentCourses.length > 0 ? (
                    recentCourses.map((course) => (
                      <CourseItem key={course.id} course={course} />
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">No recent rounds</p>
                      <p className="text-sm text-muted-foreground">Your recent courses will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

          </Tabs>
        </DialogContent>
      </Dialog>

      <AddCourseDialog
        isOpen={showAddCourse}
        onClose={() => setShowAddCourse(false)}
        onCourseAdded={handleCourseAdded}
      />
    </>
  );
}
