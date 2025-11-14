import WedgesProgressionComponent from "@/components/drills/WedgesProgressionComponent";

interface WedgesProgressionScoreProps {
  onTabChange?: (tab: string) => void;
}

export default function WedgesProgressionScore({ onTabChange }: WedgesProgressionScoreProps) {
  return <WedgesProgressionComponent onTabChange={onTabChange} />;
}
