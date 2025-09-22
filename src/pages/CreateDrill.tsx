import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserDrill, DrillType } from '@/types/drills';
import { LieType } from '@/utils/csvParser';
import { setStorageItem, getStorageItem } from '@/utils/storageManager';
import { STORAGE_KEYS } from '@/constants/app';

const PRESET_PUTTING_DISTANCES = [3, 5, 8, 10, 15, 20, 25, 30];

export default function CreateDrill() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DrillType>('putting');
  const [startDistances, setStartDistances] = useState<number[]>([]);
  const [targetReps, setTargetReps] = useState(20);
  const [lie, setLie] = useState<LieType>('fairway');
  const [customDistance, setCustomDistance] = useState('');

  const handleAddPresetDistance = (distance: number) => {
    if (!startDistances.includes(distance)) {
      setStartDistances([...startDistances, distance]);
    }
  };

  const handleAddCustomDistance = () => {
    const distance = parseFloat(customDistance);
    if (distance > 0 && !startDistances.includes(distance)) {
      setStartDistances([...startDistances, distance]);
      setCustomDistance('');
    }
  };

  const handleRemoveDistance = (distance: number) => {
    setStartDistances(startDistances.filter(d => d !== distance));
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

    const drill: UserDrill = {
      id: Date.now().toString(),
      title: title.trim(),
      type,
      startDistances: [...startDistances].sort((a, b) => a - b),
      targetReps,
      unit: type === 'putting' ? 'feet' : 'yards',
      lie: type === 'longGame' ? lie : undefined,
      createdAt: Date.now()
    };

    const existingDrills = getStorageItem(STORAGE_KEYS.USER_DRILLS, []);
    setStorageItem(STORAGE_KEYS.USER_DRILLS, [...existingDrills, drill]);
    
    toast.success('Drill created successfully!');
    navigate('/user-drills');
  };

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
              min="1"
              value={targetReps}
              onChange={(e) => setTargetReps(parseInt(e.target.value) || 20)}
              className="mt-1"
            />
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="font-semibold">
            Starting Distances ({type === 'putting' ? 'feet' : 'yards'})
          </h3>
          
          {type === 'putting' && (
            <div>
              <Label className="text-sm text-muted-foreground">Preset Distances</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_PUTTING_DISTANCES.map(distance => (
                  <Button
                    key={distance}
                    variant={startDistances.includes(distance) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAddPresetDistance(distance)}
                  >
                    {distance}ft
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm text-muted-foreground">Custom Distance</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={customDistance}
                onChange={(e) => setCustomDistance(e.target.value)}
                placeholder={`Distance in ${type === 'putting' ? 'feet' : 'yards'}`}
                type="number"
                min="0.1"
                step="0.1"
              />
              <Button onClick={handleAddCustomDistance} size="icon">
                <Plus size={16} />
              </Button>
            </div>
          </div>

          {startDistances.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground">Selected Distances</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {startDistances.sort((a, b) => a - b).map(distance => (
                  <Badge key={distance} variant="secondary" className="flex items-center gap-1">
                    {distance}{type === 'putting' ? 'ft' : 'yd'}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDistance(distance)}
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