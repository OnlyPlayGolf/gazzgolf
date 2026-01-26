import { useState } from "react";
import { Info, Sparkles, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PlaySetupState } from "@/types/playSetup";
import { cn } from "@/lib/utils";
import { CourseSelectionDialog } from "@/components/CourseSelectionDialog";
import { AISetupAssistant } from "@/components/AISetupAssistant";
import { GameConfiguration } from "@/types/gameConfig";
import { STANDARD_TEE_OPTIONS } from "@/components/TeeSelector";

interface Course {
  id: string;
  name: string;
  location: string;
  tee_names?: Record<string, string> | null;
}

interface PlayStep1Props {
  setupState: PlaySetupState;
  setSetupState: React.Dispatch<React.SetStateAction<PlaySetupState>>;
  selectedCourse: Course | null;
  setSelectedCourse: (course: Course | null) => void;
  showCourseDialog: boolean;
  setShowCourseDialog: (open: boolean) => void;
  settingsExpanded: boolean;
  setSettingsExpanded: (expanded: boolean) => void;
  courseHoles: { holeNumber: number; par: number; strokeIndex: number }[];
  courseTeeNames: Record<string, string> | null;
  onApplyAIConfig: (config: GameConfiguration) => void;
  saveState: () => void;
  onNext: () => void;
}

export function PlayStep1({
  setupState,
  setSetupState,
  selectedCourse,
  setSelectedCourse,
  showCourseDialog,
  setShowCourseDialog,
  settingsExpanded,
  setSettingsExpanded,
  courseHoles,
  courseTeeNames,
  onApplyAIConfig,
  saveState,
  onNext,
}: PlayStep1Props) {
  const navigate = useNavigate();
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const getHolesPlayed = (holeCount: string): number => {
    switch (holeCount) {
      case "front9": return 9;
      case "back9": return 9;
      default: return 18;
    }
  };

  return (
    <>
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        {/* Course Selection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Course</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Course
              </Label>
              {!selectedCourse ? (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowCourseDialog(true)}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Select a course...
                </Button>
              ) : (
                <div className="p-3 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{selectedCourse.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedCourse.location}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowCourseDialog(true)}>
                      Change
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Holes Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Holes</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["18", "front9", "back9"] as const).map((holes) => (
                  <button
                    key={holes}
                    onClick={() => setSetupState(prev => ({ ...prev, selectedHoles: holes }))}
                    className={cn(
                      "p-2.5 rounded-lg border-2 text-center transition-all text-sm font-medium",
                      setupState.selectedHoles === holes
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {holes === "18" ? "Full 18" : holes === "front9" ? "Front 9" : "Back 9"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Game Formats */}
        <Collapsible open={settingsExpanded} onOpenChange={setSettingsExpanded}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Game Formats</CardTitle>
                  {settingsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Game Format */}
                <div className="space-y-3">
                  {/* Individual Games */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Individual</p>
                    {[
                      { id: "stroke_play", label: "Stroke Play", desc: "Standard scoring" },
                      { id: "match_play", label: "Match Play", desc: "1v1 hole-by-hole" },
                      { id: "skins", label: "Skins", desc: "Win holes for skins" },
                      { id: "copenhagen", label: "Copenhagen", desc: "3 players, 6-point game" },
                    ].map((fmt) => (
                      <div key={fmt.id} className="relative">
                        <button
                          onClick={() => setSetupState(prev => ({ ...prev, gameFormat: fmt.id as any }))}
                          className={cn(
                            "w-full p-3 rounded-lg border-2 text-left transition-all pr-12",
                            setupState.gameFormat === fmt.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <p className="font-semibold text-sm">{fmt.label}</p>
                          <p className="text-xs text-muted-foreground">{fmt.desc}</p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveState();
                            if (fmt.id === "stroke_play") navigate('/stroke-play/how-to-play');
                            else if (fmt.id === "match_play") navigate('/match-play/how-to-play');
                            else if (fmt.id === "skins") navigate('/skins/how-to-play');
                            else navigate('/copenhagen/how-to-play');
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted"
                        >
                          <Info size={16} className="text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Team Games */}
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Teams</p>
                    {[
                      { id: "best_ball", label: "Best Ball", desc: "Team match play or stroke play" },
                      { id: "scramble", label: "Scramble", desc: "Team plays best shot" },
                      { id: "umbriago", label: "Umbriago", desc: "2v2 team game" },
                      { id: "wolf", label: "🐺 Wolf", desc: "4-6 players, various teams" },
                    ].map((fmt) => (
                      <div key={fmt.id} className="relative">
                        <button
                          onClick={() => setSetupState(prev => ({ ...prev, gameFormat: fmt.id as any }))}
                          className={cn(
                            "w-full p-3 rounded-lg border-2 text-left transition-all pr-12",
                            setupState.gameFormat === fmt.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <p className="font-semibold text-sm">{fmt.label}</p>
                          <p className="text-xs text-muted-foreground">{fmt.desc}</p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveState();
                            if (fmt.id === "best_ball") navigate('/best-ball/how-to-play');
                            else if (fmt.id === "scramble") navigate('/scramble/how-to-play');
                            else if (fmt.id === "wolf") navigate('/wolf/how-to-play');
                            else navigate('/umbriago/how-to-play');
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted"
                        >
                          <Info size={16} className="text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Next Button */}
        <div className="space-y-2">
          <Button
            onClick={() => {
              saveState();
              onNext();
            }}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            Next
          </Button>
        </div>
      </div>

      {/* AI Assistant FAB */}
      <Button
        onClick={() => setShowAIAssistant(true)}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <Sparkles className="w-6 h-6" />
      </Button>

      {/* Dialogs */}
      <AISetupAssistant
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        courseInfo={selectedCourse ? {
          courseName: selectedCourse.name,
          availableTees: courseTeeNames
            ? ["black", "blue", "white", "yellow", "red"].filter(k => courseTeeNames[k]).map(k => courseTeeNames[k])
            : STANDARD_TEE_OPTIONS.map(t => t.label),
          defaultHoles: getHolesPlayed(setupState.selectedHoles),
          courseHoles,
        } : undefined}
        onApplyConfig={onApplyAIConfig}
      />

      <CourseSelectionDialog
        isOpen={showCourseDialog}
        onClose={() => setShowCourseDialog(false)}
        onSelectCourse={(course) => {
          setSelectedCourse(course);
          setShowCourseDialog(false);
        }}
      />
    </>
  );
}
