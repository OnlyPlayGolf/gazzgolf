import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlaySetupState, RoundType } from "@/types/playSetup";
import { TeeSelector } from "@/components/TeeSelector";
import { CourseScorecard } from "@/components/CourseScorecard";
import { AIConfigSummary } from "@/components/play/AIConfigSummary";

interface Course {
  id: string;
  name: string;
  location: string;
  tee_names?: Record<string, string> | null;
}

interface PlayStep3Props {
  setupState: PlaySetupState;
  setSetupState: React.Dispatch<React.SetStateAction<PlaySetupState>>;
  selectedCourse: Course | null;
  numberOfRoundsText: string;
  setNumberOfRoundsText: (text: string) => void;
  availableCourseTees: string[];
  courseTeeNames: Record<string, string> | null;
  datePopoverOpen: boolean;
  setDatePopoverOpen: (open: boolean) => void;
  handleDefaultTeeChange: (tee: string) => void;
  playerValidationError: string | null;
  loading: boolean;
  onBack: () => void;
  onStartRound: () => void;
}

export function PlayStep3({
  setupState,
  setSetupState,
  selectedCourse,
  numberOfRoundsText,
  setNumberOfRoundsText,
  availableCourseTees,
  courseTeeNames,
  datePopoverOpen,
  setDatePopoverOpen,
  handleDefaultTeeChange,
  playerValidationError,
  loading,
  onBack,
  onStartRound,
}: PlayStep3Props) {
  return (
    <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
      {/* Header Card - Round Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Round Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Round Name & Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Round Name</Label>
              <Input
                value={setupState.roundName}
                onChange={(e) => setSetupState(prev => ({ ...prev, roundName: e.target.value }))}
                placeholder="Round 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(new Date(setupState.datePlayed + 'T12:00:00'), "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={new Date(setupState.datePlayed + 'T12:00:00')}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setSetupState(prev => ({ 
                          ...prev, 
                          datePlayed: `${year}-${month}-${day}`
                        }));
                        setDatePopoverOpen(false);
                      }
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Number of Rounds (Stroke Play only) */}
          {setupState.gameFormat === "stroke_play" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Number of Rounds</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={numberOfRoundsText}
                onChange={(e) => {
                  const nextRaw = e.target.value;
                  // Allow empty while typing; allow digits only
                  if (nextRaw !== "" && !/^\d+$/.test(nextRaw)) return;

                  setNumberOfRoundsText(nextRaw);

                  const parsed = nextRaw ? parseInt(nextRaw, 10) : NaN;
                  if (Number.isFinite(parsed) && parsed > 0) {
                    setSetupState(prev => ({ ...prev, numberOfRounds: parsed }));
                  }
                }}
                onBlur={() => {
                  const raw = numberOfRoundsText.trim();
                  const parsed = raw ? parseInt(raw, 10) : NaN;
                  const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                  setNumberOfRoundsText(String(next));
                  setSetupState(prev => ({ ...prev, numberOfRounds: next }));
                }}
              />
            </div>
          )}

          {/* Round Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Round Type</Label>
            <Select 
              value={setupState.roundType} 
              onValueChange={(v) => setSetupState(prev => ({ ...prev, roundType: v as RoundType }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select round type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fun_practice">Fun/Practice</SelectItem>
                <SelectItem value="qualifying">Qualifying</SelectItem>
                <SelectItem value="tournament">Tournament</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tee Selection (course-specific) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tees</Label>
            <TeeSelector
              value={setupState.teeColor}
              onValueChange={(tee) => handleDefaultTeeChange(tee)}
              teeCount={availableCourseTees.length || 5}
              courseTeeNames={courseTeeNames}
              triggerClassName="w-full justify-between"
              disabled={!selectedCourse}
            />
          </div>
        </CardContent>
      </Card>

      {/* Course Scorecard */}
      {selectedCourse && (
        <CourseScorecard
          courseId={selectedCourse.id}
          selectedTee={setupState.teeColor}
          selectedHoles={setupState.selectedHoles === "custom" ? "18" : setupState.selectedHoles}
        />
      )}

      {/* AI Config Summary */}
      <AIConfigSummary
        isApplied={setupState.aiConfigApplied}
        summary={setupState.aiConfigSummary}
        assumptions={setupState.aiAssumptions}
      />

      {/* Navigation and Start Button */}
      <div className="space-y-2">
        {playerValidationError && (
          <p className="text-sm text-destructive text-center">{playerValidationError}</p>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex-1 h-12 text-base font-semibold"
            size="lg"
          >
            Back
          </Button>
          <Button
            onClick={onStartRound}
            disabled={loading || !selectedCourse || !!playerValidationError}
            className="flex-1 h-12 text-base font-semibold"
            size="lg"
          >
            {loading ? "Starting..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
