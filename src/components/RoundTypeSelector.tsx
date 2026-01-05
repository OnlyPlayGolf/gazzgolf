import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RoundType = "fun_practice" | "qualifying" | "tournament";

interface RoundTypeSelectorProps {
  value: RoundType;
  onChange: (value: RoundType) => void;
}

const roundTypeOptions: { value: RoundType; label: string }[] = [
  { value: "fun_practice", label: "Fun/Practice" },
  { value: "qualifying", label: "Qualifying" },
  { value: "tournament", label: "Tournament" },
];

export const RoundTypeSelector = ({ value, onChange }: RoundTypeSelectorProps) => {
  return (
    <div className="space-y-2">
      <Label>Round Type</Label>
      <Select value={value} onValueChange={(v) => onChange(v as RoundType)}>
        <SelectTrigger>
          <SelectValue placeholder="Select round type" />
        </SelectTrigger>
        <SelectContent>
          {roundTypeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
