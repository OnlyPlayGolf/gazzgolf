import { useState, useEffect } from "react";
import { Check, MapPin, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HoleData {
  holeNumber: number;
  par: number;
  distance: number | null;
  strokeIndex: number | null;
}

interface ScannedCourseData {
  courseName: string | null;
  city: string | null;
  stateOrCountry: string | null;
  isUSA: boolean;
  countryCode: string | null;
  holes: HoleData[];
}

interface Course {
  id: string;
  name: string;
  location: string;
}

interface ScorecardPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  scannedData: ScannedCourseData | null;
  onCourseAdded: (course: Course) => void;
}

// Country code to flag emoji mapping
const countryFlags: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", SE: "🇸🇪", DK: "🇩🇰", NO: "🇳🇴", FI: "🇫🇮",
  DE: "🇩🇪", FR: "🇫🇷", ES: "🇪🇸", IT: "🇮🇹", PT: "🇵🇹", NL: "🇳🇱",
  BE: "🇧🇪", CH: "🇨🇭", AT: "🇦🇹", IE: "🇮🇪", AU: "🇦🇺", NZ: "🇳🇿",
  CA: "🇨🇦", MX: "🇲🇽", JP: "🇯🇵", KR: "🇰🇷", CN: "🇨🇳", TH: "🇹🇭",
  ZA: "🇿🇦", AE: "🇦🇪", IN: "🇮🇳", SG: "🇸🇬", MY: "🇲🇾", PH: "🇵🇭",
  ID: "🇮🇩", VN: "🇻🇳", AR: "🇦🇷", BR: "🇧🇷", CL: "🇨🇱", CO: "🇨🇴",
  PL: "🇵🇱", CZ: "🇨🇿", HU: "🇭🇺", GR: "🇬🇷", TR: "🇹🇷", RU: "🇷🇺",
  SC: "🇸🇨", MU: "🇲🇺", MA: "🇲🇦", EG: "🇪🇬", KE: "🇰🇪", NG: "🇳🇬",
};

