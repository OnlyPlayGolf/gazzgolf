import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Standard tee options in order from longest to shortest (color-based for database compatibility)
export const STANDARD_TEE_OPTIONS = [
  { value: "black", label: "Black" },
  { value: "blue", label: "Blue" },
  { value: "white", label: "White" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
  { value: "orange", label: "Orange" },
];

// Default tee names mapping (used when no course-specific names available)
const DEFAULT_TEE_NAMES: Record<string, string> = {
  black: "Black",
  blue: "Blue",
  white: "White",
  silver: "Silver",
  gold: "Gold",
  yellow: "Yellow",
  red: "Red",
  orange: "Orange",
};

// Standard tee order from longest to shortest
const STANDARD_TEE_ORDER = ["black", "blue", "white", "silver", "gold", "yellow", "red", "orange"];

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
  /** Course-specific tee names from database - can be array ["Black", "Blue"] or object {"black": "Black"} */
  courseTeeNames?: Record<string, string> | string[] | null;
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
  
  // Extract available tee names for normalization
  const availableTees = options.map(opt => opt.value);
  
  // Normalize value to ensure it matches an option
  const normalizedValue = normalizeValue(value, availableTees);
  
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

// Normalize courseTeeNames to Record<string, string> format
function normalizeCourseTeeNames(courseTeeNames?: Record<string, string> | string[] | null): Record<string, string> | null {
  if (!courseTeeNames) return null;
  
  // If it's an array, convert to Record
  if (Array.isArray(courseTeeNames)) {
    const normalized: Record<string, string> = {};
    courseTeeNames.forEach((name: string) => {
      normalized[name.toLowerCase()] = name;
    });
    return normalized;
  }
  
  // Already a Record
  return courseTeeNames;
}

function getOptions(courseTeeNames?: Record<string, string> | string[] | null): { value: string; label: string }[] {
  const normalizedNames = normalizeCourseTeeNames(courseTeeNames);
  
  if (!normalizedNames) {
    return STANDARD_TEE_ORDER.map(key => ({
      value: key,
      label: DEFAULT_TEE_NAMES[key] || key,
    }));
  }
  
  // Normalize keys to lowercase for matching
  const lowerCaseNames: Record<string, string> = {};
  Object.entries(normalizedNames).forEach(([key, value]) => {
    lowerCaseNames[key.toLowerCase()] = value;
  });
  
  // Build options from course tee names, maintaining standard order for known tees
  const orderedOptions: { value: string; label: string }[] = [];
  
  // First add tees in standard order
  STANDARD_TEE_ORDER.forEach(key => {
    if (lowerCaseNames[key]) {
      orderedOptions.push({
        value: key,
        label: lowerCaseNames[key],
      });
    }
  });
  
  // Then add any custom tees not in standard order
  Object.entries(lowerCaseNames).forEach(([key, label]) => {
    if (!STANDARD_TEE_ORDER.includes(key) && !orderedOptions.some(opt => opt.value === key)) {
      orderedOptions.push({ value: key, label });
    }
  });
  
  // If no options were matched (all custom names), just return all of them
  if (orderedOptions.length === 0) {
    return Object.entries(lowerCaseNames).map(([key, label]) => ({ value: key, label }));
  }
  
  return orderedOptions;
}

// Normalize legacy values (difficulty-based) to color-based system
export function normalizeValue(value: string, availableTees?: string[]): string {
  if (!value) return "";
  
  const lower = value.toLowerCase();
  
  // Already in color format
  if (STANDARD_TEE_ORDER.includes(lower)) {
    return lower;
  }
  
  // If we have available tees, map difficulty preference to actual tee
  if (availableTees && availableTees.length > 0) {
    const difficultyPreferences = ["longest", "long", "medium", "short", "shortest"];
    if (difficultyPreferences.includes(lower)) {
      const total = availableTees.length;
      if (lower === "longest") return availableTees[0].toLowerCase();
      if (lower === "shortest") return availableTees[total - 1].toLowerCase();
      if (lower === "long") return availableTees[Math.min(1, total - 1)].toLowerCase();
      if (lower === "short") return availableTees[Math.max(0, total - 2)].toLowerCase();
      if (lower === "medium") return availableTees[Math.floor(total / 2)].toLowerCase();
    }
    
    // Check if the value matches an available tee
    const matchingTee = availableTees.find(t => t.toLowerCase() === lower);
    if (matchingTee) return matchingTee.toLowerCase();
  }
  
  // Map legacy difficulty names to colors (fallback)
  const difficultyMap: Record<string, string> = {
    "longest": "black",
    "long": "blue",
    "medium": "white",
    "short": "yellow",
    "shortest": "red",
  };
  
  return difficultyMap[lower] || DEFAULT_MEN_TEE;
}

function getDisplayName(value: string, courseTeeNames?: Record<string, string> | string[] | null): string {
  if (!value) return "";
  
  const normalizedNames = normalizeCourseTeeNames(courseTeeNames);
  
  if (normalizedNames) {
    // Normalize keys to lowercase for matching
    const lowerCaseNames: Record<string, string> = {};
    Object.entries(normalizedNames).forEach(([key, val]) => {
      lowerCaseNames[key.toLowerCase()] = val;
    });
    return lowerCaseNames[value.toLowerCase()] || DEFAULT_TEE_NAMES[value] || value;
  }
  
  return DEFAULT_TEE_NAMES[value] || value;
}

// Export for use in display contexts
export function getTeeDisplayName(teeValue: string, courseTeeNames?: Record<string, string> | string[] | null): string {
  if (!teeValue) return DEFAULT_TEE_NAMES[DEFAULT_MEN_TEE];
  const normalized = normalizeValue(teeValue);
  return getDisplayName(normalized, courseTeeNames);
}