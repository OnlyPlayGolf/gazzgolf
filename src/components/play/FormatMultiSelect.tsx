import { Info, Check, Settings, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { GameFormatId, GAME_FORMATS, FormatSettings } from "@/types/playSetup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FormatMultiSelectProps {
  selectedFormats: GameFormatId[];
  primaryFormat?: GameFormatId;
  onToggleFormat: (formatId: GameFormatId) => void;
  onSetPrimary: (formatId: GameFormatId) => void;
  onOpenSettings: (formatId: GameFormatId) => void;
  onOpenInfo: (formatId: GameFormatId) => void;
}

export function FormatMultiSelect({
  selectedFormats,
  primaryFormat,
  onToggleFormat,
  onSetPrimary,
  onOpenSettings,
  onOpenInfo,
}: FormatMultiSelectProps) {
  return (
    <div className="space-y-2">
      {GAME_FORMATS.map((fmt) => {
        const isSelected = selectedFormats.includes(fmt.id);
        const isPrimary = primaryFormat === fmt.id;
        
        return (
          <div key={fmt.id} className="relative">
            <button
              onClick={() => onToggleFormat(fmt.id)}
              className={cn(
                "w-full p-3 rounded-lg border-2 text-left transition-all pr-24",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                )}>
                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{fmt.label}</p>
                    {isPrimary && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{fmt.description}</p>
                </div>
              </div>
            </button>
            
            {/* Action buttons */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isSelected && !isPrimary && selectedFormats.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPrimary(fmt.id);
                  }}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Set as primary"
                >
                  <Star size={14} />
                </button>
              )}
              {isSelected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSettings(fmt.id);
                  }}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Format settings"
                >
                  <Settings size={14} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenInfo(fmt.id);
                }}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                title="How to play"
              >
                <Info size={14} />
              </button>
            </div>
          </div>
        );
      })}
      
      {selectedFormats.length > 1 && (
        <p className="text-xs text-muted-foreground mt-2">
          {selectedFormats.length} formats selected. Scores entered once, calculated for all formats.
        </p>
      )}
    </div>
  );
}