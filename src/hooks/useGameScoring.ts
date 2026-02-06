import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Universal scoring engine for all game formats.
 * Provides consistent save/load/navigate behavior across:
 * - Match Play
 * - Copenhagen
 * - Skins
 * - Wolf
 * - Best Ball
 * - Umbriago
 * - Scramble
 */

export interface CourseHoleData {
  hole_number: number;
  par: number;
  stroke_index?: number;
  white_distance?: number | null;
  yellow_distance?: number | null;
  blue_distance?: number | null;
  red_distance?: number | null;
  black_distance?: number | null;
  gold_distance?: number | null;
  orange_distance?: number | null;
  silver_distance?: number | null;
}

export interface GameScoringConfig<TGame, THole, TScores> {
  gameId: string;
  gameTable: string;
  holesTable: string;
  
  // Callbacks for format-specific logic
  parseGame: (data: any) => TGame;
  parseHole: (data: any) => THole;
  getHoleNumber: (hole: THole) => number;
  
  // Build hole data for save
  buildHoleData: (params: {
    gameId: string;
    holeNumber: number;
    par: number;
    strokeIndex: number | null;
    scores: TScores;
    previousHoles: THole[];
    game: TGame;
    courseHoles: CourseHoleData[];
  }) => Record<string, any>;
  
  // Extract scores from a hole for editing
  extractScoresFromHole: (hole: THole, game: TGame) => TScores;
  
  // Create empty scores for a new hole
  createEmptyScores: (game: TGame) => TScores;
  
  // Update game after hole save (optional)
  buildGameUpdate?: (params: {
    game: TGame;
    holeNumber: number;
    scores: TScores;
    allHoles: THole[];
    newHoleData: Record<string, any>;
  }) => Record<string, any> | null;
  
  // Check if game is finished
  isGameFinished?: (game: TGame, holeNumber: number, totalHoles: number, newHoleData: Record<string, any>) => boolean;
  
  // Check if all holes have scores for all players (for match play formats that should only finish when scorecard is complete)
  areAllHolesComplete?: (game: TGame, allHoles: THole[], totalHoles: number) => boolean;
  
  // Check if current hole should be saved when navigating away (optional - defaults to true if hole exists)
  shouldSaveOnNavigate?: (game: TGame, scores: TScores) => boolean;
  
  // Get total holes from game
  getTotalHoles: (game: TGame) => number;
  
  // Get course ID from game
  getCourseId: (game: TGame) => string | null;
  
  // Summary route
  getSummaryRoute: (gameId: string) => string;
}

export interface GameScoringState<TGame, THole, TScores> {
  game: TGame | null;
  holes: THole[];
  courseHoles: CourseHoleData[];
  currentHoleIndex: number;
  loading: boolean;
  saving: boolean;
  scores: TScores;
  par: number;
  strokeIndex: number | null;
}

export interface GameScoringActions<TScores> {
  setScores: (scores: TScores | ((prev: TScores) => TScores)) => void;
  updateScore: <K extends keyof TScores>(key: K, value: TScores[K]) => void;
  saveHole: () => Promise<boolean>;
  navigateHole: (direction: "prev" | "next") => Promise<void>;
  selectHole: (index: number) => void;
  loadHoleData: (holeNumber: number) => void;
  deleteGame: () => Promise<void>;
  goToSummary: () => void;
  refetchGame: () => Promise<void>;
}

