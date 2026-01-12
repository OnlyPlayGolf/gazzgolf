interface GameHeaderProps {
  gameTitle: string;
  courseName: string;
  pageTitle: string;
}

export function GameHeader({ gameTitle, courseName, pageTitle }: GameHeaderProps) {
  return (
    <div>
      {/* Green header bar */}
      <div className="bg-primary px-4 py-3">
        <h1 className="text-xl font-bold text-primary-foreground">{gameTitle}</h1>
        <p className="text-sm text-primary-foreground/80">{courseName}</p>
      </div>
      {/* Page title below */}
      <div className="px-4 pt-3 pb-2">
        <span className="text-sm text-muted-foreground">{pageTitle}</span>
      </div>
    </div>
  );
}
