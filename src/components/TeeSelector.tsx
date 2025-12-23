import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Standard tee options in order from longest to shortest (color-based for database compatibility)
export const STANDARD_TEE_OPTIONS = [
  { value: "black", label: "Black" },
  { value: "blue", label: "Blue" },
  { value: "white", label: "White" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
];

// Default tee names mapping (used when no course-specific names available)
const DEFAULT_TEE_NAMES: Record<string, string> = {
  black: "Black",
  blue: "Blue",
  white: "White",
  yellow: "Yellow",
  red: "Red",
};

// Standard tee order from longest to shortest
const STANDARD_TEE_ORDER = ["black", "blue", "white", "yellow", "red"];

// Default tee for men (second farthest = blue)
export const DEFAULT_MEN_TEE = "blue";

// Default tee for women (typically red or yellow)
export const DEFAULT_WOMEN_TEE = "red";

interface TeeSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  teeCount?: number;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Course-specific tee names from database, e.g., {"black": "Black", "blue": "Blue", "white": "Combo"} */
  courseTeeNames?: Record<string, string> | null;
}

export function TeeSelector({
  value,
  onValueChange,
  teeCount = 5,
  className,
  triggerClassName,
  placeholder = "Select tee",
  disabled = false,
  courseTeeNames,
}: TeeSelectorProps) {
  // Get appropriate options based on course tee names or default
  const options = getOptions(courseTeeNames);
  
  // Normalize value to ensure it matches an option
  const normalizedValue = normalizeValue(value);
  
  // Get display name for current value
  const displayName = getDisplayName(normalizedValue, courseTeeNames);
  
  return (
    <Select value={normalizedValue} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder}>
          {normalizedValue ? displayName : placeholder}
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

function getOptions(courseTeeNames?: Record<string, string> | null): { value: string; label: string }[] {
  const names = courseTeeNames || DEFAULT_TEE_NAMES;
  
  // Return options in standard order, using course-specific names
  return STANDARD_TEE_ORDER
    .filter(key => names[key]) // Only include tees that have names
    .map(key => ({
      value: key,
      label: names[key] || DEFAULT_TEE_NAMES[key] || key,
    }));
}

// Normalize legacy values (difficulty-based) to color-based system
export function normalizeValue(value: string): string {
  if (!value) return "";
  
  const lower = value.toLowerCase();
  
  // Already in color format
  if (STANDARD_TEE_ORDER.includes(lower)) {
    return lower;
  }
  
  // Map legacy difficulty names to colors
  const difficultyMap: Record<string, string> = {
    "longest": "black",
    "long": "blue",
    "medium": "white",
    "short": "yellow",
    "shortest": "red",
  };
  
  return difficultyMap[lower] || DEFAULT_MEN_TEE;
}

function getDisplayName(value: string, courseTeeNames?: Record<string, string> | null): string {
  if (!value) return "";
  const names = courseTeeNames || DEFAULT_TEE_NAMES;
  return names[value] || DEFAULT_TEE_NAMES[value] || value;
}

// Export for use in display contexts
export function getTeeDisplayName(teeValue: string, courseTeeNames?: Record<string, string> | null): string {
  if (!teeValue) return DEFAULT_TEE_NAMES[DEFAULT_MEN_TEE];
  const normalized = normalizeValue(teeValue);
  return getDisplayName(normalized, courseTeeNames);
}