export function useGameScoring<TGame, THole, TScores>(
  config: GameScoringConfig<TGame, THole, TScores>,
  navigate: (path: string) => void
): [GameScoringState<TGame, THole, TScores>, GameScoringActions<TScores>] {
  const { toast } = useToast();
  
  const [game, setGame] = useState<TGame | null>(null);
  const [holes, setHoles] = useState<THole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHoleData[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState<TScores>({} as TScores);
  const [par, setPar] = useState(4);
  const [strokeIndex, setStrokeIndex] = useState<number | null>(null);
  
  const configRef = useRef(config);
  configRef.current = config;
  
  const currentHole = currentHoleIndex + 1;
  
  // Fetch game and holes data
  const fetchGame = useCallback(async () => {
    const cfg = configRef.current;
    try {
      setLoading(true);
      
      // Fetch game
      const { data: gameData, error: gameError } = await supabase
        .from(cfg.gameTable as any)
        .select("*")
        .eq("id", cfg.gameId)
        .single();
      
      if (gameError) throw gameError;
      
      const parsedGame = cfg.parseGame(gameData);
      setGame(parsedGame);
      
      // Fetch course holes if course_id exists
      const courseId = cfg.getCourseId(parsedGame);
      if (courseId) {
        const { data: courseHolesData } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index, white_distance, yellow_distance, blue_distance, red_distance, black_distance, gold_distance, orange_distance, silver_distance")
          .eq("course_id", courseId)
          .order("hole_number");
        
        if (courseHolesData) {
          setCourseHoles(courseHolesData);
          const hole1 = courseHolesData.find(h => h.hole_number === 1);
          if (hole1) {
            setPar(hole1.par);
            setStrokeIndex(hole1.stroke_index ?? null);
          }
        }
      }
      
      // Fetch existing holes
      const { data: holesData, error: holesError } = await supabase
        .from(cfg.holesTable as any)
        .select("*")
        .eq("game_id", cfg.gameId)
        .order("hole_number");
      
      if (holesError) throw holesError;
      
      const parsedHoles = (holesData || []).map(cfg.parseHole);
      setHoles(parsedHoles);
      
      // Initialize scores
      setScores(cfg.createEmptyScores(parsedGame));
      
      // Set to first unplayed hole on initial load
      if (parsedHoles.length > 0) {
        setCurrentHoleIndex(parsedHoles.length);
      }
      
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  
  // Load on mount
  useEffect(() => {
    fetchGame();
  }, [fetchGame]);
  
  // Load hole data for navigation/editing
  const loadHoleData = useCallback((holeNumber: number) => {
    const cfg = configRef.current;
    if (!game) return;
    
    const existingHole = holes.find(h => cfg.getHoleNumber(h) === holeNumber);
    const courseHole = courseHoles.find(h => h.hole_number === holeNumber);
    
    setPar(courseHole?.par || 4);
    setStrokeIndex(courseHole?.stroke_index ?? null);
    
    if (existingHole) {
      setScores(cfg.extractScoresFromHole(existingHole, game));
    } else {
      setScores(cfg.createEmptyScores(game));
    }
  }, [game, holes, courseHoles]);
  
  // Update par and stroke index when hole changes
  useEffect(() => {
    if (courseHoles.length > 0 && game) {
      const totalHoles = configRef.current.getTotalHoles(game);
      // Prevent loading data for holes beyond totalHoles
      if (currentHole > totalHoles) {
        // If we somehow got past totalHoles, reset to the last valid hole
        const lastValidHoleIndex = totalHoles - 1;
        if (currentHoleIndex !== lastValidHoleIndex) {
          setCurrentHoleIndex(lastValidHoleIndex);
        }
        return;
      }
      const holeData = courseHoles.find(h => h.hole_number === currentHole);
      if (holeData) {
        setPar(holeData.par);
        setStrokeIndex(holeData.stroke_index ?? null);
      }
    }
  }, [currentHoleIndex, courseHoles, game]);
  
  // Save hole
  const saveHole = useCallback(async (): Promise<boolean> => {
    const cfg = configRef.current;
    if (!game) return false;
    
    setSaving(true);
    try {
      const totalHoles = cfg.getTotalHoles(game);
      const existingHole = holes.find(h => cfg.getHoleNumber(h) === currentHole);
      
      const holeData = cfg.buildHoleData({
        gameId: cfg.gameId,
        holeNumber: currentHole,
        par,
        strokeIndex,
        scores,
        previousHoles: holes.filter(h => cfg.getHoleNumber(h) < currentHole),
        game,
        courseHoles,
      });
      
      // Upsert hole
      if (existingHole) {
        const { error } = await supabase
          .from(cfg.holesTable as any)
          .update(holeData)
          .eq("id", (existingHole as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(cfg.holesTable as any)
          .insert(holeData);
        if (error) throw error;
      }
      
      // Refresh holes data
      const { data: updatedHolesData } = await supabase
        .from(cfg.holesTable as any)
        .select("*")
        .eq("game_id", cfg.gameId)
        .order("hole_number");
      
      const updatedHoles = (updatedHolesData || []).map(cfg.parseHole);
      setHoles(updatedHoles);
      
      // Update game if needed
      if (cfg.buildGameUpdate) {
        const gameUpdate = cfg.buildGameUpdate({
          game,
          holeNumber: currentHole,
          scores,
          allHoles: updatedHoles,
          newHoleData: holeData,
        });
        
        if (gameUpdate) {
          const { error: gameError } = await supabase
            .from(cfg.gameTable as any)
            .update(gameUpdate)
            .eq("id", cfg.gameId);
          
          if (gameError) throw gameError;
          
          setGame({ ...game, ...gameUpdate } as TGame);
        }
      }
      
      // Check if game is finished - use strict check: currentHole must be >= totalHoles
      const isFinished = cfg.isGameFinished?.(game, currentHole, totalHoles, holeData) ?? (currentHole >= totalHoles);
      
      // Only navigate to summary when:
      // 1. We just completed a NEW hole (not editing an existing one)
      // 2. That hole is the final hole
      // 3. All holes are complete
      // This prevents re-navigation when going back to edit previous holes
      const isNewHole = !existingHole;
      const isFinalHole = currentHole >= totalHoles;
      
      if (isFinished && isNewHole && isFinalHole) {
        const allHolesComplete = cfg.areAllHolesComplete?.(game, updatedHoles, totalHoles) ?? true;
        if (allHolesComplete) {
          navigate(cfg.getSummaryRoute(cfg.gameId));
          return true;
        }
      }
      
      // Advance to next hole only if we were on the latest hole
      // Make sure we don't go past totalHoles AND game is not finished
      // Use strict check: nextHoleNumber must be strictly less than or equal to totalHoles
      const wasOnLatestHole = !existingHole || holes.length === currentHoleIndex;
      const nextHoleNumber = currentHole + 1;
      
      // Prevent advancing if we've reached or exceeded totalHoles
      if (wasOnLatestHole && nextHoleNumber <= totalHoles && !isFinished && currentHole < totalHoles) {
        setCurrentHoleIndex(prev => prev + 1);
        // Load empty scores for next hole
        const nextCourseHole = courseHoles.find(h => h.hole_number === nextHoleNumber);
        setPar(nextCourseHole?.par || 4);
        setStrokeIndex(nextCourseHole?.stroke_index ?? null);
        setScores(cfg.createEmptyScores(game));
      }
      
      return true;
    } catch (error: any) {
      toast({ title: "Error saving hole", description: error.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [game, holes, currentHole, currentHoleIndex, par, strokeIndex, scores, courseHoles, navigate, toast]);
  
  // Helper to save a specific hole's data (for background saves during navigation)
  const saveHoleData = useCallback(async (holeNumber: number, holeScores: TScores, holePar: number, holeStrokeIndex: number | null): Promise<boolean> => {
    const cfg = configRef.current;
    if (!game) return false;
    
    try {
      const existingHole = holes.find(h => cfg.getHoleNumber(h) === holeNumber);
      
      const holeData = cfg.buildHoleData({
        gameId: cfg.gameId,
        holeNumber,
        par: holePar,
        strokeIndex: holeStrokeIndex,
        scores: holeScores,
        previousHoles: holes.filter(h => cfg.getHoleNumber(h) < holeNumber),
        game,
        courseHoles,
      });
      
      // Upsert hole
      if (existingHole) {
        const { error } = await supabase
          .from(cfg.holesTable as any)
          .update(holeData)
          .eq("id", (existingHole as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(cfg.holesTable as any)
          .insert(holeData);
        if (error) throw error;
      }
      
      // Refresh holes data
      const { data: updatedHolesData } = await supabase
        .from(cfg.holesTable as any)
        .select("*")
        .eq("game_id", cfg.gameId)
        .order("hole_number");
      
      const updatedHoles = (updatedHolesData || []).map(cfg.parseHole);
      setHoles(updatedHoles);
      
      // Update game totals if needed (for background save during navigation)
      if (cfg.buildGameUpdate) {
        const gameUpdate = cfg.buildGameUpdate({
          game,
          holeNumber,
          scores: holeScores,
          allHoles: updatedHoles,
          newHoleData: holeData,
        });
        
        if (gameUpdate) {
          await supabase
            .from(cfg.gameTable as any)
            .update(gameUpdate)
            .eq("id", cfg.gameId);
          
          setGame({ ...game, ...gameUpdate } as TGame);
        }
      }
      
      return true;
    } catch (error: any) {
      console.error("Error saving hole data:", error);
      return false;
    }
  }, [game, holes, courseHoles]);

  // Navigate between holes - navigate immediately, save in background if needed
  const navigateHole = useCallback((direction: "prev" | "next") => {
    const cfg = configRef.current;
    if (!game) return;
    
    const totalHoles = cfg.getTotalHoles(game);
    
    // Capture current hole data before navigation (for background save)
    const holeToSave = currentHole;
    const scoresToSave = scores;
    const parToSave = par;
    const strokeIndexToSave = strokeIndex;
    const existingHoleToSave = holes.find(h => cfg.getHoleNumber(h) === holeToSave);
    
    // Navigate immediately for responsive UI
    if (direction === "prev" && currentHoleIndex > 0) {
      const targetHoleNumber = currentHole - 1;
      loadHoleData(targetHoleNumber);
      setCurrentHoleIndex(prev => prev - 1);
      
      // Save previous hole in background (non-blocking) if it exists
      if (existingHoleToSave) {
        const shouldSave = cfg.shouldSaveOnNavigate ? cfg.shouldSaveOnNavigate(game, scoresToSave) : true;
        if (shouldSave) {
          saveHoleData(holeToSave, scoresToSave, parToSave, strokeIndexToSave).catch(err => 
            console.error("Error saving hole on navigate:", err)
          );
        }
      }
    } else if (direction === "next") {
      const nextHoleNumber = currentHole + 1;
      
      // Don't allow navigating past totalHoles
      // Strict check: nextHoleNumber must be <= totalHoles AND currentHole must be < totalHoles
      if (nextHoleNumber > totalHoles || currentHole >= totalHoles) {
        return; // Block navigation past the final hole
      }
      
      // Allow going to next hole if it's within totalHoles and either:
      // 1. It's the next unsaved hole (holes.length + 1), OR
      // 2. The hole already exists in the saved holes
      const isNextUnsavedHole = nextHoleNumber === holes.length + 1;
      const holeAlreadyExists = holes.some(h => cfg.getHoleNumber(h) === nextHoleNumber);
      
      if (nextHoleNumber <= totalHoles && (isNextUnsavedHole || holeAlreadyExists)) {
        loadHoleData(nextHoleNumber);
        setCurrentHoleIndex(prev => prev + 1);
        
        // Save previous hole in background (non-blocking) if it exists
        if (existingHoleToSave) {
          const shouldSave = cfg.shouldSaveOnNavigate ? cfg.shouldSaveOnNavigate(game, scoresToSave) : true;
          if (shouldSave) {
            saveHoleData(holeToSave, scoresToSave, parToSave, strokeIndexToSave).catch(err => 
              console.error("Error saving hole on navigate:", err)
            );
          }
        }
      }
    }
  }, [game, currentHole, currentHoleIndex, holes, loadHoleData, saveHoleData, scores, par, strokeIndex]);

  // Select hole by index (e.g. from hole strip) - navigate immediately, save current in background if needed
  const selectHole = useCallback((index: number) => {
    const cfg = configRef.current;
    if (!game) return;
    const totalHoles = cfg.getTotalHoles(game);
    if (index < 0 || index >= totalHoles || index === currentHoleIndex) return;
    const targetCourseHole = courseHoles[index];
    if (!targetCourseHole) return;

    const holeToSave = currentHole;
    const scoresToSave = scores;
    const parToSave = par;
    const strokeIndexToSave = strokeIndex;
    const existingHoleToSave = holes.find(h => cfg.getHoleNumber(h) === holeToSave);

    loadHoleData(targetCourseHole.hole_number);
    setCurrentHoleIndex(index);

    if (existingHoleToSave) {
      const shouldSave = cfg.shouldSaveOnNavigate ? cfg.shouldSaveOnNavigate(game, scoresToSave) : true;
      if (shouldSave) {
        saveHoleData(holeToSave, scoresToSave, parToSave, strokeIndexToSave).catch(err =>
          console.error("Error saving hole on select:", err)
        );
      }
    }
  }, [game, currentHole, currentHoleIndex, courseHoles, holes, loadHoleData, saveHoleData, scores, par, strokeIndex]);
  
  // Update a single score field
  const updateScore = useCallback(<K extends keyof TScores>(key: K, value: TScores[K]) => {
    setScores(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Delete game
  const deleteGame = useCallback(async () => {
    const cfg = configRef.current;
    try {
      await supabase.from(cfg.holesTable as any).delete().eq("game_id", cfg.gameId);
      await supabase.from(cfg.gameTable as any).delete().eq("id", cfg.gameId);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  }, [navigate, toast]);
  
  // Go to summary
  const goToSummary = useCallback(() => {
    const cfg = configRef.current;
    navigate(cfg.getSummaryRoute(cfg.gameId));
  }, [navigate]);
  
  const state: GameScoringState<TGame, THole, TScores> = {
    game,
    holes,
    courseHoles,
    currentHoleIndex,
    loading,
    saving,
    scores,
    par,
    strokeIndex,
  };
  
  const actions: GameScoringActions<TScores> = {
    setScores,
    updateScore,
    saveHole,
    navigateHole,
    selectHole,
    loadHoleData,
    deleteGame,
    goToSummary,
    refetchGame: fetchGame,
  };
  
  return [state, actions];
}
