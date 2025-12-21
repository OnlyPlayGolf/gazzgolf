import { useState, useEffect } from "react";
import { Search, MapPin, Star, Clock, TrendingUp, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { AddCourseDialog } from "./AddCourseDialog";

interface Course {
  id: string;
  name: string;
  location: string;
  tee_names?: Record<string, string> | null;
}

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
  const [mostPlayedCourses, setMostPlayedCourses] = useState<Course[]>([]);
  const [favoriteCourses, setFavoriteCourses] = useState<Course[]>([]);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
      fetchRecentCourses();
      fetchMostPlayedCourses();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = allCourses.filter((course) =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.location && course.location.toLowerCase().includes(searchQuery.toLowerCase()))
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

  const fetchMostPlayedCourses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("rounds")
        .select("course_name")
        .eq("user_id", user.id);

      if (error) throw error;

      // Count occurrences
      const courseCounts: Record<string, number> = {};
      data?.forEach(r => {
        courseCounts[r.course_name] = (courseCounts[r.course_name] || 0) + 1;
      });

      // Sort by count and get top 5
      const sortedCourses = Object.entries(courseCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name]) => name);

      const mostPlayedData = allCourses.filter(c => sortedCourses.includes(c.name));
      
      if (mostPlayedData.length === 0 && sortedCourses.length > 0) {
        const placeholders = sortedCourses.map((name, i) => ({
          id: `most-${i}`,
          name,
          location: ""
        }));
        setMostPlayedCourses(placeholders);
      } else {
        setMostPlayedCourses(mostPlayedData);
      }
    } catch (error) {
      console.error("Error fetching most played courses:", error);
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

  const CourseItem = ({ course }: { course: Course }) => (
    <button
      onClick={() => handleSelectCourse(course)}
      className="w-full p-3 rounded-lg hover:bg-accent transition-colors flex items-start gap-3 text-left border"
    >
      <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{course.name}</p>
        {course.location && (
          <p className="text-sm text-muted-foreground truncate">{course.location}</p>
        )}
      </div>
    </button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Select Course
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-4 mx-4 shrink-0">
              <TabsTrigger value="search" className="text-xs">
                <Search className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="favorites" className="text-xs">
                <Star className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="recent" className="text-xs">
                <Clock className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="mostPlayed" className="text-xs">
                <TrendingUp className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="flex-1 overflow-hidden mt-0 p-4 pt-4">
              <div className="space-y-4 h-full flex flex-col">
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
                  className="w-full shrink-0"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Course
                </Button>

                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-4">
                    {filteredCourses.map((course) => (
                      <CourseItem key={course.id} course={course} />
                    ))}
                    {filteredCourses.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No courses found
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="favorites" className="flex-1 overflow-hidden mt-0 p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-4">
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
              </ScrollArea>
            </TabsContent>

            <TabsContent value="recent" className="flex-1 overflow-hidden mt-0 p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-4">
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
              </ScrollArea>
            </TabsContent>

            <TabsContent value="mostPlayed" className="flex-1 overflow-hidden mt-0 p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-4">
                  {mostPlayedCourses.length > 0 ? (
                    mostPlayedCourses.map((course) => (
                      <CourseItem key={course.id} course={course} />
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">No courses played yet</p>
                      <p className="text-sm text-muted-foreground">Your most played courses will appear here</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
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
