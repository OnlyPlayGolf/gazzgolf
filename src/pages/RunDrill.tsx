import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Undo, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserDrill, DrillSession, DrillRep, DrillOutcome } from '@/types/drills';
import { PuttingBaseline, LongGameBaseline, LieType } from '@/utils/csvParser';
import { parsePuttingBaseline, parseLongGameBaseline } from '@/utils/csvParser';
import { createStrokesGainedCalculator } from '@/utils/strokesGained';
import { getStorageItem, setStorageItem } from '@/utils/storageManager';
import { STORAGE_KEYS } from '@/constants/app';
import { PuttingUnit, LongGameUnit, convertFromMeters, convertLongGameFromMeters, convertToMeters, convertLongGameToMeters, getValidationRange, PUTTING_RANGE_METERS, PROXIMITY_RANGE_METERS } from '@/utils/unitConversion';

export default function RunDrill() {
  const { drillId } = useParams<{ drillId: string }>();
  const navigate = useNavigate();
  
  const [drill, setDrill] = useState<UserDrill | null>(null);
  const [session, setSession] = useState<DrillSession | null>(null);
  const [currentDistanceIndex, setCurrentDistanceIndex] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showProximityDialog, setShowProximityDialog] = useState(false);
  const [endLie, setEndLie] = useState<LieType | 'green'>('green');
  const [endDistance, setEndDistance] = useState('');
  const [proximity, setProximity] = useState('');
  const [pendingOutcome, setPendingOutcome] = useState<DrillOutcome | null>(null);
  const [puttingTable, setPuttingTable] = useState<PuttingBaseline[]>([]);
  const [longgameTable, setLonggameTable] = useState<LongGameBaseline[]>([]);
  const [calculator, setCalculator] = useState<any>(null);
  const [displayUnit, setDisplayUnit] = useState<PuttingUnit | LongGameUnit>('feet');

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
      setDisplayUnit(foundDrill.unit);
      
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
      processRep(true);
    } else if (drill?.type === 'longGame') {
      // Long game uses proximity
      setShowProximityDialog(true);
    } else {
      // Putting uses end distance
      setPendingOutcome(outcome);
      setEndLie('green'); // Always green for putting
      setShowEndDialog(true);
    }
  };

  const handleEndSubmit = () => {
    const distance = parseFloat(endDistance);
    if (!distance || distance <= 0) {
      toast.error('Please enter a valid end distance');
      return;
    }

    // Convert to meters for validation
    const metersDistance = convertToMeters(distance, displayUnit as PuttingUnit);
    
    if (metersDistance < PUTTING_RANGE_METERS.min || metersDistance > PUTTING_RANGE_METERS.max) {
      const range = getValidationRange(displayUnit as PuttingUnit, 'putting');
      const unitSymbol = displayUnit === 'meters' ? 'm' : 'ft';
      toast.error(`Please enter a distance between ${range.min.toFixed(displayUnit === 'meters' ? 2 : 1)} and ${range.max.toFixed(displayUnit === 'meters' ? 2 : 1)} ${unitSymbol}`);
      return;
    }

    processRep(false, metersDistance);
    setShowEndDialog(false);
    setEndDistance('');
    setPendingOutcome(null);
  };

  const handleProximitySubmit = () => {
    const prox = parseFloat(proximity);
    if (isNaN(prox) || prox < 0) {
      toast.error('Please enter a valid proximity');
      return;
    }

    // Convert to meters for validation
    const metersProximity = displayUnit === 'yards' 
      ? convertLongGameToMeters(prox, 'yards')
      : prox; // Already in meters
    
    if (metersProximity > PROXIMITY_RANGE_METERS.max) {
      const range = getValidationRange(displayUnit as LongGameUnit, 'proximity');
      const unitSymbol = displayUnit === 'meters' ? 'm' : 'yd';
      toast.error(`Enter proximity between 0 and ${range.max.toFixed(displayUnit === 'meters' ? 0 : 2)} ${unitSymbol}`);
      return;
    }

    processRep(false, undefined, metersProximity);
    setShowProximityDialog(false);
    setProximity('');
  };

  const processRep = (holed: boolean, endDistanceMeters?: number, proximityMeters?: number) => {
    if (!drill || !session || !calculator) return;

    const currentDistanceMeters = drill.startDistances[currentDistanceIndex];
    let sg = 0;

    try {
      if (drill.type === 'putting') {
        // For putting, endDistance is the leave distance in meters
        sg = calculator.calculateStrokesGained(
          'putting',
          currentDistanceMeters * 3.28084, // Convert to feet for baseline
          'tee', // Not used for putting
          holed,
          holed ? 'green' : 'green',
          holed ? 0 : (endDistanceMeters! * 3.28084) // Convert to feet for baseline
        );
      } else {
        // For long game, proximity is distance to hole in meters
        sg = calculator.calculateStrokesGained(
          'longGame',
          currentDistanceMeters * 1.09361, // Convert to yards for baseline
          drill.lie || 'fairway',
          proximityMeters === 0, // Holed if proximity is 0
          proximityMeters === 0 ? 'green' : 'green',
          proximityMeters === 0 ? 0 : (proximityMeters! * 3.28084) // Convert to feet for putting baseline
        );
      }
    } catch (error) {
      console.error('Error calculating strokes gained:', error);
      toast.error('Error calculating strokes gained');
      return;
    }

    const rep: DrillRep = {
      id: Date.now().toString(),
      startDistance: currentDistanceMeters,
      holed,
      endLie: drill.type === 'putting' ? 'green' : undefined,
      endDistance: endDistanceMeters,
      proximity: proximityMeters,
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

  const toggleUnit = () => {
    if (drill?.type === 'putting') {
      const newUnit = displayUnit === 'feet' ? 'meters' : 'feet';
      setDisplayUnit(newUnit);
      setStorageItem(STORAGE_KEYS.PUTTING_UNIT, newUnit);
    } else {
      const newUnit = displayUnit === 'yards' ? 'meters' : 'yards';
      setDisplayUnit(newUnit);
      setStorageItem(STORAGE_KEYS.LONGGAME_UNIT, newUnit);
    }
  };

  if (!drill || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading drill...</div>
      </div>
    );
  }

  const currentDistanceMeters = drill.startDistances[currentDistanceIndex];
  const currentDistance = drill.type === 'putting' 
    ? convertFromMeters(currentDistanceMeters, displayUnit as PuttingUnit)
    : convertLongGameFromMeters(currentDistanceMeters, displayUnit as LongGameUnit);
  
  const progress = session.reps.length / drill.targetReps;
  const unitSymbol = displayUnit === 'meters' ? 'm' : displayUnit === 'feet' ? 'ft' : 'yd';

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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleUnit}
                className="text-xs"
              >
                Unit: {unitSymbol}
              </Button>
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
            {currentDistance.toFixed(displayUnit === 'meters' ? 2 : 1)}{unitSymbol}
          </div>
          
          {drill.type === 'putting' ? (
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
          ) : (
            <Button
              onClick={() => handleOutcome({ type: 'missed' })}
              variant="default"
              size="lg"
              className="h-12 w-full"
            >
              Enter Proximity
            </Button>
          )}
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

      {/* End Distance Dialog (Putting) */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter End Distance</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="end-distance">
                End Distance ({unitSymbol})
              </Label>
              <Input
                id="end-distance"
                value={endDistance}
                onChange={(e) => setEndDistance(e.target.value)}
                placeholder={`Distance in ${displayUnit === 'meters' ? 'meters' : 'feet'}`}
                type="number"
                min="0.01"
                step="0.01"
                className="mt-1"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valid range: {getValidationRange(displayUnit as PuttingUnit, 'putting').min.toFixed(displayUnit === 'meters' ? 2 : 1)}-{getValidationRange(displayUnit as PuttingUnit, 'putting').max.toFixed(displayUnit === 'meters' ? 2 : 1)} {unitSymbol}
              </p>
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

      {/* Proximity Dialog (Long Game) */}
      <Dialog open={showProximityDialog} onOpenChange={setShowProximityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Proximity to Hole</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="proximity">
                Proximity ({unitSymbol})
              </Label>
              <Input
                id="proximity"
                value={proximity}
                onChange={(e) => setProximity(e.target.value)}
                placeholder={`Distance to hole in ${displayUnit === 'meters' ? 'meters' : 'yards'}`}
                type="number"
                min="0"
                step="0.1"
                className="mt-1"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valid range: 0-{getValidationRange(displayUnit as LongGameUnit, 'proximity').max.toFixed(displayUnit === 'meters' ? 0 : 2)} {unitSymbol}
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setShowProximityDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProximitySubmit}
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