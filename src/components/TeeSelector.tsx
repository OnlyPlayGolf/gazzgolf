import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_TEE_OPTIONS, teeIdToDisplay } from "@/utils/teeSystem";

interface TeeSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  teeCount?: number;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function TeeSelector({
  value,
  onValueChange,
  teeCount = 5,
  className,
  triggerClassName,
  placeholder = "Select tee",
  disabled = false,
}: TeeSelectorProps) {
  // Get appropriate options based on tee count
  const options = getOptionsForCount(teeCount);
  
  // Normalize value to new system if needed
  const normalizedValue = normalizeValue(value, teeCount);
  
  return (
    <Select value={normalizedValue} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder}>
          {normalizedValue ? teeIdToDisplay(normalizedValue) : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={className}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function getOptionsForCount(teeCount: number): { value: string; label: string }[] {
  // Always show all 5 tee options to ensure users can select any tee
  // Even if a course doesn't have all tee distances, users may want to select
  // a specific difficulty level
  return DEFAULT_TEE_OPTIONS;
}

// Normalize legacy color values to new system
function normalizeValue(value: string, teeCount: number): string {
  if (!value) return "";
  
  const lower = value.toLowerCase();
  
  // Already in new format
  if (["longest", "long", "medium", "short", "shortest"].includes(lower)) {
    return lower;
  }
  
  // Map legacy colors to new system
  const colorMap: Record<string, string> = {
    "black": "longest",
    "gold": "longest", 
    "blue": "long",
    "white": "medium",
    "yellow": "short",
    "red": "shortest",
    "orange": "shortest",
  };
  
  return colorMap[lower] || "medium";
}

// Export for use in display contexts
export function getTeeDisplayName(teeValue: string): string {
  if (!teeValue) return "Medium";
  return teeIdToDisplay(teeValue);
}
