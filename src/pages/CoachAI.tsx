import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

const SHOT_AREAS = [
  { value: "putting", label: "Putting" },
  { value: "chipping", label: "Chipping" },
  { value: "pitching", label: "Pitching" },
  { value: "bunker", label: "Bunker" },
  { value: "wedges", label: "Wedges" },
  { value: "driver", label: "Driver" },
  { value: "mixed", label: "Mixed" },
] as const;

const LOCATIONS = [
  { value: "practice_green", label: "Practice green" },
  { value: "range", label: "Range" },
  { value: "course", label: "Course" },
  { value: "indoor", label: "Indoor" },
] as const;

export default function CoachAI() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const [hcp, setHcp] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [shotArea, setShotArea] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [result, setResult] = useState<{
    id: string | null;
    drill: Record<string, unknown>;
    saved?: boolean;
    hint?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMissing, setErrorMissing] = useState<string[] | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorMissing(null);
    setErrorHint(null);
    setResult(null);
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Missing or invalid authorization.");
        return;
      }
      const res = await fetch("/api/ai/coach/generate-drill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          goal: goal.trim(),
          hcpInput: hcp.trim() ? hcp.trim() : null,
          timeMinutes: timeMinutes.trim() ? Number(timeMinutes) : undefined,
          shotArea: shotArea && SHOT_AREAS.some((a) => a.value === shotArea) ? shotArea : undefined,
          location: location && LOCATIONS.some((l) => l.value === location) ? location : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          res.status === 500 &&
          typeof data?.error === "string" &&
          data.error.includes("Missing required environment variables") &&
          Array.isArray(data?.missing)
        ) {
          setError(data.error);
          setErrorMissing(data.missing);
        } else if (
          res.status === 500 &&
          typeof data?.error === "string" &&
          data.error.includes("Failed to save drill")
        ) {
          setError(data.error);
          if (typeof data?.hint === "string") setErrorHint(data.hint);
        } else {
          setError(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
        }
        return;
      }
      setResult(data as { id: string | null; drill: Record<string, unknown>; saved?: boolean; hint?: string });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setErrorMissing(null);
      setErrorHint(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Coach AI</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate drill</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal">Goal</Label>
                <Input
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. improve lag putting"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hcp">HCP (optional)</Label>
                <Input
                  id="hcp"
                  type="text"
                  inputMode="text"
                  value={hcp}
                  onChange={(e) => setHcp(e.target.value)}
                  placeholder="e.g. 18 or +2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeMinutes">Time (minutes, optional)</Label>
                <Input
                  id="timeMinutes"
                  type="number"
                  inputMode="numeric"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(e.target.value)}
                  placeholder="e.g. 30"
                />
              </div>
              <div className="space-y-2">
                <Label>Shot area (optional)</Label>
                <Select value={shotArea || "none"} onValueChange={(v) => setShotArea(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {SHOT_AREAS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location (optional)</Label>
                <Select value={location || "none"} onValueChange={(v) => setLocation(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {LOCATIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{error}</p>
                  {errorHint && (
                    <p className="text-xs text-muted-foreground">{errorHint}</p>
                  )}
                  {errorMissing && errorMissing.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Missing: {errorMissing.join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Add these to <code className="bg-muted px-1 rounded">.env.local</code> in
                        the project root (local) or Vercel Project Settings (production), then
                        restart <code className="bg-muted px-1 rounded">npx vercel dev</code>.
                      </p>
                    </>
                  )}
                </div>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Generating…" : "Generate drill"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drill</CardTitle>
              <p className="text-xs text-muted-foreground">
                {result.id != null ? `ID: ${result.id}` : "Not saved"}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.saved === false && result.hint && (
                <p className="text-xs text-muted-foreground">{result.hint}</p>
              )}
              <pre className="text-sm text-foreground bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(result.drill, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
