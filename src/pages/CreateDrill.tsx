import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/notify';
import { UserDrill, DrillType } from '@/types/drills';
import { LieType } from '@/utils/csvParser';
import { setStorageItem, getStorageItem } from '@/utils/storageManager';
import { STORAGE_KEYS } from '@/constants/app';
import { PuttingUnit, LongGameUnit, convertToMeters, convertLongGameToMeters, convertFromMeters, convertLongGameFromMeters } from '@/utils/unitConversion';

const PRESET_PUTTING_DISTANCES = [3, 5, 8, 10, 15, 20, 25, 30];

export default function CreateDrill() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DrillType>('putting');
  const [startDistances, setStartDistances] = useState<number[]>([]);
  const [targetReps, setTargetReps] = useState(20);
  const [targetRepsInput, setTargetRepsInput] = useState('20');
  const [lie, setLie] = useState<LieType>('fairway');
  const [customDistance, setCustomDistance] = useState('');
  const [puttingUnit, setPuttingUnit] = useState<PuttingUnit>('feet');
  const [longGameUnit, setLongGameUnit] = useState<LongGameUnit>('yards');

  useEffect(() => {
    // Load saved unit preferences
    const savedPuttingUnit = getStorageItem(STORAGE_KEYS.PUTTING_UNIT, 'feet');
    const savedLongGameUnit = getStorageItem(STORAGE_KEYS.LONGGAME_UNIT, 'yards');
    setPuttingUnit(savedPuttingUnit);
    setLongGameUnit(savedLongGameUnit);
  }, []);

  const handleAddPresetDistance = (distance: number) => {
    // Convert to meters for canonical storage
    const metersDistance = convertToMeters(distance, puttingUnit);
    if (!startDistances.find(d => Math.abs(d - metersDistance) < 0.01)) {
      setStartDistances([...startDistances, metersDistance]);
    }
  };

  const handleAddCustomDistance = () => {
    const distance = parseFloat(customDistance);
    if (distance > 0) {
      // Convert to meters for canonical storage
      const metersDistance = type === 'putting' 
        ? convertToMeters(distance, puttingUnit)
        : convertLongGameToMeters(distance, longGameUnit);
      
      if (!startDistances.find(d => Math.abs(d - metersDistance) < 0.01)) {
        setStartDistances([...startDistances, metersDistance]);
        setCustomDistance('');
      }
    }
  };

  const handleRemoveDistance = (distance: number) => {
    setStartDistances(startDistances.filter(d => Math.abs(d - distance) > 0.01));
  };

  const handleTargetRepsChange = (value: string) => {
    setTargetRepsInput(value);
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      setTargetReps(num);
    }
  };

  const handleUnitChange = (unit: PuttingUnit | LongGameUnit) => {
    if (type === 'putting') {
      setPuttingUnit(unit as PuttingUnit);
      setStorageItem(STORAGE_KEYS.PUTTING_UNIT, unit);
    } else {
      setLongGameUnit(unit as LongGameUnit);
      setStorageItem(STORAGE_KEYS.LONGGAME_UNIT, unit);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Please enter a drill title');
      return;
    }
    
    if (startDistances.length === 0) {
      toast.error('Please add at least one starting distance');
      return;
    }

    if (targetReps < 1 || targetReps > 999) {
      toast.error('Enter a whole number between 1 and 999');
      return;
    }

    const drill: UserDrill = {
      id: Date.now().toString(),
      title: title.trim(),
      type,
      startDistances: [...startDistances].sort((a, b) => a - b),
      targetReps,
      unit: type === 'putting' ? puttingUnit : longGameUnit,
      lie: type === 'longGame' ? lie : undefined,
      createdAt: Date.now()
    };

    const existingDrills = getStorageItem(STORAGE_KEYS.USER_DRILLS, []);
    setStorageItem(STORAGE_KEYS.USER_DRILLS, [...existingDrills, drill]);
    
    toast.success('Drill created successfully!');
    navigate('/user-drills');
  };

  const currentUnit = type === 'putting' ? puttingUnit : longGameUnit;
  const displayDistances = startDistances.map(d => {
    const converted = type === 'putting' 
      ? convertFromMeters(d, puttingUnit)
      : convertLongGameFromMeters(d, longGameUnit);
    return { meters: d, display: converted };
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/user-drills')}>
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-semibold">Create Drill</h1>
        </div>
      </header>

      <div className="p-4 space-y-6">
        <Card className="p-4 space-y-4">
          <div>
            <Label htmlFor="title">Drill Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter drill name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="type">Drill Type</Label>
            <Select value={type} onValueChange={(value: DrillType) => {
              setType(value);
              setStartDistances([]); // Reset distances when type changes
            }}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="putting">Putting</SelectItem>
                <SelectItem value="longGame">Long Game</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="unit">Unit</Label>
            <Select value={currentUnit} onValueChange={handleUnitChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {type === 'putting' ? (
                  <>
                    <SelectItem value="meters">Meters (m)</SelectItem>
                    <SelectItem value="feet">Feet (ft)</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="meters">Meters (m)</SelectItem>
                    <SelectItem value="yards">Yards (yd)</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {type === 'longGame' && (
            <div>
              <Label htmlFor="lie">Lie Condition</Label>
              <Select value={lie} onValueChange={(value: LieType) => setLie(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tee">Tee</SelectItem>
                  <SelectItem value="fairway">Fairway</SelectItem>
                  <SelectItem value="rough">Rough</SelectItem>
                  <SelectItem value="sand">Sand</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="targetReps">Target Reps</Label>
            <Input
              id="targetReps"
              type="number"
              min={1}
              max={999}
              step={1}
              value={targetRepsInput}
              onChange={(e) => handleTargetRepsChange(e.target.value)}
              placeholder="Enter target reps"
              className="mt-1"
            />
            {(targetReps < 1 || targetReps > 999) && targetRepsInput && (
              <p className="text-sm text-destructive mt-1">Enter a whole number between 1 and 999</p>
            )}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="font-semibold">
            Starting Distances ({currentUnit === 'meters' ? 'm' : currentUnit === 'feet' ? 'ft' : 'yd'})
          </h3>
          
          {type === 'putting' && (
            <div>
              <Label className="text-sm text-muted-foreground">Preset Distances</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_PUTTING_DISTANCES.map(distance => {
                  const metersDistance = convertToMeters(distance, puttingUnit);
                  const isSelected = startDistances.find(d => Math.abs(d - metersDistance) < 0.01);
                  return (
                    <Button
                      key={distance}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleAddPresetDistance(distance)}
                    >
                      {distance}{currentUnit === 'meters' ? 'm' : 'ft'}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm text-muted-foreground">Custom Distance</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={customDistance}
                onChange={(e) => setCustomDistance(e.target.value)}
                placeholder={`Distance in ${currentUnit === 'meters' ? 'meters' : currentUnit === 'feet' ? 'feet' : 'yards'}`}
                type="number"
                min="0.1"
                step="0.1"
              />
              <Button onClick={handleAddCustomDistance} size="icon">
                <Plus size={16} />
              </Button>
            </div>
          </div>

          {displayDistances.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground">Selected Distances</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {displayDistances.sort((a, b) => a.display - b.display).map(({ meters, display }) => (
                  <Badge key={meters} variant="secondary" className="flex items-center gap-1">
                    {display.toFixed(currentUnit === 'meters' ? 2 : 1)}{currentUnit === 'meters' ? 'm' : currentUnit === 'feet' ? 'ft' : 'yd'}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDistance(meters)}
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X size={12} />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Button onClick={handleSave} className="w-full" size="lg">
          Create Drill
        </Button>
      </div>
    </div>
  );
}