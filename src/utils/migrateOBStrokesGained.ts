/**
 * Migration script to fix OB shot strokes gained in historical data
 * 
 * This script:
 * 1. Fetches all pro_stats_holes with shot data
 * 2. Identifies OB shots that have strokesGained: 0
 * 3. Recalculates their strokes gained using the new calculateOBStrokesGained function
 * 4. Updates the database with corrected values
 * 
 * Run this once to fix historical data after the OB calculation fix.
 */

import { supabase } from "@/integrations/supabase/client";
import { parsePuttingBaseline, parseLongGameBaseline } from "./csvParser";
import { createStrokesGainedCalculator } from "./strokesGained";

interface Shot {
  type: 'tee' | 'approach' | 'putt';
  startDistance: number;
  startLie: string;
  holed: boolean;
  endDistance?: number;
  endLie?: string;
  strokesGained: number;
  isOB?: boolean;
}

export async function migrateOBStrokesGained() {
  console.log('Starting OB strokes gained migration...');
  
  try {
    // Load baseline data
    console.log('Loading baseline data...');
    const [puttingTable, longgameTable] = await Promise.all([
      parsePuttingBaseline('/src/assets/putt_baseline.csv'),
      parseLongGameBaseline('/src/assets/shot_baseline.csv'),
    ]);
    const calculator = createStrokesGainedCalculator(puttingTable, longgameTable);
    
    if (!calculator.calculateOBStrokesGained) {
      console.error('Calculator does not have calculateOBStrokesGained method');
      return { success: false, error: 'Calculator method not available' };
    }

    // Fetch all holes with shot data
    console.log('Fetching all pro_stats_holes...');
    const { data: holes, error: fetchError } = await supabase
      .from('pro_stats_holes')
      .select('id, pro_round_id, hole_number, pro_shot_data')
      .not('pro_shot_data', 'is', null);

    if (fetchError) {
      console.error('Error fetching holes:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!holes || holes.length === 0) {
      console.log('No holes found with shot data');
      return { success: true, updated: 0, message: 'No data to migrate' };
    }

    console.log(`Found ${holes.length} holes with shot data`);

    let updatedCount = 0;
    let errorCount = 0;
    const updates: Array<{ id: string; shots: Shot[] }> = [];

    // Process each hole
    for (const hole of holes) {
      try {
        const shots = hole.pro_shot_data as Shot[] | null;
        if (!shots || !Array.isArray(shots)) continue;

        let needsUpdate = false;
        const updatedShots = shots.map((shot) => {
          // Check if this is an OB shot with incorrect strokes gained
          const isOB = shot.isOB === true || shot.endLie === 'OB';
          const hasIncorrectSG = isOB && shot.strokesGained === 0;

          if (hasIncorrectSG) {
            needsUpdate = true;
            // Recalculate OB strokes gained
            const drillType = shot.type === 'putt' ? 'putting' : 'longGame';
            const newSG = calculator.calculateOBStrokesGained(
              drillType,
              shot.startDistance,
              shot.startLie as any
            );

            console.log(
              `Hole ${hole.hole_number}, Shot ${shot.type} from ${shot.startDistance}m: ` +
              `Updating SG from ${shot.strokesGained} to ${newSG}`
            );

            return {
              ...shot,
              strokesGained: newSG,
            };
          }

          return shot;
        });

        if (needsUpdate) {
          updates.push({
            id: hole.id,
            shots: updatedShots,
          });
        }
      } catch (error) {
        console.error(`Error processing hole ${hole.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Found ${updates.length} holes that need updating`);

    // Update database in batches
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const updatePromises = batch.map((update) =>
        supabase
          .from('pro_stats_holes')
          .update({ pro_shot_data: update.shots })
          .eq('id', update.id)
      );

      const results = await Promise.all(updatePromises);
      
      results.forEach((result, idx) => {
        if (result.error) {
          console.error(`Error updating hole ${batch[idx].id}:`, result.error);
          errorCount++;
        } else {
          updatedCount++;
        }
      });

      console.log(`Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)}`);
    }

    console.log(`Migration complete! Updated ${updatedCount} holes, ${errorCount} errors`);

    return {
      success: true,
      updated: updatedCount,
      errors: errorCount,
      total: holes.length,
    };
  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Call this function from the browser console or create a UI button to run it
 * Example: await migrateOBStrokesGained()
 */