// US state codes
const usStates = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export function ScorecardPreviewDialog({ 
  isOpen, 
  onClose, 
  scannedData, 
  onCourseAdded 
}: ScorecardPreviewDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  // Editable fields
  const [courseName, setCourseName] = useState("");
  const [city, setCity] = useState("");
  const [stateOrCountry, setStateOrCountry] = useState("");
  const [isUSA, setIsUSA] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [holes, setHoles] = useState<HoleData[]>([]);

  // Initialize from scanned data when it changes
  useEffect(() => {
    if (scannedData) {
      setCourseName(scannedData.courseName || "");
      setCity(scannedData.city || "");
      setStateOrCountry(scannedData.stateOrCountry || "");
      setIsUSA(scannedData.isUSA || false);
      setCountryCode(scannedData.countryCode || "");
      
      // Initialize holes with proper defaults
      if (scannedData.holes && scannedData.holes.length > 0) {
        setHoles(scannedData.holes.map((h, idx) => ({
          holeNumber: h.holeNumber || idx + 1,
          par: h.par || 4,
          distance: h.distance,
          strokeIndex: h.strokeIndex || idx + 1
        })));
      } else {
        // Default to 18 holes if none detected
        setHoles(Array.from({ length: 18 }, (_, i) => ({
          holeNumber: i + 1,
          par: 4,
          distance: null,
          strokeIndex: i + 1
        })));
      }
    }
  }, [scannedData]);

  const getFlag = (): string => {
    if (isUSA) return "🇺🇸";
    if (countryCode && countryFlags[countryCode.toUpperCase()]) {
      return countryFlags[countryCode.toUpperCase()];
    }
    return "🏌️";
  };

  const buildLocation = (): string => {
    const parts: string[] = [];
    if (city.trim()) parts.push(city.trim());
    if (stateOrCountry.trim()) parts.push(stateOrCountry.trim());
    return parts.join(", ");
  };

  const isFormValid = (): boolean => {
    if (!courseName.trim()) return false;
    if (!city.trim()) return false;
    if (!stateOrCountry.trim()) return false;
    return true;
  };

  const updateHole = (index: number, field: keyof HoleData, value: number | null) => {
    setHoles(prev => prev.map((hole, i) => 
      i === index ? { ...hole, [field]: value } : hole
    ));
  };

  const handleSave = async () => {
    if (!isFormValid()) {
      toast({
        title: "Missing required fields",
        description: "Please fill in course name, city, and state/country",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const location = buildLocation();
      
      // Create the course
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .insert({
          name: courseName.trim(),
          location: location || null
        })
        .select()
        .single();

      if (courseError) throw courseError;

      // Insert hole data with white_distance as default tee
      const holesData = holes.map(hole => ({
        course_id: courseData.id,
        hole_number: hole.holeNumber,
        par: hole.par,
        stroke_index: hole.strokeIndex || hole.holeNumber,
        white_distance: hole.distance || null
      }));

      const { error: holesError } = await supabase
        .from("course_holes")
        .insert(holesData);

      if (holesError) throw holesError;

      toast({
        title: "Course created!",
        description: `${courseName} has been added successfully`
      });

      onCourseAdded({
        id: courseData.id,
        name: courseData.name,
        location: courseData.location || ""
      });

      onClose();
    } catch (error: any) {
      console.error("Error creating course:", error);
      toast({
        title: "Error creating course",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const calculateTotalPar = () => {
    return holes.reduce((sum, h) => sum + (h.par || 0), 0);
  };

  const calculateTotalDistance = () => {
    return holes.reduce((sum, h) => sum + (h.distance || 0), 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-primary" />
            Confirm Course Details
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            {/* Course Info Preview Card */}
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getFlag()}</span>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{courseName || "Course Name"}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {buildLocation() || "Location"}
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="course-name">Course Name *</Label>
                <Input
                  id="course-name"
                  placeholder="Enter course name"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  placeholder="Enter city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state-country">
                  {isUSA ? "State *" : "Country *"}
                </Label>
                <Input
                  id="state-country"
                  placeholder={isUSA ? "e.g. California" : "e.g. Sweden"}
                  value={stateOrCountry}
                  onChange={(e) => setStateOrCountry(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-usa"
                  checked={isUSA}
                  onChange={(e) => {
                    setIsUSA(e.target.checked);
                    if (e.target.checked) {
                      setCountryCode("US");
                    }
                  }}
                  className="w-4 h-4 rounded border-input"
                />
                <Label htmlFor="is-usa" className="text-sm cursor-pointer">
                  This is a USA course
                </Label>
              </div>

              {!isUSA && (
                <div className="space-y-2">
                  <Label htmlFor="country-code">Country Code (for flag)</Label>
                  <Input
                    id="country-code"
                    placeholder="e.g. SE, GB, ES"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                    maxLength={2}
                    className="w-24"
                  />
                </div>
              )}
            </div>

            {/* Holes Section */}
            <div className="pt-2">
              <Label className="text-base font-semibold">Hole Details ({holes.length} holes)</Label>
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-2 mt-2">
                <span>Hole</span>
                <span>Par</span>
                <span>Distance (m)</span>
                <span>HCP</span>
              </div>
            </div>

            <div className="space-y-2">
              {holes.map((hole, index) => (
                <div key={index} className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-center font-semibold text-sm bg-muted rounded-lg py-2">
                    {hole.holeNumber}
                  </div>
                  <select
                    value={hole.par}
                    onChange={(e) => updateHole(index, "par", parseInt(e.target.value))}
                    className="h-10 rounded-lg border bg-background px-2 text-sm"
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="0"
                    value={hole.distance || ""}
                    onChange={(e) => updateHole(index, "distance", parseInt(e.target.value) || null)}
                    className="h-10 text-sm"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={18}
                    value={hole.strokeIndex || ""}
                    onChange={(e) => updateHole(index, "strokeIndex", parseInt(e.target.value) || null)}
                    className="h-10 text-sm"
                  />
                </div>
              ))}

              {/* Totals Row */}
              <div className="grid grid-cols-4 gap-2 items-center pt-2 border-t">
                <div className="text-center font-bold text-sm">Total</div>
                <div className="text-center font-bold text-sm">{calculateTotalPar()}</div>
                <div className="text-center font-bold text-sm">{calculateTotalDistance()}m</div>
                <div></div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t shrink-0 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !isFormValid()} 
            className="flex-1"
          >
            {saving ? "Saving..." : "Add Course"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
