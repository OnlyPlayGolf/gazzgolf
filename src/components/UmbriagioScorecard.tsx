import { UmbriagioGame, UmbriagioHole } from "@/types/umbriago";
import { UmbriagioSharedScorecard } from "@/components/UmbriagioSharedScorecard";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface UmbriagioScorecardProps {
  game: UmbriagioGame;
  holes: UmbriagioHole[];
  courseHoles: CourseHole[];
  currentUserTeam?: 'A' | 'B' | null;
}

export function UmbriagioScorecard({ 
  game, 
  holes, 
  courseHoles,
}: UmbriagioScorecardProps) {

  return (
    <UmbriagioSharedScorecard
      game={game}
      holes={holes}
      courseHoles={courseHoles}
    />
  );
}
