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
      
      // Check if game is finished
      const isFinished = cfg.isGameFinished?.(game, currentHole, totalHoles, holeData) ?? (currentHole >= totalHoles);
      
      if (isFinished) {
        navigate(cfg.getSummaryRoute(cfg.gameId));
        return true;
      }
      
      // Advance to next hole only if we were on the latest hole
      const wasOnLatestHole = !existingHole || holes.length === currentHoleIndex;
      if (wasOnLatestHole && currentHole < totalHoles) {
        setCurrentHoleIndex(prev => prev + 1);
        // Load empty scores for next hole
        const nextCourseHole = courseHoles.find(h => h.hole_number === currentHole + 1);
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
  
  // Navigate between holes - save current hole first if it has been played
  const navigateHole = useCallback(async (direction: "prev" | "next") => {
    const cfg = configRef.current;
    if (!game) return;
    
    const totalHoles = cfg.getTotalHoles(game);
    
    // Check if current hole exists (was already saved before) - if so, save any changes
    const existingHole = holes.find(h => cfg.getHoleNumber(h) === currentHole);
    if (existingHole) {
      // Check if we should save on navigate (defaults to true)
      const shouldSave = cfg.shouldSaveOnNavigate ? cfg.shouldSaveOnNavigate(game, scores) : true;
      if (shouldSave) {
        // Save the current hole before navigating to preserve any changes
        await saveHole();
      }
    }
    
    if (direction === "prev" && currentHoleIndex > 0) {
      const targetHoleNumber = currentHole - 1;
      loadHoleData(targetHoleNumber);
      setCurrentHoleIndex(prev => prev - 1);
    } else if (direction === "next") {
      const maxAllowedHole = Math.min(holes.length + 1, totalHoles);
      const nextHoleNumber = currentHole + 1;
      
      if (nextHoleNumber <= maxAllowedHole) {
        loadHoleData(nextHoleNumber);
        setCurrentHoleIndex(prev => prev + 1);
      }
    }
  }, [game, currentHole, currentHoleIndex, holes, loadHoleData, saveHole]);
  
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
    loadHoleData,
    deleteGame,
    goToSummary,
    refetchGame: fetchGame,
  };
  
  return [state, actions];
}
