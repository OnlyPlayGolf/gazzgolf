import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GameFormatId, FormatSettings, GAME_FORMATS } from "@/types/playSetup";
import { Button } from "@/components/ui/button";

interface FormatSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  formatId: GameFormatId | null;
  settings: FormatSettings | null;
  onSave: (settings: FormatSettings) => void;
}

export function FormatSettingsSheet({
  isOpen,
  onClose,
  formatId,
  settings,
  onSave,
}: FormatSettingsSheetProps) {
  const formatInfo = GAME_FORMATS.find(f => f.id === formatId);
  
  if (!formatId || !settings) return null;

  const handleUpdate = (updates: Partial<FormatSettings>) => {
    onSave({ ...settings, ...updates });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh]">
        <SheetHeader>
          <SheetTitle>{formatInfo?.label} Settings</SheetTitle>
        </SheetHeader>
        
        <div className="py-4 space-y-6">
          {/* Stroke Play / Stableford Settings */}
          {(formatId === "stroke_play" || formatId === "stableford") && (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="handicap">Use Handicaps</Label>
                <Switch
                  id="handicap"
                  checked={settings.handicapEnabled ?? false}
                  onCheckedChange={(checked) => handleUpdate({ handicapEnabled: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="gimmes">Allow Gimmes</Label>
                <Switch
                  id="gimmes"
                  checked={settings.gimmesEnabled ?? false}
                  onCheckedChange={(checked) => handleUpdate({ gimmesEnabled: checked })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Mulligans Per Player</Label>
                <Select
                  value={String(settings.mulligansPerPlayer ?? 0)}
                  onValueChange={(val) => handleUpdate({ mulligansPerPlayer: parseInt(val) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 5, 9, 18].map(n => (
                      <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Umbriago Settings */}
          {formatId === "umbriago" && (
            <>
              <div className="space-y-2">
                <Label>Rolls Per Team</Label>
                <Select
                  value={String(settings.rollsPerTeam ?? 1)}
                  onValueChange={(val) => handleUpdate({ rollsPerTeam: parseInt(val) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Team Rotation</Label>
                <Select
                  value={settings.teamRotation ?? "none"}
                  onValueChange={(val) => handleUpdate({ teamRotation: val as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Rotation</SelectItem>
                    <SelectItem value="every9">Every 9 Holes</SelectItem>
                    <SelectItem value="every6">Every 6 Holes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Wolf Settings */}
          {formatId === "wolf" && (
            <>
              <div className="space-y-2">
                <Label>Wolf Tees Off</Label>
                <Select
                  value={settings.wolfPosition ?? "last"}
                  onValueChange={(val) => handleUpdate({ wolfPosition: val as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">First</SelectItem>
                    <SelectItem value="last">Last</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Lone Wolf Win</Label>
                  <Select
                    value={String(settings.loneWolfWinPoints ?? 3)}
                    onValueChange={(val) => handleUpdate({ loneWolfWinPoints: parseInt(val) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} pts</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lone Wolf Loss</Label>
                  <Select
                    value={String(settings.loneWolfLossPoints ?? 1)}
                    onValueChange={(val) => handleUpdate({ loneWolfLossPoints: parseInt(val) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} pts</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Team Win</Label>
                  <Select
                    value={String(settings.teamWinPoints ?? 1)}
                    onValueChange={(val) => handleUpdate({ teamWinPoints: parseInt(val) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} pts</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Copenhagen Settings */}
          {formatId === "copenhagen" && (
            <div className="flex items-center justify-between">
              <Label htmlFor="copenhagen-hcp">Use Handicaps</Label>
              <Switch
                id="copenhagen-hcp"
                checked={settings.useHandicaps ?? false}
                onCheckedChange={(checked) => handleUpdate({ useHandicaps: checked })}
              />
            </div>
          )}

          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}