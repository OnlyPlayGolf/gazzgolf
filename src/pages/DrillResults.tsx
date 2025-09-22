import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Target, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserDrill, DrillSession } from '@/types/drills';
import { getStorageItem } from '@/utils/storageManager';
import { STORAGE_KEYS } from '@/constants/app';

export default function DrillResults() {
  const { drillId } = useParams<{ drillId: string }>();
  const navigate = useNavigate();
  
  const [drill, setDrill] = useState<UserDrill | null>(null);
  const [sessions, setSessions] = useState<DrillSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<DrillSession | null>(null);

  useEffect(() => {
    if (!drillId) return;
    
    const drills = getStorageItem(STORAGE_KEYS.USER_DRILLS, []);
    const foundDrill = drills.find((d: UserDrill) => d.id === drillId);
    
    if (!foundDrill) {
      navigate('/user-drills');
      return;
    }
    
    const allSessions = getStorageItem(STORAGE_KEYS.DRILL_SESSIONS, []);
    const drillSessions = allSessions
      .filter((s: DrillSession) => s.drillId === drillId && s.completedAt)
      .sort((a: DrillSession, b: DrillSession) => (b.completedAt || 0) - (a.completedAt || 0));
    
    setDrill(foundDrill);
    setSessions(drillSessions);
    
    if (drillSessions.length > 0) {
      setSelectedSession(drillSessions[0]); // Most recent session
    }
  }, [drillId, navigate]);

  if (!drill) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading results...</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="bg-card border-b border-border sticky top-0 z-40">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/user-drills')}>
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-xl font-semibold">{drill.title} - Results</h1>
          </div>
        </header>
        
        <div className="p-4 text-center py-12">
          <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Sessions Yet</h3>
          <p className="text-muted-foreground mb-6">
            Complete a drill session to see your results
          </p>
          <Button onClick={() => navigate(`/run-drill/${drill.id}`)}>
            Run Drill
          </Button>
        </div>
      </div>
    );
  }

  // Group reps by starting distance
  const getRepsByDistance = (session: DrillSession) => {
    const grouped = session.reps.reduce((acc, rep) => {
      const distance = rep.startDistance;
      if (!acc[distance]) {
        acc[distance] = [];
      }
      acc[distance].push(rep);
      return acc;
    }, {} as Record<number, typeof session.reps>);
    
    return Object.entries(grouped).map(([distance, reps]) => ({
      distance: parseFloat(distance),
      reps,
      avgSG: reps.reduce((sum, rep) => sum + rep.strokesGained, 0) / reps.length,
      totalSG: reps.reduce((sum, rep) => sum + rep.strokesGained, 0)
    })).sort((a, b) => a.distance - b.distance);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/user-drills')}>
            <ArrowLeft size={24} />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{drill.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {drill.type === 'putting' ? 'Putting' : 'Long Game'}
              </Badge>
              {drill.lie && <Badge variant="outline">{drill.lie}</Badge>}
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Session Selector */}
        {sessions.length > 1 && (
          <Card className="p-4">
            <h3 className="font-medium mb-3">Select Session</h3>
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    selectedSession?.id === session.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted/50 border-border hover:bg-muted'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span className="text-sm">
                        {new Date(session.completedAt!).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-medium">
                      {session.averageStrokesGained >= 0 ? '+' : ''}
                      {session.averageStrokesGained.toFixed(2)} SG/rep
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {selectedSession && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-primary" />
                  <span className="text-sm font-medium">Total SG</span>
                </div>
                <div className="text-3xl font-bold">
                  {selectedSession.totalStrokesGained >= 0 ? '+' : ''}
                  {selectedSession.totalStrokesGained.toFixed(2)}
                </div>
              </Card>
              
              <Card className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Target size={16} className="text-primary" />
                  <span className="text-sm font-medium">Avg SG/Rep</span>
                </div>
                <div className="text-3xl font-bold">
                  {selectedSession.averageStrokesGained >= 0 ? '+' : ''}
                  {selectedSession.averageStrokesGained.toFixed(2)}
                </div>
              </Card>
            </div>

            {/* Session Info */}
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Reps Completed:</span>
                  <span className="font-medium ml-2">
                    {selectedSession.reps.length}/{drill.targetReps}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium ml-2">
                    {new Date(selectedSession.completedAt!).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>

            {/* Distance Breakdown */}
            <Card className="p-4">
              <h3 className="font-medium mb-4">Breakdown by Distance</h3>
              <div className="space-y-3">
                {getRepsByDistance(selectedSession).map(({ distance, reps, avgSG, totalSG }) => (
                  <div key={distance} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">
                        {distance}{drill.unit === 'feet' ? 'ft' : 'yd'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {reps.length} reps
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Avg SG:</span>
                        <span className={`font-medium ml-2 ${avgSG >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {avgSG >= 0 ? '+' : ''}{avgSG.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total SG:</span>
                        <span className={`font-medium ml-2 ${totalSG >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {totalSG >= 0 ? '+' : ''}{totalSG.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Detailed Results Table */}
            <Card className="p-4">
              <h3 className="font-medium mb-4">Detailed Results</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Start</TableHead>
                      <TableHead>Holed?</TableHead>
                      <TableHead>Leave</TableHead>
                      <TableHead className="text-right">SG</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSession.reps.map((rep, index) => (
                      <TableRow key={rep.id}>
                        <TableCell>
                          {rep.startDistance}{drill.unit === 'feet' ? 'ft' : 'yd'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rep.holed ? "default" : "secondary"}>
                            {rep.holed ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rep.holed ? '—' : `${rep.leaveDistance}ft`}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          rep.strokesGained >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {rep.strokesGained >= 0 ? '+' : ''}{rep.strokesGained.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}

        {/* Action Buttons */}
        <Button 
          onClick={() => navigate(`/run-drill/${drill.id}`)}
          className="w-full" 
          size="lg"
        >
          Run Another Session
        </Button>
      </div>
    </div>
  );
}