import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ScorecardType = 'primary' | 'stroke_play';

interface ScorecardTypeSelectorProps {
  primaryLabel: string;
  selectedType: ScorecardType;
  onTypeChange: (type: ScorecardType) => void;
  strokePlayEnabled?: boolean;
}

export function ScorecardTypeSelector({
  primaryLabel,
  selectedType,
  onTypeChange,
  strokePlayEnabled = true,
}: ScorecardTypeSelectorProps) {
  if (!strokePlayEnabled) {
    return null;
  }

  return (
    <div className="px-4 pt-3">
      <Tabs value={selectedType} onValueChange={(v) => onTypeChange(v as ScorecardType)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="primary" className="text-xs">
            {primaryLabel}
          </TabsTrigger>
          <TabsTrigger value="stroke_play" className="text-xs">
            Stroke Play
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
