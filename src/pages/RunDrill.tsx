import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Undo, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserDrill, DrillSession, DrillRep, DrillOutcome } from '@/types/drills';
import { PuttingBaseline, LongGameBaseline, LieType } from '@/utils/csvParser';
import { parsePuttingBaseline, parseLongGameBaseline } from '@/utils/csvParser';
import { createStrokesGainedCalculator, validateDistance } from '@/utils/strokesGained';
import { getStorageItem, setStorageItem } from '@/utils/storageManager';
import { STORAGE_KEYS } from '@/constants/app';

export default function RunDrill() {
  const { drillId } = useParams<{ drillId: string }>();
  const navigate = useNavigate();
  
  const [drill, setDrill] = useState<UserDrill | null>(null);
  const [session, setSession] = useState<DrillSession | null>(null);
  const [currentDistanceIndex, setCurrentDistanceIndex] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endLie, setEndLie] = useState<LieType | 'green'>('green');
  const [endDistance, setEndDistance] = useState('');
  const [pendingOutcome, setPendingOutcome] = useState<DrillOutcome | null>(null);
  const [puttingTable, setPuttingTable] = useState<PuttingBaseline[]>([]);
  const [longgameTable, setLonggameTable] = useState<LongGameBaseline[]>([]);
  const [calculator, setCalculator] = useState<any>(null);

  useEffect(() => {
    const loadDrill = () => {
      if (!drillId) return;
      
      const drills = getStorageItem(STORAGE_KEYS.USER_DRILLS, []);
      const foundDrill = drills.find((d: UserDrill) => d.id === drillId);
      
      if (!foundDrill) {
        toast.error('Drill not found');
        navigate('/user-drills');
        return;
      }
      
      setDrill(foundDrill);
      
      // Create new session
      const newSession: DrillSession = {
        id: Date.now().toString(),
        drillId: foundDrill.id,
        drillTitle: foundDrill.title,
        reps: [],
        totalStrokesGained: 0,
        averageStrokesGained: 0,
        startedAt: Date.now(),
        targetReps: foundDrill.targetReps
      };
      
      setSession(newSession);
    };

    loadDrill();
  }, [drillId, navigate]);

  useEffect(() => {
    const loadBaselines = async () => {
      try {
        const [puttingData, longgameData] = await Promise.all([
          parsePuttingBaseline('/src/assets/putt_baseline.csv'),
          parseLongGameBaseline('/src/assets/shot_baseline.csv')
        ]);
        
        setPuttingTable(puttingData);
        setLonggameTable(longgameData);
        setCalculator(createStrokesGainedCalculator(puttingData, longgameData));
      } catch (error) {
        console.error('Failed to load baseline data:', error);
        toast.error('Failed to load baseline data');
      }
    };

    loadBaselines();
  }, []);

  const handleOutcome = (outcome: DrillOutcome) => {
    if (outcome.type === 'holed') {
      processRep(true, 'green', 0);
    } else {
      setPendingOutcome(outcome);
      // Set default end lie based on drill type
      setEndLie(drill?.type === 'putting' ? 'green' : 'green');
      setShowEndDialog(true);
    }
  };

  const handleEndSubmit = () => {
    const distance = parseFloat(endDistance);
    if (!distance || distance <= 0) {
      toast.error('Please enter a valid end distance');
      return;
    }

    // Validate distance based on end lie
    if (endLie === 'green' && !validateDistance(distance, 'putting', puttingTable)) {
      toast.error('End distance is outside valid range for putting');
      return;
    }

    if (endLie !== 'green' && !validateDistance(distance, 'longGame', undefined, longgameTable)) {
      toast.error('End distance is outside valid range for long game');
      return;
    }

    if (distance > 200) {
      toast.error('End distance seems unusually large. Please verify.');
      return;
    }

    processRep(false, endLie, distance);
    setShowEndDialog(false);
    setEndDistance('');
    setPendingOutcome(null);
  };

  const processRep = (holed: boolean, endLieValue: LieType | 'green', endDistanceValue: number) => {
    if (!drill || !session || !calculator) return;

    const currentDistance = drill.startDistances[currentDistanceIndex];
    let sg = 0;

    try {
      sg = calculator.calculateStrokesGained(
        drill.type,
        currentDistance,
        drill.lie || 'tee', // Default to tee for putting (though not used)
        holed,
        endLieValue,
        endDistanceValue
      );
    } catch (error) {
      console.error('Error calculating strokes gained:', error);
      toast.error('Error calculating strokes gained');
      return;
    }

    const rep: DrillRep = {
      id: Date.now().toString(),
      startDistance: currentDistance,
      holed,
      endLie: endLieValue,
      endDistance: endDistanceValue,
      strokesGained: sg,
      timestamp: Date.now()
    };

    const updatedReps = [...session.reps, rep];
    const totalSG = updatedReps.reduce((sum, r) => sum + r.strokesGained, 0);
    const avgSG = totalSG / updatedReps.length;

    const updatedSession: DrillSession = {
      ...session,
      reps: updatedReps,
      totalStrokesGained: totalSG,
      averageStrokesGained: avgSG
    };

    setSession(updatedSession);
    
    // Move to next distance (cycle through)
    setCurrentDistanceIndex((prev) => (prev + 1) % drill.startDistances.length);
  };

  const undoLastRep = () => {
    if (!session || session.reps.length === 0) return;

    const updatedReps = session.reps.slice(0, -1);
    const totalSG = updatedReps.reduce((sum, r) => sum + r.strokesGained, 0);
    const avgSG = updatedReps.length > 0 ? totalSG / updatedReps.length : 0;

    const updatedSession: DrillSession = {
      ...session,
      reps: updatedReps,
      totalStrokesGained: totalSG,
      averageStrokesGained: avgSG
    };

    setSession(updatedSession);
    
    // Move back to previous distance
    setCurrentDistanceIndex((prev) => 
      prev === 0 ? drill!.startDistances.length - 1 : prev - 1
    );
  };

  const endSession = () => {
    if (!session || !drill) return;

    const completedSession: DrillSession = {
      ...session,
      completedAt: Date.now()
    };

    const sessions = getStorageItem(STORAGE_KEYS.DRILL_SESSIONS, []);
    setStorageItem(STORAGE_KEYS.DRILL_SESSIONS, [...sessions, completedSession]);

    toast.success('Session completed!');
    navigate(`/drill-results/${drill.id}`);
  };

  if (!drill || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading drill...</div>
      </div>
    );
  }

  const currentDistance = drill.startDistances[currentDistanceIndex];
  const progress = session.reps.length / drill.targetReps;

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
        {/* Progress */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {session.reps.length}/{drill.targetReps}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
        </Card>

        {/* Current Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp size={16} className="text-primary" />
              <span className="text-sm font-medium">Session Total SG</span>
            </div>
            <div className="text-2xl font-bold">
              {session.totalStrokesGained >= 0 ? '+' : ''}
              {session.totalStrokesGained.toFixed(2)}
            </div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Target size={16} className="text-primary" />
              <span className="text-sm font-medium">Avg SG/Rep</span>
            </div>
            <div className="text-2xl font-bold">
              {session.averageStrokesGained >= 0 ? '+' : ''}
              {session.averageStrokesGained.toFixed(2)}
            </div>
          </Card>
        </div>

        {/* Next Distance */}
        <Card className="p-6 text-center">
          <h2 className="text-lg font-medium mb-2">Next Distance</h2>
          <div className="text-4xl font-bold text-primary mb-4">
            {currentDistance}{drill.unit === 'feet' ? 'ft' : 'yd'}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleOutcome({ type: 'holed' })}
              variant="default"
              size="lg"
              className="h-12"
            >
              Holed
            </Button>
            
            <Button
              onClick={() => handleOutcome({ type: 'missed' })}
              variant="outline"
              size="lg"
              className="h-12"
            >
              Missed
            </Button>
          </div>
        </Card>

        {/* Last Rep Result */}
        {session.reps.length > 0 && (
          <Card className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Last Rep SG</span>
              <span className={`font-bold ${
                session.reps[session.reps.length - 1].strokesGained >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {session.reps[session.reps.length - 1].strokesGained >= 0 ? '+' : ''}
                {session.reps[session.reps.length - 1].strokesGained.toFixed(2)}
              </span>
            </div>
          </Card>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          <Button
            onClick={undoLastRep}
            variant="outline"
            disabled={session.reps.length === 0}
            className="flex-1"
          >
            <Undo size={16} className="mr-2" />
            Undo Last
          </Button>
          
          <Button
            onClick={endSession}
            variant="secondary"
            className="flex-1"
          >
            End Session
          </Button>
        </div>
      </div>

      {/* End Distance Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter End Position</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="end-lie">End Lie</Label>
              <select
                id="end-lie"
                value={endLie}
                onChange={(e) => setEndLie(e.target.value as LieType | 'green')}
                className="w-full mt-1 p-2 border border-border rounded-md bg-background"
              >
                <option value="green">Green</option>
                <option value="tee">Tee</option>
                <option value="fairway">Fairway</option>
                <option value="rough">Rough</option>
                <option value="sand">Sand</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="end-distance">
                End Distance ({endLie === 'green' ? 'feet' : 'yards'})
              </Label>
              <Input
                id="end-distance"
                value={endDistance}
                onChange={(e) => setEndDistance(e.target.value)}
                placeholder={`Distance in ${endLie === 'green' ? 'feet' : 'yards'}`}
                type="number"
                min="0.1"
                step="0.1"
                className="mt-1"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setShowEndDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEndSubmit}
                className="flex-1"
              >
                Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}