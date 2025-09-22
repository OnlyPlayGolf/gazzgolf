import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Target, TrendingUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserDrill, DrillSession } from '@/types/drills';
import { getStorageItem } from '@/utils/storageManager';
import { STORAGE_KEYS } from '@/constants/app';

export default function UserDrills() {
  const navigate = useNavigate();
  const [drills, setDrills] = useState<UserDrill[]>([]);
  const [sessions, setSessions] = useState<DrillSession[]>([]);

  useEffect(() => {
    const userDrills = getStorageItem(STORAGE_KEYS.USER_DRILLS, []);
    const drillSessions = getStorageItem(STORAGE_KEYS.DRILL_SESSIONS, []);
    setDrills(userDrills);
    setSessions(drillSessions);
  }, []);

  const getLastSessionForDrill = (drillId: string) => {
    return sessions
      .filter(session => session.drillId === drillId && session.completedAt)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
  };

  const getSessionCountForDrill = (drillId: string) => {
    return sessions.filter(session => session.drillId === drillId && session.completedAt).length;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/menu')}>
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-semibold">User Drills</h1>
          <div className="flex-1" />
          <Button onClick={() => navigate('/create-drill')} size="sm">
            <Plus size={16} className="mr-2" />
            Create
          </Button>
        </div>
      </header>

      <div className="p-4">
        {drills.length === 0 ? (
          <div className="text-center py-12">
            <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Custom Drills Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your own drills with Strokes Gained tracking
            </p>
            <Button onClick={() => navigate('/create-drill')}>
              <Plus size={16} className="mr-2" />
              Create Your First Drill
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {drills.map((drill) => {
              const lastSession = getLastSessionForDrill(drill.id);
              const sessionCount = getSessionCountForDrill(drill.id);
              
              return (
                <Card key={drill.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{drill.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">
                          {drill.type === 'putting' ? 'Putting' : 'Long Game'}
                        </Badge>
                        {drill.lie && (
                          <Badge variant="outline">{drill.lie}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <Target size={16} />
                      <span>{drill.startDistances.length} distances</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} />
                      <span>{drill.targetReps} target reps</span>
                    </div>
                  </div>
                  
                  {sessionCount > 0 && lastSession && (
                    <div className="bg-muted/50 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last Session:</span>
                        <span className="font-medium">
                          {lastSession.averageStrokesGained >= 0 ? '+' : ''}
                          {lastSession.averageStrokesGained.toFixed(2)} SG/rep
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar size={14} />
                          <span>{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {lastSession.reps.length}/{drill.targetReps} reps
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => navigate(`/run-drill/${drill.id}`)}
                    >
                      Run Drill
                    </Button>
                    {sessionCount > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/drill-results/${drill.id}`)}
                      >
                        Results
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}