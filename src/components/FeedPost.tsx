import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Send, Trophy, Target, MoreHorizontal, Pencil, Trash2, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { formatDistanceToNow, format } from "date-fns";
import { RoundCard, RoundCardData } from "./RoundCard";
import { UmbriagioScorecardView } from "./UmbriagioScorecardView";
import { CopenhagenScorecardView } from "./CopenhagenScorecardView";
import { ScrambleScorecardView } from "./ScrambleScorecardView";
import { SkinsScorecardView } from "./SkinsScorecardView";
import { WolfScorecardView } from "./WolfScorecardView";
import { MatchPlayScorecardView } from "./MatchPlayScorecardView";
import { MatchPlayScorecardCard } from "./MatchPlayScorecardCard";
import { BestBallScorecardView } from "./BestBallScorecardView";
import { BestBallStrokePlayScorecardView } from "./BestBallStrokePlayScorecardView";
import { StrokePlayScorecardView } from "./StrokePlayScorecardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import { getGameRoute } from "@/utils/unifiedRoundsLoader";
import { buildGameUrl } from "@/hooks/useRoundNavigation";

const normalizeCourseHoles = (courseHoles: any) => {
  if (!Array.isArray(courseHoles) || courseHoles.length === 0) return null;
  return courseHoles
    .map((h: any) => ({
      hole_number: Number(h?.hole_number),
      par: Number(h?.par),
      stroke_index: Number(h?.stroke_index ?? h?.hole_number),
    }))
    .filter((h: any) => Number.isFinite(h.hole_number) && Number.isFinite(h.par) && Number.isFinite(h.stroke_index))
    .sort((a: any, b: any) => a.hole_number - b.hole_number) as Array<{ hole_number: number; par: number; stroke_index: number }>;
};

// Parse round scorecard result from post content (new format with scorecard data)
const extractTaggedBlock = (content: string, tag: string) => {
  const re = new RegExp(`\\[${tag}\\][\\s\\S]*?\\[\\/${tag}\\]`);
  const match = content.match(re);
  return match ? match[0] : null;
};

const stripTaggedBlock = (content: string, tag: string) => {
  const re = new RegExp(`\\[${tag}\\][\\s\\S]*?\\[\\/${tag}\\]`, "g");
  return content.replace(re, "").trim();
};

// When editing or as a safe rendering fallback, we must never expose embedded result payload blocks
// (scorecards, drill results, etc.) to the user. This strips those blocks even if parsing fails.
const stripEmbeddedPostBlocks = (content: string | null | undefined) => {
  const raw = content || "";
  return raw
    .replace(/\[DRILL_RESULT\][\s\S]*?\[\/DRILL_RESULT\]/g, "")
    .replace(/\[ROUND_SCORECARD\][\s\S]*?\[\/ROUND_SCORECARD\]/g, "")
    .replace(/\[MATCH_PLAY_SCORECARD\][\s\S]*?\[\/MATCH_PLAY_SCORECARD\]/g, "")
    .replace(/\[BEST_BALL_SCORECARD\][\s\S]*?\[\/BEST_BALL_SCORECARD\]/g, "")
    .replace(/\[BEST_BALL_STROKE_PLAY_SCORECARD\][\s\S]*?\[\/BEST_BALL_STROKE_PLAY_SCORECARD\]/g, "")
    .replace(/\[UMBRIAGO_SCORECARD\][\s\S]*?\[\/UMBRIAGO_SCORECARD\]/g, "")
    .replace(/\[COPENHAGEN_SCORECARD\][\s\S]*?\[\/COPENHAGEN_SCORECARD\]/g, "")
    .replace(/\[SCRAMBLE_SCORECARD\][\s\S]*?\[\/SCRAMBLE_SCORECARD\]/g, "")
    .replace(/\[SKINS_SCORECARD\][\s\S]*?\[\/SKINS_SCORECARD\]/g, "")
    .replace(/\[WOLF_SCORECARD\][\s\S]*?\[\/WOLF_SCORECARD\]/g, "")
    .replace(/\[ROUND_RESULT\][\s\S]*?\[\/ROUND_RESULT\]/g, "")
    .replace(/\[UMBRIAGO_RESULT\][\s\S]*?\[\/UMBRIAGO_RESULT\]/g, "")
    .replace(/\[GAME_RESULT\][\s\S]*?\[\/GAME_RESULT\]/g, "")
    .trim();
};

const parseRoundScorecardResult = (content: string) => {
  // Format: [ROUND_SCORECARD]name|course|date|score|vspar|holes|totalPar|roundId|scorecardJson[/ROUND_SCORECARD]
  const block = extractTaggedBlock(content, "ROUND_SCORECARD");
  if (!block) return null;
  try {
    const inner = block.replace(/^\[ROUND_SCORECARD\]/, "").replace(/\[\/ROUND_SCORECARD\]$/, "");
    const parts = inner.split("|");
    if (parts.length < 9) return null;
    const [roundName, courseName, datePlayed, score, scoreVsPar, holesPlayed, totalPar, roundId, ...jsonParts] = parts;
    const scorecardData = JSON.parse(jsonParts.join("|"));
    return {
      roundName,
      courseName,
      datePlayed,
      score: parseInt(score),
      scoreVsPar: parseInt(scoreVsPar),
      holesPlayed: parseInt(holesPlayed),
      totalPar: parseInt(totalPar),
      roundId: roundId || null,
      holeScores: scorecardData.scores as Record<number, number>,
      holePars: scorecardData.pars as Record<number, number>,
      courseHoles: scorecardData.courseHoles as Array<{ hole_number: number; par: number; stroke_index?: number }> | undefined,
      textContent: stripTaggedBlock(content, "ROUND_SCORECARD"),
    };
  } catch (e) {
    console.error("Error parsing scorecard data:", e);
    return null;
  }
};

const getEditablePostText = (content: string | null | undefined) => {
  return stripEmbeddedPostBlocks(content);
};

// Parse match play scorecard result from post content
const parseMatchPlayScorecardResult = (content: string) => {
  // Format: [MATCH_PLAY_SCORECARD]roundName|courseName|date|player1|player2|finalResult|winnerPlayer|gameId|scorecardJson[/MATCH_PLAY_SCORECARD]
  const match = content?.match(/\[MATCH_PLAY_SCORECARD\]([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]*)\|([^|]+)\|(.+?)\[\/MATCH_PLAY_SCORECARD\]/s);
  if (match) {
    try {
      const scorecardData = JSON.parse(match[9]);
      const holeScores = scorecardData.holeScores as Record<number, { player1: number | null; player2: number | null; result: number; statusAfter: number }>;
      
      // Get the final match status from the last hole played
      const holeNumbers = Object.keys(holeScores).map(Number).sort((a, b) => a - b);
      const lastHole = holeNumbers[holeNumbers.length - 1];
      const matchStatus = lastHole ? holeScores[lastHole]?.statusAfter || 0 : 0;
      
      return {
        roundName: match[1],
        courseName: match[2],
        datePlayed: match[3],
        player1Name: match[4],
        player2Name: match[5],
        finalResult: match[6],
        winnerPlayer: match[7] || null,
        gameId: match[8] || null,
        holeScores,
        holePars: scorecardData.holePars as Record<number, number>,
        courseHoles: scorecardData.courseHoles as Array<{ hole_number: number; par: number; stroke_index?: number }> | undefined,
        matchStatus,
        textContent: content.replace(/\[MATCH_PLAY_SCORECARD\].+?\[\/MATCH_PLAY_SCORECARD\]/s, '').trim()
      };
    } catch (e) {
      console.error('Error parsing match play scorecard data:', e);
      return null;
    }
  }
  return null;
};

// Parse best ball scorecard result from post content (Match Play)
const parseBestBallScorecardResult = (content: string) => {
  // Format: [BEST_BALL_SCORECARD]roundName|courseName|date|teamAName|teamBName|matchStatus|userTeam|gameId|scorecardJson[/BEST_BALL_SCORECARD]
  const match = content?.match(/\[BEST_BALL_SCORECARD\]([^|]*)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|(.+?)\[\/BEST_BALL_SCORECARD\]/s);
  if (match) {
    try {
      const scorecardData = JSON.parse(match[9]);
      return {
        roundName: match[1] || 'Best Ball Match Play',
        courseName: match[2],
        datePlayed: match[3],
        teamAName: match[4],
        teamBName: match[5],
        matchStatus: parseInt(match[6]),
        userTeam: match[7] as 'A' | 'B',
        gameId: match[8] || null,
        holeScores: scorecardData.holeScores as Record<number, {
          teamAScores: { playerId: string; playerName: string; grossScore: number }[];
          teamBScores: { playerId: string; playerName: string; grossScore: number }[];
          matchStatusAfter: number;
        }>,
        holePars: scorecardData.holePars as Record<number, number>,
        courseHoles: scorecardData.courseHoles as Array<{ hole_number: number; par: number; stroke_index?: number }> | undefined,
        teamAPlayers: scorecardData.teamAPlayers as { id: string; name: string }[],
        teamBPlayers: scorecardData.teamBPlayers as { id: string; name: string }[],
        textContent: content.replace(/\[BEST_BALL_SCORECARD\].+?\[\/BEST_BALL_SCORECARD\]/s, '').trim()
      };
    } catch (e) {
      console.error('Error parsing best ball scorecard data:', e);
      return null;
    }
  }
  return null;
};

// Parse best ball stroke play scorecard result from post content
const parseBestBallStrokePlayScorecardResult = (content: string) => {
  // Format: [BEST_BALL_STROKE_PLAY_SCORECARD]roundName|courseName|date|teamAName|teamBName|userTeam|userTeamTotalScore|userTeamScoreToPar|gameId|scorecardJson[/BEST_BALL_STROKE_PLAY_SCORECARD]
  const match = content?.match(/\[BEST_BALL_STROKE_PLAY_SCORECARD\]([^|]*)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|(.+?)\[\/BEST_BALL_STROKE_PLAY_SCORECARD\]/s);
  if (match) {
    try {
      const scorecardData = JSON.parse(match[10]);
      return {
        roundName: match[1] || 'Best Ball Stroke Play',
        courseName: match[2],
        datePlayed: match[3],
        teamAName: match[4],
        teamBName: match[5],
        userTeam: match[6] as 'A' | 'B',
        userTeamTotalScore: parseInt(match[7]),
        userTeamScoreToPar: parseInt(match[8]),
        gameId: match[9] || null,
        holeScores: scorecardData.holeScores as Record<number, {
          teamAScores: { playerId: string; playerName: string; grossScore: number }[];
          teamBScores: { playerId: string; playerName: string; grossScore: number }[];
        }>,
        holePars: scorecardData.holePars as Record<number, number>,
        courseHoles: scorecardData.courseHoles as Array<{ hole_number: number; par: number; stroke_index?: number }> | undefined,
        teamAPlayers: scorecardData.teamAPlayers as { id: string; name: string }[],
        teamBPlayers: scorecardData.teamBPlayers as { id: string; name: string }[],
        textContent: content.replace(/\[BEST_BALL_STROKE_PLAY_SCORECARD\].+?\[\/BEST_BALL_STROKE_PLAY_SCORECARD\]/s, '').trim()
      };
    } catch (e) {
      console.error('Error parsing best ball stroke play scorecard data:', e);
      return null;
    }
  }
  return null;
};

const parseDrillResult = (content: string) => {
  // Extended format with resultId: [DRILL_RESULT]title|score|unit|isPB|resultId[/DRILL_RESULT]
  const extendedMatch = content?.match(/\[DRILL_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/DRILL_RESULT\]/);
  if (extendedMatch) {
    return {
      drillTitle: extendedMatch[1],
      score: extendedMatch[2],
      unit: extendedMatch[3],
      isPersonalBest: extendedMatch[4] === 'true',
      resultId: extendedMatch[5],
      textContent: content.replace(/\[DRILL_RESULT\].+?\[\/DRILL_RESULT\]/, '').trim()
    };
  }
  // Original format without resultId
  const match = content?.match(/\[DRILL_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\[\/DRILL_RESULT\]/);
  if (match) {
    return {
      drillTitle: match[1],
      score: match[2],
      unit: match[3],
      isPersonalBest: match[4] === 'true',
      resultId: null,
      textContent: content.replace(/\[DRILL_RESULT\].+?\[\/DRILL_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Parse round result from post content
const parseRoundResult = (content: string) => {
  // Extended format with roundId: [ROUND_RESULT]name|course|score|vspar|holes|roundId[/ROUND_RESULT]
  const extendedMatch = content?.match(/\[ROUND_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/ROUND_RESULT\]/);
  if (extendedMatch) {
    return {
      roundName: extendedMatch[1],
      courseName: extendedMatch[2],
      score: parseInt(extendedMatch[3]),
      scoreVsPar: parseInt(extendedMatch[4]),
      holesPlayed: parseInt(extendedMatch[5]),
      roundId: extendedMatch[6],
      textContent: content.replace(/\[ROUND_RESULT\].+?\[\/ROUND_RESULT\]/, '').trim()
    };
  }
  // Original format without roundId
  const match = content?.match(/\[ROUND_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/ROUND_RESULT\]/);
  if (match) {
    return {
      roundName: match[1],
      courseName: match[2],
      score: parseInt(match[3]),
      scoreVsPar: parseInt(match[4]),
      holesPlayed: parseInt(match[5]),
      roundId: null,
      textContent: content.replace(/\[ROUND_RESULT\].+?\[\/ROUND_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Parse Umbriago scorecard result from post content (new format with scorecard data)
const parseUmbriagioScorecardResult = (content: string) => {
  // Format: [UMBRIAGO_SCORECARD]roundName|courseName|date|teamAName|teamBName|normalizedA|normalizedB|winningTeam|currentUserTeam|gameId|scorecardJson[/UMBRIAGO_SCORECARD]
  const block = extractTaggedBlock(content, "UMBRIAGO_SCORECARD");
  if (!block) return null;
  try {
    const inner = block.replace(/^\[UMBRIAGO_SCORECARD\]/, "").replace(/\[\/UMBRIAGO_SCORECARD\]$/, "");
    const parts = inner.split("|");
    if (parts.length < 11) return null;
    const [
      roundName,
      courseName,
      datePlayed,
      teamAName,
      teamBName,
      normalizedA,
      normalizedB,
      winningTeamRaw,
      currentUserTeamRaw,
      gameId,
      ...jsonParts
    ] = parts;
    const scorecardData = JSON.parse(jsonParts.join("|"));
    return {
      roundName,
      courseName,
      datePlayed,
      teamAName,
      teamBName,
      normalizedA: parseInt(normalizedA),
      normalizedB: parseInt(normalizedB),
      winningTeam:
        winningTeamRaw === "A" || winningTeamRaw === "B" || winningTeamRaw === "TIE"
          ? (winningTeamRaw as "A" | "B" | "TIE")
          : null,
      currentUserTeam: currentUserTeamRaw === "A" || currentUserTeamRaw === "B" ? (currentUserTeamRaw as "A" | "B") : null,
      gameId: gameId || null,
      holePoints: scorecardData.holePoints as Record<number, { teamA: number; teamB: number }>,
      holePars: scorecardData.holePars as Record<number, number>,
      courseHoles: scorecardData.courseHoles as Array<{ hole_number: number; par: number; stroke_index?: number }> | undefined,
      textContent: stripTaggedBlock(content, "UMBRIAGO_SCORECARD"),
    };
  } catch (e) {
    console.error("Error parsing umbriago scorecard data:", e);
    return null;
  }
};

// Parse Copenhagen scorecard result from post content
const parseCopenhagenScorecardResult = (content: string) => {
  // Format: [COPENHAGEN_SCORECARD]roundName|courseName|date|player1|player2|player3|p1pts|p2pts|p3pts|winner|gameId|scorecardJson[/COPENHAGEN_SCORECARD]
  const block = extractTaggedBlock(content, "COPENHAGEN_SCORECARD");
  if (!block) return null;
  try {
    const inner = block.replace(/^\[COPENHAGEN_SCORECARD\]/, "").replace(/\[\/COPENHAGEN_SCORECARD\]$/, "");
    const parts = inner.split("|");
    if (parts.length < 12) return null;
    const [
      roundName,
      courseName,
      datePlayed,
      player1,
      player2,
      player3,
      player1Points,
      player2Points,
      player3Points,
      winner,
      gameId,
      ...jsonParts
    ] = parts;
    const scorecardData = JSON.parse(jsonParts.join("|"));
    return {
      roundName,
      courseName,
      datePlayed,
      player1,
      player2,
      player3,
      player1Points: parseInt(player1Points),
      player2Points: parseInt(player2Points),
      player3Points: parseInt(player3Points),
      winner,
      gameId: gameId || null,
      holeScores: scorecardData.holeScores as Record<
        number,
        { p1: number | null; p2: number | null; p3: number | null; p1pts: number; p2pts: number; p3pts: number }
      >,
      holePars: scorecardData.holePars as Record<number, number>,
      courseHoles: scorecardData.courseHoles as Array<{ hole_number: number; par: number; stroke_index?: number }> | undefined,
      textContent: stripTaggedBlock(content, "COPENHAGEN_SCORECARD"),
    };
  } catch (e) {
    console.error("Error parsing copenhagen scorecard data:", e);
    return null;
  }
};

// Parse Scramble scorecard result from post content
const parseScrambleScorecardResult = (content: string) => {
  // Format: [SCRAMBLE_SCORECARD]roundName|courseName|date|winningTeam|gameId|scorecardJson[/SCRAMBLE_SCORECARD]
  const block = extractTaggedBlock(content, "SCRAMBLE_SCORECARD");
  if (!block) return null;
  try {
    const inner = block.replace(/^\[SCRAMBLE_SCORECARD\]/, "").replace(/\[\/SCRAMBLE_SCORECARD\]$/, "");
    const parts = inner.split("|");
    if (parts.length < 6) return null;
    const [roundName, courseName, datePlayed, winningTeam, gameId, ...jsonParts] = parts;
    const scorecardData = JSON.parse(jsonParts.join("|"));
    return {
      roundName,
      courseName,
      datePlayed,
      winningTeam,
      gameId: gameId || null,
      holeScores: scorecardData.holeScores as Record<number, Record<string, number | null>>,
      holePars: scorecardData.holePars as Record<number, number>,
      courseHoles: scorecardData.courseHoles as Array<{ hole_number: number; par: number; stroke_index?: number }> | undefined,
      teams: scorecardData.teams as Array<{ id: string; name: string; players: Array<{ id: string; name: string }> }>,
      textContent: stripTaggedBlock(content, "SCRAMBLE_SCORECARD"),
    };
  } catch (e) {
    console.error("Error parsing scramble scorecard data:", e);
    return null;
  }
};

// Parse Skins scorecard result from post content
const parseSkinsScorecardResult = (content: string) => {
  // Format: [SKINS_SCORECARD]roundName|courseName|date|winnerId|winnerName|winnerSkins|gameId|scorecardJson[/SKINS_SCORECARD]
  const block = extractTaggedBlock(content, "SKINS_SCORECARD");
  if (!block) return null;
  try {
    const inner = block.replace(/^\[SKINS_SCORECARD\]/, "").replace(/\[\/SKINS_SCORECARD\]$/, "");
    const parts = inner.split("|");
    if (parts.length < 8) return null;
    const [roundName, courseName, datePlayed, winnerId, winnerName, winnerSkins, gameId, ...jsonParts] = parts;
    const scorecardData = JSON.parse(jsonParts.join("|"));
    return {
      roundName,
      courseName,
      datePlayed,
      winnerId,
      winnerName,
      winnerSkins: parseInt(winnerSkins),
      gameId: gameId || null,
      playerScores: scorecardData.playerScores as Record<string, { name: string; skins: number; total: number }>,
      holeResults: scorecardData.holeResults as Record<
        number,
        { winnerId: string | null; skinsAvailable: number; par: number; playerScores?: Record<string, number> }
      >,
      courseHoles: scorecardData.courseHoles as Array<{ hole_number: number; par: number; stroke_index?: number }> | undefined,
      textContent: stripTaggedBlock(content, "SKINS_SCORECARD"),
    };
  } catch (e) {
    console.error("Error parsing skins scorecard data:", e);
    return null;
  }
};

// Parse Wolf scorecard result from post content
const parseWolfScorecardResult = (content: string) => {
  // Format: [WOLF_SCORECARD]roundName|courseName|date|winnerName|winnerPoints|gameId|scorecardJson[/WOLF_SCORECARD]
  const block = extractTaggedBlock(content, "WOLF_SCORECARD");
  if (!block) return null;
  try {
    const inner = block.replace(/^\[WOLF_SCORECARD\]/, "").replace(/\[\/WOLF_SCORECARD\]$/, "");
    const parts = inner.split("|");
    if (parts.length < 7) return null;
    const [roundName, courseName, datePlayed, winnerName, winnerPoints, gameId, ...jsonParts] = parts;
    const scorecardData = JSON.parse(jsonParts.join("|"));
    return {
      roundName,
      courseName,
      datePlayed,
      winnerName,
      winnerPoints: parseInt(winnerPoints),
      gameId: gameId || null,
      playerScores: scorecardData.playerScores as Record<string, { name: string; points: number }>,
      holeResults: scorecardData.holeResults as Record<
        number,
        { scores: Record<number, number | null>; points: Record<number, number | null>; par: number }
      >,
      courseHoles: scorecardData.courseHoles as Array<{ hole_number: number; par: number; stroke_index?: number }> | undefined,
      textContent: stripTaggedBlock(content, "WOLF_SCORECARD"),
    };
  } catch (e) {
    console.error("Error parsing wolf scorecard data:", e);
    return null;
  }
};

// Parse Umbriago result from post content (legacy format)
const parseUmbriagioResult = (content: string) => {
  // Extended format with gameId
  const extendedMatch = content?.match(/\[UMBRIAGO_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/UMBRIAGO_RESULT\]/);
  if (extendedMatch) {
    return {
      courseName: extendedMatch[1],
      teamAPoints: parseInt(extendedMatch[2]),
      teamBPoints: parseInt(extendedMatch[3]),
      winningTeam: extendedMatch[4] as 'A' | 'B' | 'TIE' | 'null',
      teamAPlayers: extendedMatch[5],
      teamBPlayers: extendedMatch[6],
      gameId: extendedMatch[7],
      textContent: content.replace(/\[UMBRIAGO_RESULT\].+?\[\/UMBRIAGO_RESULT\]/, '').trim()
    };
  }
  // Original format without gameId
  const match = content?.match(/\[UMBRIAGO_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/UMBRIAGO_RESULT\]/);
  if (match) {
    return {
      courseName: match[1],
      teamAPoints: parseInt(match[2]),
      teamBPoints: parseInt(match[3]),
      winningTeam: match[4] as 'A' | 'B' | 'TIE' | 'null',
      teamAPlayers: match[5],
      teamBPlayers: match[6],
      gameId: null,
      textContent: content.replace(/\[UMBRIAGO_RESULT\].+?\[\/UMBRIAGO_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Parse game result from post content (for Best Ball, Match Play, Skins, etc.)
const parseGameResult = (content: string) => {
  // New format with roundName: [GAME_RESULT]gameType|courseName|roundName|winner|resultText|additionalInfo|gameId[/GAME_RESULT]
  const newMatch = content?.match(/\[GAME_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/GAME_RESULT\]/);
  if (newMatch) {
    return {
      gameType: newMatch[1],
      courseName: newMatch[2],
      roundName: newMatch[3] || null,
      winner: newMatch[4] || null,
      resultText: newMatch[5] || null,
      additionalInfo: newMatch[6] || null,
      gameId: newMatch[7] || null,
      textContent: content.replace(/\[GAME_RESULT\].+?\[\/GAME_RESULT\]/, '').trim()
    };
  }
  // Old format without roundName (for backwards compatibility)
  const oldMatch = content?.match(/\[GAME_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/GAME_RESULT\]/);
  if (oldMatch) {
    return {
      gameType: oldMatch[1],
      courseName: oldMatch[2],
      roundName: null,
      winner: oldMatch[3] || null,
      resultText: oldMatch[4] || null,
      additionalInfo: oldMatch[5] || null,
      gameId: oldMatch[6] || null,
      textContent: content.replace(/\[GAME_RESULT\].+?\[\/GAME_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Drill Result Card Component - matches RoundCard layout
const DrillResultCard = ({ drillTitle, score, unit, isPersonalBest, date, onClick, clickable = true }: { 
  drillTitle: string; 
  score: string; 
  unit: string; 
  isPersonalBest: boolean;
  date?: string;
  onClick?: () => void;
  clickable?: boolean;
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const baseClasses = "bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 transition-all";
  const clickableClasses = clickable 
    ? "cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] group"
    : "";

  return (
    <Card 
      className={`${baseClasses} ${clickableClasses}`}
      onClick={clickable ? onClick : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Left: Score */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className="text-2xl font-bold text-primary">{score}</div>
            <div className="text-xs text-muted-foreground">{unit}</div>
          </div>
          
          {/* Middle: Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{drillTitle}</h3>
              {isPersonalBest && (
                <span className="flex items-center gap-1 text-xs text-amber-600 flex-shrink-0">
                  <Trophy className="h-3 w-3" />
                  PB
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Target className="h-3 w-3" />
              <span>Drill Result</span>
              {date && (
                <>
                  <span>·</span>
                  <span>{formatDate(date)}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Right: Chevron */}
          {clickable && (
            <ChevronRight size={20} className="text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Helper to convert game type string to RoundCard gameType
const getGameTypeForCard = (gameType: string): RoundCardData['gameType'] => {
  const typeMap: Record<string, RoundCardData['gameType']> = {
    'Best Ball': 'best_ball',
    'Match Play': 'match_play',
    'Skins': 'skins',
    'Wolf': 'wolf',
    'Copenhagen': 'copenhagen',
    'Scramble': 'scramble',
    'Umbriago': 'umbriago',
  };
  return typeMap[gameType] || 'round';
};

// Helper to get database table name from game type
const getTableFromGameType = (gameType: string): string => {
  const tableMap: Record<string, string> = {
    'Best Ball': 'best_ball_games',
    'Match Play': 'match_play_games',
    'Skins': 'skins_games',
    'Wolf': 'wolf_games',
    'Copenhagen': 'copenhagen_games',
    'Scramble': 'scramble_games',
    'Umbriago': 'umbriago_games',
  };
  return tableMap[gameType] || '';
};

// Component that fetches game data and renders RoundCard
const GameResultCardFromDB = ({
  gameType,
  gameId,
  resultUserId,
  fallbackCourseName,
  fallbackRoundName,
}: {
  gameType: string;
  gameId: string;
  resultUserId: string;
  fallbackCourseName: string;
  fallbackRoundName: string | null;
}) => {
  const navigate = useNavigate();
  const [gameData, setGameData] = useState<RoundCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGameData = async () => {
      const tableName = getTableFromGameType(gameType);
      if (!tableName || !gameId) {
        setLoading(false);
        return;
      }

      const selectFields = (() => {
        if (tableName === "match_play_games") {
          return "id, course_name, round_name, date_played, holes_played, winner_player, final_result, is_finished, player_1, player_2";
        }
        if (tableName === "best_ball_games") {
          return "id, course_name, round_name, date_played, holes_played, game_type, winner_team, final_result, is_finished, team_a_players, team_b_players";
        }
        if (tableName === "copenhagen_games") {
          return "id, course_name, round_name, date_played, holes_played, player_1, player_2, player_3, player_1_total_points, player_2_total_points, player_3_total_points";
        }
        if (tableName === "scramble_games") {
          return "id, course_name, round_name, date_played, holes_played, teams, winning_team";
        }
        if (tableName === "umbriago_games") {
          return "id, course_name, round_name, date_played, holes_played, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, team_a_total_points, team_b_total_points, is_finished";
        }
        if (tableName === "wolf_games") {
          return "id, course_name, round_name, date_played, holes_played, player_1, player_2, player_3, player_4, player_5, player_6, player_1_points, player_2_points, player_3_points, player_4_points, player_5_points, player_6_points, is_finished";
        }
        return "id, course_name, round_name, date_played, holes_played";
      })();

      try {
        // First fetch the game data
        const [{ data, error }, { data: resultUserProfile }] = await Promise.all([
          supabase
            .from(tableName as any)
            .select(selectFields)
            .eq("id", gameId)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", resultUserId)
            .maybeSingle(),
        ]);

        if (error || !data) {
          setLoading(false);
          return;
        }

        // Fetch scramble holes if needed
        let scrambleHoles: any[] = [];
        if (tableName === "scramble_games") {
          const { data: holesData } = await supabase
            .from("scramble_holes")
            .select("game_id, par, team_scores")
            .eq("game_id", gameId);
          scrambleHoles = holesData || [];
        }

        const participantNamesRaw = [
          resultUserProfile?.display_name,
          resultUserProfile?.username,
        ]
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim());

        const participantNames = Array.from(new Set(participantNamesRaw));

        const extractPlayerNames = (playersJson: any): string[] => {
          if (!Array.isArray(playersJson)) return [];
          return playersJson
            .map((p) => {
              if (typeof p === "string") return p;
              if (p && typeof p === "object" && typeof p.name === "string") return p.name;
              return null;
            })
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((v) => v.trim());
        };

        const computeMatchPlayOutcome = (): {
          matchResult: RoundCardData["matchResult"];
          matchFinalScore: string | null;
        } => {
          // Default (not match play / can't determine)
          let matchResult: RoundCardData["matchResult"] = null;
          let matchFinalScore: string | null = null;

          if (tableName === "match_play_games") {
            const g = data as any;
            if (!g?.is_finished) return { matchResult, matchFinalScore };

            const userIsPlayer1 = participantNames.includes(g.player_1);
            const userIsPlayer2 = participantNames.includes(g.player_2);
            if (!userIsPlayer1 && !userIsPlayer2) return { matchResult, matchFinalScore };

            if (!g.winner_player) {
              matchResult = "T";
              matchFinalScore = null;
              return { matchResult, matchFinalScore };
            }

            matchResult = participantNames.includes(g.winner_player) ? "W" : "L";
            matchFinalScore = g.final_result ?? null;
            return { matchResult, matchFinalScore };
          }

          if (tableName === "best_ball_games") {
            const g = data as any;
            if (g?.game_type !== "match_play") return { matchResult, matchFinalScore };
            if (!g?.is_finished) return { matchResult, matchFinalScore };

            const teamAPlayers = extractPlayerNames(g.team_a_players);
            const teamBPlayers = extractPlayerNames(g.team_b_players);

            const isOnTeamA = participantNames.some((n) => teamAPlayers.includes(n));
            const isOnTeamB = participantNames.some((n) => teamBPlayers.includes(n));

            const userTeam = isOnTeamA ? "A" : isOnTeamB ? "B" : null;
            if (!userTeam) return { matchResult, matchFinalScore };

            if (!g.winner_team) {
              matchResult = "T";
              matchFinalScore = null;
              return { matchResult, matchFinalScore };
            }

            matchResult = g.winner_team === userTeam ? "W" : "L";
            matchFinalScore = g.final_result ?? null;
            return { matchResult, matchFinalScore };
          }

          return { matchResult, matchFinalScore };
        };

        const { matchResult, matchFinalScore } = computeMatchPlayOutcome();

        // Compute Copenhagen position and final score
        const computeCopenhagenData = (): { position: number | null; copenhagenFinalScore: string | null } => {
          if (tableName !== "copenhagen_games") return { position: null, copenhagenFinalScore: null };
          
          const g = data as any;
          const rawPoints = [
            { player: 1, pts: g.player_1_total_points || 0, name: g.player_1 },
            { player: 2, pts: g.player_2_total_points || 0, name: g.player_2 },
            { player: 3, pts: g.player_3_total_points || 0, name: g.player_3 },
          ];
          
          // Normalize points (subtract minimum so lowest is 0)
          const minPts = Math.min(...rawPoints.map(p => p.pts));
          const normalizedPoints = rawPoints.map(p => ({ ...p, pts: p.pts - minPts }));
          
          // Sort by points descending for position calculation
          const sortedPoints = [...normalizedPoints].sort((a, b) => b.pts - a.pts);
          
          // Find which player the result user is
          let userPlayerIndex: number | null = null;
          if (participantNames.some(n => n === g.player_1)) userPlayerIndex = 1;
          else if (participantNames.some(n => n === g.player_2)) userPlayerIndex = 2;
          else if (participantNames.some(n => n === g.player_3)) userPlayerIndex = 3;
          
          let position: number | null = null;
          if (userPlayerIndex) {
            position = sortedPoints.findIndex((p) => p.player === userPlayerIndex) + 1;
          }
          
          // Create final score string (e.g., "8-3-0") from sorted normalized points
          const copenhagenFinalScore = sortedPoints.map(p => p.pts).join('-');
          
          return { position, copenhagenFinalScore };
        };

        const { position, copenhagenFinalScore } = computeCopenhagenData();

        // Compute Scramble position and score to par
        const computeScrambleData = (): { scramblePosition: number | null; scrambleScoreToPar: number | null } => {
          if (tableName !== "scramble_games") return { scramblePosition: null, scrambleScoreToPar: null };
          
          const g = data as any;
          const teams = Array.isArray(g.teams) ? g.teams : [];
          
          // Find which team the user is on
          let userTeamId: string | null = null;
          for (const team of teams) {
            const players = Array.isArray(team.players) ? team.players : [];
            for (const p of players) {
              const pName = typeof p === "string" ? p : p?.name;
              if (pName && participantNames.includes(pName)) {
                userTeamId = team.id;
                break;
              }
            }
            if (userTeamId) break;
          }
          
          // If not found, default to first team
          if (!userTeamId && teams.length > 0) {
            userTeamId = teams[0].id;
          }
          
          // Calculate team scores from holes
          const teamTotals: Record<string, { score: number; par: number }> = {};
          
          for (const hole of scrambleHoles) {
            const teamScores = hole.team_scores || {};
            for (const [teamId, score] of Object.entries(teamScores)) {
              if (!teamTotals[teamId]) {
                teamTotals[teamId] = { score: 0, par: 0 };
              }
              teamTotals[teamId].score += score as number;
              teamTotals[teamId].par += hole.par;
            }
          }
          
          // Calculate score to par for each team and sort for position
          const teamResults = Object.entries(teamTotals).map(([teamId, teamData]) => ({
            teamId,
            scoreToPar: teamData.score - teamData.par,
          })).sort((a, b) => a.scoreToPar - b.scoreToPar); // Lower is better
          
          // Find user's position and score
          let scramblePosition: number | null = null;
          let scrambleScoreToPar: number | null = null;
          
          if (userTeamId) {
            const userTeamIndex = teamResults.findIndex(t => t.teamId === userTeamId);
            if (userTeamIndex !== -1) {
              scramblePosition = userTeamIndex + 1;
              scrambleScoreToPar = teamResults[userTeamIndex].scoreToPar;
            }
          }
          
          return { scramblePosition, scrambleScoreToPar };
        };

        const { scramblePosition, scrambleScoreToPar } = computeScrambleData();

        // Compute Umbriago position and score
        const computeUmbriagioData = () => {
          if (tableName !== "umbriago_games") return { umbriagioPosition: null, umbriagioFinalScore: null };
          const umbriagioData = data as any;
          if (!umbriagioData.is_finished) return { umbriagioPosition: null, umbriagioFinalScore: null };
          
          const teamAPoints = umbriagioData.team_a_total_points || 0;
          const teamBPoints = umbriagioData.team_b_total_points || 0;
          
          // Normalize points
          const minPoints = Math.min(teamAPoints, teamBPoints);
          const normalizedA = teamAPoints - minPoints;
          const normalizedB = teamBPoints - minPoints;
          const umbriagioFinalScore = `${normalizedA}-${normalizedB}`;
          
          // Determine user's result (W/L/T)
          let umbriagioResult: 'W' | 'L' | 'T' | null = null;
          const userInTeamA = participantNames.includes(umbriagioData.team_a_player_1) || 
                              participantNames.includes(umbriagioData.team_a_player_2);
          const userInTeamB = participantNames.includes(umbriagioData.team_b_player_1) || 
                              participantNames.includes(umbriagioData.team_b_player_2);
          
          if (teamAPoints === teamBPoints) {
            umbriagioResult = 'T';
          } else if (userInTeamA && !userInTeamB) {
            umbriagioResult = teamAPoints > teamBPoints ? 'W' : 'L';
          } else if (userInTeamB && !userInTeamA) {
            umbriagioResult = teamBPoints > teamAPoints ? 'W' : 'L';
          } else {
            umbriagioResult = teamAPoints > teamBPoints ? 'W' : 'L';
          }
          
          return { umbriagioResult, umbriagioFinalScore };
        };
        
        const { umbriagioResult, umbriagioFinalScore } = computeUmbriagioData();

        // Compute Wolf position and final score
        const computeWolfData = (): { wolfPosition: number | null; wolfFinalScore: string | null } => {
          if (tableName !== "wolf_games") return { wolfPosition: null, wolfFinalScore: null };
          
          const g = data as any;
          if (!g.is_finished) return { wolfPosition: null, wolfFinalScore: null };
          
          // Get all players with their points
          const players = [
            { index: 1, name: g.player_1, pts: g.player_1_points || 0 },
            { index: 2, name: g.player_2, pts: g.player_2_points || 0 },
            { index: 3, name: g.player_3, pts: g.player_3_points || 0 },
          ];
          if (g.player_4) players.push({ index: 4, name: g.player_4, pts: g.player_4_points || 0 });
          if (g.player_5) players.push({ index: 5, name: g.player_5, pts: g.player_5_points || 0 });
          if (g.player_6) players.push({ index: 6, name: g.player_6, pts: g.player_6_points || 0 });
          
          // Normalize points (subtract minimum so lowest is 0)
          const minPts = Math.min(...players.map(p => p.pts));
          const normalizedPlayers = players.map(p => ({ ...p, pts: p.pts - minPts }));
          
          // Sort by points descending
          const sortedPlayers = [...normalizedPlayers].sort((a, b) => b.pts - a.pts);
          
          // Find user's position
          let userPlayerIndex: number | null = null;
          for (const p of players) {
            if (participantNames.includes(p.name)) {
              userPlayerIndex = p.index;
              break;
            }
          }
          
          let wolfPosition: number | null = null;
          if (userPlayerIndex) {
            wolfPosition = sortedPlayers.findIndex(p => p.index === userPlayerIndex) + 1;
          }
          
          // Create final score string (e.g., "8-5-3-0")
          const wolfFinalScore = sortedPlayers.map(p => p.pts).join('-');
          
          return { wolfPosition, wolfFinalScore };
        };

        const { wolfPosition, wolfFinalScore } = computeWolfData();

        const gameRecord = data as unknown as {
          id: string;
          course_name: string;
          round_name: string | null;
          date_played: string;
          holes_played: number;
        };

        // Calculate player count based on game type
        let playerCount = 2;
        if (gameType === "Copenhagen") playerCount = 3;
        else if (gameType === "Wolf") playerCount = 4;
        else if (gameType === "Umbriago") playerCount = 4;
        else if (gameType === "Best Ball" || gameType === "Scramble") playerCount = 4;

        setGameData({
          id: gameRecord.id,
          round_name: gameRecord.round_name,
          course_name: gameRecord.course_name,
          date: gameRecord.date_played,
          score: 0,
          playerCount,
          gameMode: gameType,
          gameType: getGameTypeForCard(gameType),
          holesPlayed: gameRecord.holes_played,
          matchResult,
          matchFinalScore,
          position,
          copenhagenFinalScore,
          scramblePosition,
          scrambleScoreToPar,
          umbriagioResult,
          umbriagioFinalScore,
          wolfPosition,
          wolfFinalScore,
        });
      } catch (err) {
        console.error("Error fetching game data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [gameType, gameId, resultUserId]);

  const handleClick = () => {
    if (gameId) {
      const gameTypeLower = gameType.toLowerCase().replace(/\s+/g, "-");
      const routeMap: Record<string, string> = {
        "best-ball": "best-ball",
        "match-play": "match-play",
        skins: "skins",
        wolf: "wolf",
        copenhagen: "copenhagen",
        scramble: "scramble",
        umbriago: "umbriago",
      };
      const route = routeMap[gameTypeLower] || gameTypeLower;
      navigate(`/${route}/${gameId}/summary`);
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return (
      <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-border">
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-4">
            <div className="w-14 h-8 bg-muted rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use fetched data or fallback
  const roundData: RoundCardData = gameData || {
    id: gameId,
    round_name: fallbackRoundName,
    course_name: fallbackCourseName,
    date: new Date().toISOString(),
    score: 0,
    playerCount: 2,
    gameMode: gameType,
    gameType: getGameTypeForCard(gameType),
  };

  return <RoundCard round={roundData} onClick={handleClick} />;
};

// Component to display Best Ball scorecard in posts
const BestBallScorecardInPost = ({
  bestBallScorecardResult,
  textContent,
}: {
  bestBallScorecardResult: NonNullable<ReturnType<typeof parseBestBallScorecardResult>>;
  textContent?: string;
}) => {
  const navigate = useNavigate();
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [loading, setLoading] = useState(true);
  const { strokePlayEnabled } = useStrokePlayEnabled(bestBallScorecardResult.gameId || '', 'best_ball');

  useEffect(() => {
    const embedded = normalizeCourseHoles((bestBallScorecardResult as any).courseHoles);
    if (embedded) {
      setCourseHoles(embedded);
      setLoading(false);
      return;
    }
      // Fallback: construct course holes from holePars
      const holes = Object.keys(bestBallScorecardResult.holePars)
        .map(holeNum => ({
          hole_number: parseInt(holeNum),
          par: bestBallScorecardResult.holePars[parseInt(holeNum)],
          stroke_index: parseInt(holeNum), // Default stroke index
        }))
        .sort((a, b) => a.hole_number - b.hole_number);
      setCourseHoles(holes);
      setLoading(false);
  }, [bestBallScorecardResult.holePars, (bestBallScorecardResult as any).courseHoles]);

  // Calculate match result from user's perspective
  const userMatchStatus = bestBallScorecardResult.matchStatus;
  let matchResult: string = 'T';
  let resultText = '';
  
  if (userMatchStatus > 0) {
    matchResult = 'W';
    resultText = `${Math.abs(userMatchStatus)} UP`;
  } else if (userMatchStatus < 0) {
    matchResult = 'L';
    resultText = `${Math.abs(userMatchStatus)} DOWN`;
  } else {
    matchResult = 'T';
    resultText = 'AS';
  }

  // Convert holeScores to holes array format
  const holes = Object.keys(bestBallScorecardResult.holeScores).map(holeNum => ({
    hole_number: parseInt(holeNum),
    team_a_scores: bestBallScorecardResult.holeScores[parseInt(holeNum)].teamAScores,
    team_b_scores: bestBallScorecardResult.holeScores[parseInt(holeNum)].teamBScores,
    match_status_after: bestBallScorecardResult.holeScores[parseInt(holeNum)].matchStatusAfter,
  }));

  const playerCount = bestBallScorecardResult.teamAPlayers.length + bestBallScorecardResult.teamBPlayers.length;

  const handleHeaderClick = () => {
    if (bestBallScorecardResult.gameId) {
      navigate(buildGameUrl('best_ball', bestBallScorecardResult.gameId, 'leaderboard', {
        entryPoint: 'home',
        viewType: 'spectator'
      }));
    } else {
      toast.error("Game details not found");
    }
  };

  const handleScorecardClick = () => {
    if (bestBallScorecardResult.gameId) {
      navigate(buildGameUrl('best_ball', bestBallScorecardResult.gameId, 'leaderboard', {
        entryPoint: 'home',
        viewType: 'spectator'
      }));
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading scorecard...</div>;
  }

  return (
    <div className="space-y-3">
      {textContent && (
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
      )}
      <BestBallScorecardView
        roundName={bestBallScorecardResult.roundName}
        courseName={bestBallScorecardResult.courseName}
        datePlayed={bestBallScorecardResult.datePlayed}
        playerCount={playerCount}
        matchResult={matchResult}
        resultText={resultText}
        teamAPlayers={bestBallScorecardResult.teamAPlayers.map(p => ({ id: p.id, displayName: p.name || '' }))}
        teamBPlayers={bestBallScorecardResult.teamBPlayers.map(p => ({ id: p.id, displayName: p.name || '' }))}
        holes={holes}
        courseHoles={courseHoles}
        strokePlayEnabled={strokePlayEnabled}
        onHeaderClick={handleHeaderClick}
        onScorecardClick={handleScorecardClick}
      />
    </div>
  );
};

// Component to display Best Ball Stroke Play scorecard in posts
const BestBallStrokePlayScorecardInPost = ({
  bestBallStrokePlayScorecardResult,
  textContent,
}: {
  bestBallStrokePlayScorecardResult: NonNullable<ReturnType<typeof parseBestBallStrokePlayScorecardResult>>;
  textContent?: string;
}) => {
  const navigate = useNavigate();
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const embedded = normalizeCourseHoles((bestBallStrokePlayScorecardResult as any).courseHoles);
    if (embedded) {
      setCourseHoles(embedded);
      setLoading(false);
      return;
    }
      // Fallback: construct course holes from holePars
      const holes = Object.keys(bestBallStrokePlayScorecardResult.holePars)
        .map(holeNum => ({
          hole_number: parseInt(holeNum),
          par: bestBallStrokePlayScorecardResult.holePars[parseInt(holeNum)],
          stroke_index: parseInt(holeNum), // Default stroke index
        }))
        .sort((a, b) => a.hole_number - b.hole_number);
      setCourseHoles(holes);
      setLoading(false);
  }, [bestBallStrokePlayScorecardResult.holePars, (bestBallStrokePlayScorecardResult as any).courseHoles]);

  const handleRoundCardClick = () => {
    if (bestBallStrokePlayScorecardResult.gameId) {
      navigate(buildGameUrl('best_ball', bestBallStrokePlayScorecardResult.gameId, 'leaderboard', {
        entryPoint: 'home',
        viewType: 'spectator'
      }));
    } else {
      toast.error("Game details not found");
    }
  };

  const handleScorecardClick = () => {
    if (bestBallStrokePlayScorecardResult.gameId) {
      navigate(buildGameUrl('best_ball', bestBallStrokePlayScorecardResult.gameId, 'leaderboard', {
        entryPoint: 'home',
        viewType: 'spectator'
      }));
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading scorecard...</div>;
  }

  return (
    <div className="space-y-3">
      {textContent && (
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
      )}
      <BestBallStrokePlayScorecardView
        roundName={bestBallStrokePlayScorecardResult.roundName}
        courseName={bestBallStrokePlayScorecardResult.courseName}
        datePlayed={bestBallStrokePlayScorecardResult.datePlayed}
        teamAName={bestBallStrokePlayScorecardResult.teamAName}
        teamBName={bestBallStrokePlayScorecardResult.teamBName}
        teamAPlayers={bestBallStrokePlayScorecardResult.teamAPlayers}
        teamBPlayers={bestBallStrokePlayScorecardResult.teamBPlayers}
        holeScores={bestBallStrokePlayScorecardResult.holeScores}
        courseHoles={courseHoles}
        userTeam={bestBallStrokePlayScorecardResult.userTeam}
        userTeamTotalScore={bestBallStrokePlayScorecardResult.userTeamTotalScore}
        userTeamScoreToPar={bestBallStrokePlayScorecardResult.userTeamScoreToPar}
        onRoundCardClick={handleRoundCardClick}
        onScorecardClick={handleScorecardClick}
      />
    </div>
  );
};

// Component to display round scorecard in posts using snapshot from posts table
const RoundScorecardInPostFromSnapshot = ({
  roundScorecardResult,
  textContent,
  postScorecardSnapshot,
}: {
  roundScorecardResult: NonNullable<ReturnType<typeof parseRoundScorecardResult>>;
  textContent?: string;
  postScorecardSnapshot?: any;
}) => {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<any>(postScorecardSnapshot || null);
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState<Map<string, { display_name: string | null; username: string | null }>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      // Use snapshot from post if available and valid (object, not array, not null)
      if (postScorecardSnapshot && 
          typeof postScorecardSnapshot === 'object' && 
          !Array.isArray(postScorecardSnapshot) &&
          postScorecardSnapshot.holes &&
          postScorecardSnapshot.players) {
        console.log('[Scorecard] Using snapshot from post');
        setSnapshot(postScorecardSnapshot);
        
        // Build course holes from snapshot
        const snapshotHoles = postScorecardSnapshot.holes || [];
        const holes = snapshotHoles.map((h: number) => {
          // Try to get par from embedded data first, fallback to 4
          const par = roundScorecardResult.holePars?.[h] || 4;
          return {
            hole_number: h,
            par: par,
            stroke_index: h,
          };
        });
        setCourseHoles(holes);

        // Fetch profiles for all players in snapshot (non-blocking)
        const players = postScorecardSnapshot.players || [];
        const userIds = players
          .map((p: any) => p.user_id)
          .filter((id: string | null) => id !== null);
        
        if (userIds.length > 0) {
          supabase
            .from('profiles')
            .select('id, display_name, username')
            .in('id', userIds)
            .then(({ data: profiles }) => {
              if (profiles) {
                const map = new Map<string, { display_name: string | null; username: string | null }>();
                profiles.forEach(p => {
                  map.set(p.id, { display_name: p.display_name, username: p.username });
                });
                setProfileMap(map);
              }
            }).then(undefined, (profileError) => {
              console.error('Error fetching profiles:', profileError);
              // Continue without profile data - will use display_name from snapshot
            });
        }
        
        setLoading(false);
        return;
      }

      // No snapshot - fallback to embedded data
      console.warn('[Scorecard] No snapshot found in post - using embedded data');
      const courseHolesFromPars = Object.keys(roundScorecardResult.holePars || {})
        .map(holeNum => ({
          hole_number: parseInt(holeNum),
          par: roundScorecardResult.holePars[parseInt(holeNum)],
          stroke_index: parseInt(holeNum),
        }))
        .sort((a, b) => a.hole_number - b.hole_number);
      setCourseHoles(courseHolesFromPars);
      setLoading(false);
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postScorecardSnapshot, roundScorecardResult.roundId]); // Depend on postScorecardSnapshot

  // Build strokePlayPlayers from snapshot or fallback to embedded data
  const buildPlayers = () => {
    if (snapshot && snapshot.players) {
      return snapshot.players.map((p: any) => {
        const profile = p.user_id ? profileMap.get(p.user_id) : null;
        const displayName = p.display_name || profile?.display_name || profile?.username || p.guest_name || 'Player';
        
        const scoresMap = new Map<number, number>();
        if (p.scores && Array.isArray(p.scores)) {
          p.scores.forEach((score: number | null, index: number) => {
            if (score !== null && score > 0) {
              scoresMap.set(index + 1, score);
            }
          });
        }

        return {
          name: displayName,
          scores: scoresMap,
          totalScore: p.total || 0,
        };
      });
    } else {
      // Fallback to embedded data
      const holeScoresMap = new Map<number, number>();
      let totalScore = 0;
      Object.entries(roundScorecardResult.holeScores || {}).forEach(([holeNum, score]) => {
        if (score && score > 0) {
          holeScoresMap.set(parseInt(holeNum), score);
          totalScore += score;
        }
      });

      return [{
        name: "Player",
        scores: holeScoresMap,
        totalScore: totalScore || roundScorecardResult.score || 0,
      }];
    }
  };

  const strokePlayPlayers = buildPlayers();

  // Build RoundCardData for the header
  const roundCardData: RoundCardData = {
    id: roundScorecardResult.roundId || '',
    round_name: roundScorecardResult.roundName,
    course_name: roundScorecardResult.courseName,
    date: roundScorecardResult.datePlayed,
    score: roundScorecardResult.scoreVsPar,
    playerCount: strokePlayPlayers.length,
    gameMode: 'Stroke Play',
    gameType: 'round',
    totalScore: roundScorecardResult.score || 0,
    holesPlayed: roundScorecardResult.holesPlayed,
  };

  const handleHeaderClick = () => {
    if (roundScorecardResult.roundId) {
      navigate(buildGameUrl('round', roundScorecardResult.roundId, 'leaderboard', { 
        entryPoint: 'home', 
        viewType: 'spectator' 
      }));
    } else {
      toast.error("Round details not found");
    }
  };

  const handleScorecardClick = () => {
    handleHeaderClick();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {textContent && (
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
        )}
        <div className="text-muted-foreground text-sm p-4">Loading scorecard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {textContent && (
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
      )}
      {/* Round Card Header - Clickable to navigate to leaderboard */}
      <div onClick={handleHeaderClick} className="cursor-pointer">
        <RoundCard 
          round={roundCardData}
          className="border-0 shadow-none hover:shadow-none"
        />
      </div>

      {/* Scorecard - Using StrokePlayScorecardView (compact scorecard table, same as in-game leaderboard) */}
      {courseHoles.length > 0 && strokePlayPlayers.length > 0 ? (
        <div onClick={handleScorecardClick} className="cursor-pointer px-4 pt-3 pb-4">
          <StrokePlayScorecardView
            players={strokePlayPlayers}
            courseHoles={courseHoles}
          />
        </div>
      ) : snapshot === null ? (
        <div className="text-muted-foreground text-sm p-4">Loading scorecard...</div>
      ) : null}
    </div>
  );
};

// Component to display Umbriago scorecard in posts
const UmbriagioScorecardInPost = ({
  umbriagioScorecardResult,
  textContent,
}: {
  umbriagioScorecardResult: NonNullable<ReturnType<typeof parseUmbriagioScorecardResult>>;
  textContent?: string;
}) => {
  const navigate = useNavigate();
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [holesData, setHolesData] = useState<Array<{
    hole_number: number;
    team_a_player_1_score: number | null;
    team_a_player_2_score: number | null;
    team_b_player_1_score: number | null;
    team_b_player_2_score: number | null;
  }>>([]);
  const [gameData, setGameData] = useState<{
    team_a_player_1: string;
    team_a_player_2: string;
    team_b_player_1: string;
    team_b_player_2: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { strokePlayEnabled } = useStrokePlayEnabled(umbriagioScorecardResult.gameId || '', 'umbriago');

  useEffect(() => {
    const fetchData = async () => {
      // Prefer embedded course holes from the post payload (avoids course_holes fetches)
      const embedded = normalizeCourseHoles((umbriagioScorecardResult as any).courseHoles);
      if (embedded) {
        setCourseHoles(embedded);
      }

      if (umbriagioScorecardResult.gameId) {
        // Fetch game data (for player names)
        const { data: gameDataResult } = await supabase
          .from("umbriago_games")
          .select("team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2")
          .eq("id", umbriagioScorecardResult.gameId)
          .single();

        if (gameDataResult) {
          setGameData({
            team_a_player_1: gameDataResult.team_a_player_1,
            team_a_player_2: gameDataResult.team_a_player_2,
            team_b_player_1: gameDataResult.team_b_player_1,
            team_b_player_2: gameDataResult.team_b_player_2,
          });

          // Fetch holes for individual player scores (for stroke play)
          if (strokePlayEnabled) {
            const { data: holesResult } = await supabase
              .from("umbriago_holes")
              .select("hole_number, team_a_player_1_score, team_a_player_2_score, team_b_player_1_score, team_b_player_2_score")
              .eq("game_id", umbriagioScorecardResult.gameId)
              .order("hole_number");

            if (holesResult) {
              setHolesData(holesResult);
            }
          }

          setLoading(false);
          return;
        }
      }

      // Fallback: construct course holes from holePars
      if (courseHoles.length === 0) {
        const holes = Object.keys(umbriagioScorecardResult.holePars)
          .map(holeNum => ({
            hole_number: parseInt(holeNum),
            par: umbriagioScorecardResult.holePars[parseInt(holeNum)],
            stroke_index: parseInt(holeNum), // Default stroke index
          }))
          .sort((a, b) => a.hole_number - b.hole_number);
        setCourseHoles(holes);
      }
      setLoading(false);
    };

    fetchData();
  }, [umbriagioScorecardResult.gameId, umbriagioScorecardResult.holePars, strokePlayEnabled, (umbriagioScorecardResult as any).courseHoles, courseHoles.length]);

  // Calculate match result from user's perspective
  const winningTeam = umbriagioScorecardResult.winningTeam;
  const currentUserTeam = umbriagioScorecardResult.currentUserTeam;
  
  let matchResult: string = '—';
  let resultText = `${umbriagioScorecardResult.normalizedA} - ${umbriagioScorecardResult.normalizedB}`;
  
  if (winningTeam === 'TIE') {
    matchResult = 'T';
    resultText = `${umbriagioScorecardResult.normalizedA} - ${umbriagioScorecardResult.normalizedB}`;
  } else if (winningTeam === currentUserTeam) {
    matchResult = 'W';
  } else if (winningTeam) {
    matchResult = 'L';
  }

  // Build holes map from fetched holes data for player scores
  const holesMap = new Map(holesData.map(h => [h.hole_number, h]));

  // Convert holePoints to holes array format (UmbriagioHole[])
  const holes = Object.keys(umbriagioScorecardResult.holePoints).map(holeNum => {
    const holeNumInt = parseInt(holeNum);
    const fetchedHole = holesMap.get(holeNumInt);
    
    return {
      id: `hole-${holeNum}`,
      game_id: umbriagioScorecardResult.gameId || '',
      hole_number: holeNumInt,
      created_at: new Date().toISOString(),
      team_a_player_1_score: fetchedHole?.team_a_player_1_score ?? null,
      team_a_player_2_score: fetchedHole?.team_a_player_2_score ?? null,
      team_b_player_1_score: fetchedHole?.team_b_player_1_score ?? null,
      team_b_player_2_score: fetchedHole?.team_b_player_2_score ?? null,
      par: umbriagioScorecardResult.holePars[holeNumInt] || 4,
      team_low_winner: null,
      individual_low_winner: null,
      closest_to_pin_winner: null,
      birdie_eagle_winner: null,
      multiplier: 1 as const,
      double_called_by: null,
      double_back_called: false,
      is_umbriago: false,
      team_a_hole_points: umbriagioScorecardResult.holePoints[holeNumInt].teamA,
      team_b_hole_points: umbriagioScorecardResult.holePoints[holeNumInt].teamB,
      team_a_running_total: 0,
      team_b_running_total: 0,
    };
  });

  // Calculate total points from holePoints
  const teamATotalPoints = Object.values(umbriagioScorecardResult.holePoints).reduce(
    (sum, h) => sum + h.teamA, 0
  );
  const teamBTotalPoints = Object.values(umbriagioScorecardResult.holePoints).reduce(
    (sum, h) => sum + h.teamB, 0
  );

  // Reconstruct minimal game object
  const game = {
    id: umbriagioScorecardResult.gameId || '',
    user_id: '',
    course_name: umbriagioScorecardResult.courseName,
    course_id: null,
    tee_set: null,
    holes_played: courseHoles.length || 18,
    date_played: umbriagioScorecardResult.datePlayed,
    created_at: new Date().toISOString(),
    round_name: umbriagioScorecardResult.roundName,
    team_a_name: umbriagioScorecardResult.teamAName,
    team_b_name: umbriagioScorecardResult.teamBName,
    team_a_player_1: gameData?.team_a_player_1 || '',
    team_a_player_2: gameData?.team_a_player_2 || '',
    team_b_player_1: gameData?.team_b_player_1 || '',
    team_b_player_2: gameData?.team_b_player_2 || '',
    stake_per_point: 0,
    payout_mode: 'difference' as const,
    stats_mode: null,
    team_a_total_points: teamATotalPoints,
    team_b_total_points: teamBTotalPoints,
    rolls_per_team: 0,
    roll_history: [],
    is_finished: true,
    winning_team: winningTeam,
    final_payout: null,
  };

  const playerCount = 4; // Umbriago is always 4 players

  // Build stroke play players from holes data (if available)
  const buildStrokePlayPlayers = () => {
    if (!gameData || holesData.length === 0) {
      return [];
    }

    const player1Scores = new Map<number, number>();
    const player2Scores = new Map<number, number>();
    const player3Scores = new Map<number, number>();
    const player4Scores = new Map<number, number>();
    
    let player1Total = 0;
    let player2Total = 0;
    let player3Total = 0;
    let player4Total = 0;

    holesData.forEach(hole => {
      // Team A Player 1
      if (hole.team_a_player_1_score !== null && hole.team_a_player_1_score > 0) {
        player1Scores.set(hole.hole_number, hole.team_a_player_1_score);
        player1Total += hole.team_a_player_1_score;
      }
      // Team A Player 2
      if (hole.team_a_player_2_score !== null && hole.team_a_player_2_score > 0) {
        player2Scores.set(hole.hole_number, hole.team_a_player_2_score);
        player2Total += hole.team_a_player_2_score;
      }
      // Team B Player 1
      if (hole.team_b_player_1_score !== null && hole.team_b_player_1_score > 0) {
        player3Scores.set(hole.hole_number, hole.team_b_player_1_score);
        player3Total += hole.team_b_player_1_score;
      }
      // Team B Player 2
      if (hole.team_b_player_2_score !== null && hole.team_b_player_2_score > 0) {
        player4Scores.set(hole.hole_number, hole.team_b_player_2_score);
        player4Total += hole.team_b_player_2_score;
      }
    });

    return [
      { name: gameData.team_a_player_1, scores: player1Scores, totalScore: player1Total, team: 'A' as const },
      { name: gameData.team_a_player_2, scores: player2Scores, totalScore: player2Total, team: 'A' as const },
      { name: gameData.team_b_player_1, scores: player3Scores, totalScore: player3Total, team: 'B' as const },
      { name: gameData.team_b_player_2, scores: player4Scores, totalScore: player4Total, team: 'B' as const },
    ];
  };

  const strokePlayPlayers = buildStrokePlayPlayers();

  const handleHeaderClick = () => {
    if (umbriagioScorecardResult.gameId) {
      // Mark as spectator to prevent share dialog
      sessionStorage.setItem(`spectator_umbriago_${umbriagioScorecardResult.gameId}`, 'true');
      navigate(`/umbriago/${umbriagioScorecardResult.gameId}/summary`);
    } else {
      toast.error("Game details not found");
    }
  };

  const handleScorecardClick = () => {
    if (umbriagioScorecardResult.gameId) {
      // Mark as spectator to prevent share dialog
      sessionStorage.setItem(`spectator_umbriago_${umbriagioScorecardResult.gameId}`, 'true');
      navigate(`/umbriago/${umbriagioScorecardResult.gameId}/summary`);
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading scorecard...</div>;
  }

  return (
    <div className="space-y-3">
      {textContent && (
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
      )}
      <UmbriagioScorecardView
        roundName={umbriagioScorecardResult.roundName}
        courseName={umbriagioScorecardResult.courseName}
        datePlayed={umbriagioScorecardResult.datePlayed}
        playerCount={playerCount}
        matchResult={matchResult}
        resultText={resultText}
        game={game}
        holes={holes}
        courseHoles={courseHoles}
        currentUserTeam={currentUserTeam}
        strokePlayEnabled={strokePlayEnabled}
        strokePlayPlayers={strokePlayPlayers}
        onHeaderClick={handleHeaderClick}
        onScorecardClick={handleScorecardClick}
      />
    </div>
  );
};

// Component to display Copenhagen scorecard in posts
const CopenhagenScorecardInPost = ({
  copenhagenScorecardResult,
  textContent,
}: {
  copenhagenScorecardResult: NonNullable<ReturnType<typeof parseCopenhagenScorecardResult>>;
  textContent?: string;
}) => {
  const navigate = useNavigate();
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [userPosition, setUserPosition] = useState<number>(1);
  const { strokePlayEnabled } = useStrokePlayEnabled(copenhagenScorecardResult.gameId || '', 'copenhagen');

  useEffect(() => {
    const fetchData = async () => {
      if (copenhagenScorecardResult.gameId) {
        // Fetch game owner id (used for tie-breaking when determining user position)
        const { data: gameData } = await supabase
          .from("copenhagen_games")
          .select("user_id")
          .eq("id", copenhagenScorecardResult.gameId)
          .single();

        // Calculate user's position (same logic as unifiedRoundsLoader.ts for Profile)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .single();

          // Build participantNames array (same as unifiedRoundsLoader.ts)
          const participantNames = [profile?.display_name, profile?.username]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((v) => v.trim());

          // Find which player the user is (exact matching, same as Profile)
          let userPlayerIndex: number | null = null;
          
          if (participantNames.some(n => n === copenhagenScorecardResult.player1)) {
            userPlayerIndex = 1;
          } else if (participantNames.some(n => n === copenhagenScorecardResult.player2)) {
            userPlayerIndex = 2;
          } else if (participantNames.some(n => n === copenhagenScorecardResult.player3)) {
            userPlayerIndex = 3;
          } else if (gameData?.user_id === user.id) {
            userPlayerIndex = 1;
          }

          if (userPlayerIndex) {
            // Calculate position based on points (same as unifiedRoundsLoader.ts)
            const rawPoints = [
              { player: 1, pts: copenhagenScorecardResult.player1Points || 0 },
              { player: 2, pts: copenhagenScorecardResult.player2Points || 0 },
              { player: 3, pts: copenhagenScorecardResult.player3Points || 0 },
            ];
            
            // Normalize points (subtract minimum so lowest is 0)
            const minPts = Math.min(...rawPoints.map(p => p.pts));
            const normalizedPoints = rawPoints.map(p => ({ ...p, pts: p.pts - minPts }));
            
            // Sort by points descending for position calculation
            const sortedPoints = [...normalizedPoints].sort((a, b) => b.pts - a.pts);
            
            const position = sortedPoints.findIndex(p => p.player === userPlayerIndex) + 1;
            setUserPosition(position);
          }
        }
      }

      const embedded = normalizeCourseHoles((copenhagenScorecardResult as any).courseHoles);
      if (embedded) {
        setCourseHoles(embedded);
      } else if (courseHoles.length === 0) {
        // Fallback: construct course holes from holePars
        const holes = Object.keys(copenhagenScorecardResult.holePars)
          .map(holeNum => ({
            hole_number: parseInt(holeNum),
            par: copenhagenScorecardResult.holePars[parseInt(holeNum)],
            stroke_index: parseInt(holeNum),
          }))
          .sort((a, b) => a.hole_number - b.hole_number);
        setCourseHoles(holes);
      }
      setLoading(false);
    };

    fetchData();
  }, [copenhagenScorecardResult.gameId, copenhagenScorecardResult.holePars, courseHoles.length, (copenhagenScorecardResult as any).courseHoles]);

  // Build holes array from scorecard data
  const holes = Object.keys(copenhagenScorecardResult.holeScores).map(holeNum => {
    const holeNumInt = parseInt(holeNum);
    const holeData = copenhagenScorecardResult.holeScores[holeNumInt];
    
    return {
      id: `hole-${holeNum}`,
      game_id: copenhagenScorecardResult.gameId || '',
      hole_number: holeNumInt,
      par: copenhagenScorecardResult.holePars[holeNumInt] || 4,
      stroke_index: null,
      created_at: new Date().toISOString(),
      player_1_gross_score: holeData.p1,
      player_2_gross_score: holeData.p2,
      player_3_gross_score: holeData.p3,
      player_1_net_score: null,
      player_2_net_score: null,
      player_3_net_score: null,
      player_1_hole_points: holeData.p1pts,
      player_2_hole_points: holeData.p2pts,
      player_3_hole_points: holeData.p3pts,
      player_1_running_total: 0,
      player_2_running_total: 0,
      player_3_running_total: 0,
      is_sweep: false,
      sweep_winner: null,
    };
  });

  // Reconstruct minimal game object
  const game = {
    id: copenhagenScorecardResult.gameId || '',
    user_id: '',
    course_name: copenhagenScorecardResult.courseName,
    course_id: null,
    tee_set: null,
    holes_played: courseHoles.length || 18,
    date_played: copenhagenScorecardResult.datePlayed,
    created_at: new Date().toISOString(),
    round_name: copenhagenScorecardResult.roundName,
    player_1: copenhagenScorecardResult.player1,
    player_2: copenhagenScorecardResult.player2,
    player_3: copenhagenScorecardResult.player3,
    player_1_handicap: null,
    player_2_handicap: null,
    player_3_handicap: null,
    player_1_tee: null,
    player_2_tee: null,
    player_3_tee: null,
    use_handicaps: false,
    stats_mode: null,
    player_1_total_points: copenhagenScorecardResult.player1Points,
    player_2_total_points: copenhagenScorecardResult.player2Points,
    player_3_total_points: copenhagenScorecardResult.player3Points,
    is_finished: true,
    winner_player: copenhagenScorecardResult.winner,
  };

  // Build stroke play players
  const strokePlayPlayers = [1, 2, 3].map(idx => {
    const playerName = idx === 1 ? game.player_1 : idx === 2 ? game.player_2 : game.player_3;
    const scoresMap = new Map<number, number>();
    let totalScore = 0;

    holes.forEach(hole => {
      const score = idx === 1 ? hole.player_1_gross_score : idx === 2 ? hole.player_2_gross_score : hole.player_3_gross_score;
      if (score !== null && score > 0) {
        scoresMap.set(hole.hole_number, score);
        totalScore += score;
      }
    });

    return {
      name: playerName,
      scores: scoresMap,
      totalScore,
    };
  });

  // Get winner info for display
  const players = [
    { name: game.player_1, points: game.player_1_total_points },
    { name: game.player_2, points: game.player_2_total_points },
    { name: game.player_3, points: game.player_3_total_points },
  ].sort((a, b) => b.points - a.points);

  // Final score format: "8-3-0" (sorted by points descending)
  const finalScore = `${players[0].points}-${players[1].points}-${players[2].points}`;

  const handleHeaderClick = () => {
    if (copenhagenScorecardResult.gameId) {
      sessionStorage.setItem(`spectator_copenhagen_${copenhagenScorecardResult.gameId}`, 'true');
      navigate(`/copenhagen/${copenhagenScorecardResult.gameId}/leaderboard`);
    } else {
      toast.error("Game details not found");
    }
  };

  const handleScorecardClick = () => {
    if (copenhagenScorecardResult.gameId) {
      sessionStorage.setItem(`spectator_copenhagen_${copenhagenScorecardResult.gameId}`, 'true');
      navigate(`/copenhagen/${copenhagenScorecardResult.gameId}/leaderboard`);
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading scorecard...</div>;
  }

  return (
    <div className="space-y-3">
      {textContent && (
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
      )}
      <CopenhagenScorecardView
        roundName={copenhagenScorecardResult.roundName}
        courseName={copenhagenScorecardResult.courseName}
        datePlayed={copenhagenScorecardResult.datePlayed}
        playerCount={3}
        position={userPosition}
        finalScore={finalScore}
        game={game}
        holes={holes}
        courseHoles={courseHoles}
        strokePlayEnabled={strokePlayEnabled}
        strokePlayPlayers={strokePlayPlayers}
        onHeaderClick={handleHeaderClick}
        onScorecardClick={handleScorecardClick}
      />
    </div>
  );
};

// Component to display Scramble scorecard in posts
const ScrambleScorecardInPost = ({
  scrambleScorecardResult,
  textContent,
}: {
  scrambleScorecardResult: NonNullable<ReturnType<typeof parseScrambleScorecardResult>>;
  textContent?: string;
}) => {
  const navigate = useNavigate();
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [userPosition, setUserPosition] = useState<number>(1);
  const [userScoreToPar, setUserScoreToPar] = useState<string>("E");

  // Build teams from parsed data
  const teams = scrambleScorecardResult.teams.map(t => ({
    id: t.id,
    name: t.name,
    players: t.players.map(p => ({
      id: p.id,
      name: p.name,
    })),
  }));

  // Build holes from parsed data
  const holes = Object.keys(scrambleScorecardResult.holeScores).map(holeNum => {
    const holeNumInt = parseInt(holeNum);
    return {
      id: `hole-${holeNum}`,
      game_id: scrambleScorecardResult.gameId || '',
      hole_number: holeNumInt,
      par: scrambleScorecardResult.holePars[holeNumInt] || 4,
      stroke_index: null,
      created_at: new Date().toISOString(),
      team_scores: scrambleScorecardResult.holeScores[holeNumInt],
    };
  });

  // Calculate team scores
  const calculateTeamScores = () => {
    return teams.map(team => {
      let total = 0;
      let parTotal = 0;

      holes.forEach(hole => {
        const score = hole.team_scores[team.id];
        if (score !== null && score !== undefined && score > 0) {
          total += score;
          parTotal += hole.par;
        }
      });

      return {
        team,
        total,
        toPar: total - parTotal,
      };
    }).sort((a, b) => {
      if (a.total === 0 && b.total === 0) return 0;
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return a.total - b.total;
    });
  };

  const teamScores = calculateTeamScores();

  // Format score to par
  const formatScoreToPar = (toPar: number) => {
    if (toPar === 0) return 'E';
    return toPar > 0 ? `+${toPar}` : `${toPar}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (scrambleScorecardResult.gameId) {
        // Fetch game owner id (used for tie-breaking when determining user position)
        const { data: gameData } = await supabase
          .from("scramble_games")
          .select("user_id")
          .eq("id", scrambleScorecardResult.gameId)
          .single();

        // Calculate user's position
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .single();

          const participantNames = [profile?.display_name, profile?.username]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((v) => v.trim());

          // Find which team the user is on
          let userTeamId: string | null = null;
          
          for (const team of teams) {
            for (const player of team.players) {
              if (participantNames.includes(player.name)) {
                userTeamId = team.id;
                break;
              }
            }
            if (userTeamId) break;
          }

          // If not found in teams but user owns the game, default to first team
          if (!userTeamId && gameData?.user_id === user.id && teams.length > 0) {
            userTeamId = teams[0].id;
          }

          if (userTeamId) {
            const userTeamIndex = teamScores.findIndex(ts => ts.team.id === userTeamId);
            if (userTeamIndex !== -1) {
              setUserPosition(userTeamIndex + 1);
              setUserScoreToPar(formatScoreToPar(teamScores[userTeamIndex].toPar));
            }
          }
        }
      }

      const embedded = normalizeCourseHoles((scrambleScorecardResult as any).courseHoles);
      if (embedded) {
        setCourseHoles(embedded);
      } else if (courseHoles.length === 0) {
        // Fallback: construct course holes from holePars
        const holesFromPars = Object.keys(scrambleScorecardResult.holePars)
          .map(holeNum => ({
            hole_number: parseInt(holeNum),
            par: scrambleScorecardResult.holePars[parseInt(holeNum)],
            stroke_index: parseInt(holeNum),
          }))
          .sort((a, b) => a.hole_number - b.hole_number);
        setCourseHoles(holesFromPars);
      }
      setLoading(false);
    };

    fetchData();
  }, [scrambleScorecardResult.gameId, scrambleScorecardResult.holePars, courseHoles.length, (scrambleScorecardResult as any).courseHoles]);

  // Reconstruct minimal game object
  const game = {
    id: scrambleScorecardResult.gameId || '',
    user_id: '',
    course_name: scrambleScorecardResult.courseName,
    course_id: null,
    tee_set: null,
    holes_played: courseHoles.length || 18,
    date_played: scrambleScorecardResult.datePlayed,
    created_at: new Date().toISOString(),
    round_name: scrambleScorecardResult.roundName,
    teams: teams,
    min_drives_per_player: null,
    use_handicaps: false,
    scoring_type: 'gross' as const,
    stats_mode: null,
    is_finished: true,
    winning_team: scrambleScorecardResult.winningTeam,
  };

  // Count total players
  const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);

  const handleHeaderClick = () => {
    if (scrambleScorecardResult.gameId) {
      sessionStorage.setItem(`spectator_scramble_${scrambleScorecardResult.gameId}`, 'true');
      navigate(`/scramble/${scrambleScorecardResult.gameId}/leaderboard`);
    } else {
      toast.error("Game details not found");
    }
  };

  const handleScorecardClick = () => {
    if (scrambleScorecardResult.gameId) {
      sessionStorage.setItem(`spectator_scramble_${scrambleScorecardResult.gameId}`, 'true');
      navigate(`/scramble/${scrambleScorecardResult.gameId}/leaderboard`);
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading scorecard...</div>;
  }

  return (
    <div className="space-y-3">
      {textContent && (
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
      )}
      <ScrambleScorecardView
        roundName={scrambleScorecardResult.roundName}
        courseName={scrambleScorecardResult.courseName}
        datePlayed={scrambleScorecardResult.datePlayed}
        playerCount={totalPlayers}
        position={userPosition}
        scoreToPar={userScoreToPar}
        game={game}
        teams={teams}
        holes={holes}
        courseHoles={courseHoles}
        onHeaderClick={handleHeaderClick}
        onScorecardClick={handleScorecardClick}
      />
    </div>
  );
};

// Component to display Skins scorecard in posts
const SkinsScorecardInPost = ({
  skinsScorecardResult,
  textContent,
}: {
  skinsScorecardResult: NonNullable<ReturnType<typeof parseSkinsScorecardResult>>;
  textContent?: string;
}) => {
  const navigate = useNavigate();
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [userPosition, setUserPosition] = useState<number>(1);
  const [userSkinsWon, setUserSkinsWon] = useState<number>(0);
  const { strokePlayEnabled } = useStrokePlayEnabled(skinsScorecardResult.gameId || '', 'skins');

  // Build players array from parsed data
  const players = Object.entries(skinsScorecardResult.playerScores).map(([id, data]) => ({
    id,
    odId: id,
    name: data.name,
    displayName: data.name,
    skins: data.skins,
  }));

  // Sort players by skins
  const sortedPlayers = [...players].sort((a, b) => b.skins - a.skins);

  useEffect(() => {
    const fetchData = async () => {
      if (skinsScorecardResult.gameId) {
        // Fetch game owner id (used for tie-breaking when determining user position)
        const { data: gameData } = await supabase
          .from("skins_games")
          .select("user_id")
          .eq("id", skinsScorecardResult.gameId)
          .maybeSingle();

        // Calculate user's position
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .single();

          const participantNames = [profile?.display_name, profile?.username]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((v) => v.trim());

          // Find which player the user is
          let userPlayerId: string | null = null;
          
          for (const player of players) {
            if (participantNames.includes(player.name)) {
              userPlayerId = player.id;
              break;
            }
          }

          // If not found by name but user owns the game, default to first player
          if (!userPlayerId && gameData?.user_id === user.id && players.length > 0) {
            userPlayerId = players[0].id;
          }

          if (userPlayerId) {
            const userSkins = skinsScorecardResult.playerScores[userPlayerId]?.skins || 0;
            const position = sortedPlayers.filter(p => p.skins > userSkins).length + 1;
            
            setUserPosition(position);
            setUserSkinsWon(userSkins);
          }
        }
      }

      const embedded = normalizeCourseHoles((skinsScorecardResult as any).courseHoles);
      if (embedded) {
        setCourseHoles(embedded);
      } else if (courseHoles.length === 0 && skinsScorecardResult.holeResults) {
        // Fallback: construct course holes from holeResults
        const holesFromResults = Object.keys(skinsScorecardResult.holeResults)
          .map(holeNum => ({
            hole_number: parseInt(holeNum),
            par: skinsScorecardResult.holeResults[parseInt(holeNum)]?.par || 4,
            stroke_index: parseInt(holeNum),
          }))
          .sort((a, b) => a.hole_number - b.hole_number);
        setCourseHoles(holesFromResults);
      }
      setLoading(false);
    };

    fetchData();
  }, [skinsScorecardResult.gameId, skinsScorecardResult.holeResults, skinsScorecardResult.playerScores, courseHoles.length, (skinsScorecardResult as any).courseHoles]);

  const handleHeaderClick = () => {
    if (skinsScorecardResult.gameId) {
      sessionStorage.setItem(`spectator_skins_${skinsScorecardResult.gameId}`, 'true');
      navigate(`/skins/${skinsScorecardResult.gameId}/leaderboard`);
    } else {
      toast.error("Game details not found");
    }
  };

  const handleScorecardClick = () => {
    if (skinsScorecardResult.gameId) {
      sessionStorage.setItem(`spectator_skins_${skinsScorecardResult.gameId}`, 'true');
      navigate(`/skins/${skinsScorecardResult.gameId}/leaderboard`);
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading scorecard...</div>;
  }

  // Build holes array from parsed data
  const holes = Object.entries(skinsScorecardResult.holeResults).map(([holeNum, data]) => {
    const holeNumInt = parseInt(holeNum);
    return {
      id: `hole-${holeNum}`,
      game_id: skinsScorecardResult.gameId || '',
      hole_number: holeNumInt,
      par: data.par,
      player_scores: data.playerScores || {},
      winner_player: data.winnerId,
      skins_available: data.skinsAvailable,
      is_carryover: false,
    };
  });

  return (
    <div className="space-y-3">
      {textContent && (
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
      )}
      <SkinsScorecardView
        roundName={skinsScorecardResult.roundName}
        courseName={skinsScorecardResult.courseName}
        datePlayed={skinsScorecardResult.datePlayed}
        playerCount={players.length}
        position={userPosition}
        skinsWon={userSkinsWon}
        players={players}
        holes={holes}
        courseHoles={courseHoles}
        strokePlayEnabled={strokePlayEnabled}
        onHeaderClick={handleHeaderClick}
        onScorecardClick={handleScorecardClick}
      />
    </div>
  );
};

// Component to display Wolf scorecard in posts
const WolfScorecardInPost = ({
  wolfScorecardResult,
  textContent,
}: {
  wolfScorecardResult: NonNullable<ReturnType<typeof parseWolfScorecardResult>>;
  textContent?: string;
}) => {
  const navigate = useNavigate();
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [userPosition, setUserPosition] = useState<number>(1);
  const [userPointsWon, setUserPointsWon] = useState<number>(0);
  const { strokePlayEnabled } = useStrokePlayEnabled(wolfScorecardResult.gameId || '', 'wolf');

  // Build players array from parsed data
  const players = Object.entries(wolfScorecardResult.playerScores).map(([num, data]) => ({
    num: parseInt(num),
    name: data.name,
    points: data.points,
  }));

  // Sort players by points
  const sortedPlayers = [...players].sort((a, b) => b.points - a.points);

  useEffect(() => {
    const fetchData = async () => {
      if (wolfScorecardResult.gameId) {
        // Fetch game owner id (used for tie-breaking when determining user position)
        const { data: gameData } = await supabase
          .from("wolf_games")
          .select("user_id")
          .eq("id", wolfScorecardResult.gameId)
          .single();

        // Calculate user's position
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .single();

          const participantNames = [profile?.display_name, profile?.username]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((v) => v.trim());

          // Find which player the user is
          let userPlayerNum: number | null = null;
          
          for (const player of players) {
            if (participantNames.includes(player.name)) {
              userPlayerNum = player.num;
              break;
            }
          }

          // If not found by name but user owns the game, default to first player
          if (!userPlayerNum && gameData?.user_id === user.id && players.length > 0) {
            userPlayerNum = 1;
          }

          if (userPlayerNum) {
            const userPoints = wolfScorecardResult.playerScores[userPlayerNum.toString()]?.points || 0;
            const position = sortedPlayers.filter(p => p.points > userPoints).length + 1;
            
            setUserPosition(position);
            setUserPointsWon(userPoints);
          }
        }
      }

      const embedded = normalizeCourseHoles((wolfScorecardResult as any).courseHoles);
      if (embedded) {
        setCourseHoles(embedded);
      } else if (courseHoles.length === 0 && wolfScorecardResult.holeResults) {
        // Fallback: construct course holes from holeResults
        const holesFromResults = Object.keys(wolfScorecardResult.holeResults)
          .map(holeNum => ({
            hole_number: parseInt(holeNum),
            par: wolfScorecardResult.holeResults[parseInt(holeNum)]?.par || 4,
            stroke_index: parseInt(holeNum),
          }))
          .sort((a, b) => a.hole_number - b.hole_number);
        setCourseHoles(holesFromResults);
      }
      setLoading(false);
    };

    fetchData();
  }, [wolfScorecardResult.gameId, wolfScorecardResult.holeResults, wolfScorecardResult.playerScores, courseHoles.length, (wolfScorecardResult as any).courseHoles]);

  const handleHeaderClick = () => {
    if (wolfScorecardResult.gameId) {
      sessionStorage.setItem(`spectator_wolf_${wolfScorecardResult.gameId}`, 'true');
      navigate(`/wolf/${wolfScorecardResult.gameId}/leaderboard`);
    } else {
      toast.error("Game details not found");
    }
  };

  const handleScorecardClick = () => {
    if (wolfScorecardResult.gameId) {
      sessionStorage.setItem(`spectator_wolf_${wolfScorecardResult.gameId}`, 'true');
      navigate(`/wolf/${wolfScorecardResult.gameId}/leaderboard`);
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading scorecard...</div>;
  }

  // Build holes array from parsed data
  const holes = Object.entries(wolfScorecardResult.holeResults).map(([holeNum, data]) => {
    const holeNumInt = parseInt(holeNum);
    return {
      hole_number: holeNumInt,
      par: data.par,
      scores: data.scores,
      points: data.points,
    };
  });

  return (
    <div className="space-y-3">
      {textContent && (
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
      )}
      <WolfScorecardView
        roundName={wolfScorecardResult.roundName}
        courseName={wolfScorecardResult.courseName}
        datePlayed={wolfScorecardResult.datePlayed}
        playerCount={players.length}
        position={userPosition}
        pointsWon={userPointsWon}
        players={players}
        holes={holes}
        courseHoles={courseHoles}
        strokePlayEnabled={strokePlayEnabled}
        onHeaderClick={handleHeaderClick}
        onScorecardClick={handleScorecardClick}
      />
    </div>
  );
};

// Component to display Match Play scorecard in posts
const MatchPlayScorecardInPost = ({
  matchPlayScorecardResult,
  textContent,
}: {
  matchPlayScorecardResult: NonNullable<ReturnType<typeof parseMatchPlayScorecardResult>>;
  textContent?: string;
}) => {
  const navigate = useNavigate();
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [loading, setLoading] = useState(true);
  const { strokePlayEnabled } = useStrokePlayEnabled(matchPlayScorecardResult.gameId || '', 'match_play');

  useEffect(() => {
    const embedded = normalizeCourseHoles((matchPlayScorecardResult as any).courseHoles);
    if (embedded) {
      setCourseHoles(embedded);
      setLoading(false);
      return;
    }
      // Fallback: construct course holes from holePars
      const holes = Object.keys(matchPlayScorecardResult.holePars)
        .map(holeNum => ({
          hole_number: parseInt(holeNum),
          par: matchPlayScorecardResult.holePars[parseInt(holeNum)],
          stroke_index: parseInt(holeNum), // Default stroke index
        }))
        .sort((a, b) => a.hole_number - b.hole_number);
      setCourseHoles(holes);
      setLoading(false);
  }, [matchPlayScorecardResult.holePars, (matchPlayScorecardResult as any).courseHoles]);

  // Convert holeScores to holes array format for MatchPlayScorecardView
  const holes = Object.keys(matchPlayScorecardResult.holeScores).map(holeNum => {
    const holeData = matchPlayScorecardResult.holeScores[parseInt(holeNum)];
    return {
      hole_number: parseInt(holeNum),
      player_1_gross_score: holeData.player1,
      player_2_gross_score: holeData.player2,
      hole_result: holeData.result,
      match_status_after: holeData.statusAfter,
    };
  });

  // Build stroke play players for the Stroke Play tab
  const buildStrokePlayPlayers = () => {
    const player1Scores = new Map<number, number>();
    const player2Scores = new Map<number, number>();
    let player1Total = 0;
    let player2Total = 0;

    holes.forEach(hole => {
      if (hole.player_1_gross_score && hole.player_1_gross_score > 0) {
        player1Scores.set(hole.hole_number, hole.player_1_gross_score);
        player1Total += hole.player_1_gross_score;
      }
      if (hole.player_2_gross_score && hole.player_2_gross_score > 0) {
        player2Scores.set(hole.hole_number, hole.player_2_gross_score);
        player2Total += hole.player_2_gross_score;
      }
    });

    return [
      { name: matchPlayScorecardResult.player1Name, scores: player1Scores, totalScore: player1Total },
      { name: matchPlayScorecardResult.player2Name, scores: player2Scores, totalScore: player2Total },
    ];
  };

  const strokePlayPlayers = buildStrokePlayPlayers();

  const handleHeaderClick = () => {
    if (matchPlayScorecardResult.gameId) {
      navigate(buildGameUrl('match_play', matchPlayScorecardResult.gameId, 'leaderboard', {
        entryPoint: 'home',
        viewType: 'spectator'
      }));
    } else {
      toast.error("Game details not found");
    }
  };

  const handleScorecardClick = () => {
    if (matchPlayScorecardResult.gameId) {
      navigate(buildGameUrl('match_play', matchPlayScorecardResult.gameId, 'leaderboard', {
        entryPoint: 'home',
        viewType: 'spectator'
      }));
    } else {
      toast.error("Game details not found");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading scorecard...</div>;
  }

  return (
    <div className="space-y-3">
      {textContent && (
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{textContent}</p>
      )}
      <MatchPlayScorecardView
        roundName={matchPlayScorecardResult.roundName}
        courseName={matchPlayScorecardResult.courseName}
        datePlayed={matchPlayScorecardResult.datePlayed}
        player1Name={matchPlayScorecardResult.player1Name}
        player2Name={matchPlayScorecardResult.player2Name}
        matchStatus={matchPlayScorecardResult.matchStatus}
        holes={holes}
        courseHoles={courseHoles}
        strokePlayEnabled={strokePlayEnabled}
        strokePlayPlayers={strokePlayPlayers}
        onHeaderClick={handleHeaderClick}
        onScorecardClick={handleScorecardClick}
      />
    </div>
  );
};

interface FeedPostProps {
  post: any;
  currentUserId: string;
  onPostDeleted?: () => void;
}

export const FeedPost = ({ post, currentUserId, onPostDeleted }: FeedPostProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostContent, setEditPostContent] = useState("");
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Comment likes and replies state
  const [commentLikes, setCommentLikes] = useState<Map<string, { count: number; userHasLiked: boolean }>>(new Map());
  const [commentReplyCounts, setCommentReplyCounts] = useState<Map<string, number>>(new Map());
  const [commentReplies, setCommentReplies] = useState<Map<string, Array<{
    id: string;
    content: string;
    user_id: string;
    created_at: string;
    profiles: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    } | null;
  }>>>(new Map());
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState<Map<string, string>>(new Map());

  const isOwnPost = post.user_id === currentUserId;

  // Initialize engagement counts from preloaded data (non-blocking).
  // Parents (Home/Profile) batch-fetch these to avoid N+1 requests.
  useEffect(() => {
    const engagement = post?._engagement;
    setLiked(!!engagement?.likedByMe);
    setLikeCount(typeof engagement?.likeCount === "number" ? engagement.likeCount : 0);
    setCommentCount(typeof engagement?.commentCount === "number" ? engagement.commentCount : 0);
    // Reset per-post comment state when switching posts.
    setComments([]);
    setShowComments(false);
    setCommentsLoaded(false);
    setCommentLikes(new Map());
    setCommentReplyCounts(new Map());
    setCommentReplies(new Map());
    setExpandedReplies(new Set());
    setReplyText(new Map());
  }, [post?.id]);

  const handleProfileClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };
    
  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      toast.success("Post deleted");
      setShowDeleteDialog(false);
      onPostDeleted?.();
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditPost = () => {
    // Only allow editing the user's caption text (never embedded payload blocks).
    setEditPostContent(getEditablePostText(post.content));
    setIsEditingPost(true);
  };

  const handleSavePost = async () => {
    setIsSavingPost(true);
    try {
      // Preserve special result tags if they exist
      let newContent = editPostContent.trim();
      
      const embeddedBlockRegexes: RegExp[] = [
        /\[DRILL_RESULT\][\s\S]*?\[\/DRILL_RESULT\]/g,
        /\[ROUND_SCORECARD\][\s\S]*?\[\/ROUND_SCORECARD\]/g,
        /\[MATCH_PLAY_SCORECARD\][\s\S]*?\[\/MATCH_PLAY_SCORECARD\]/g,
        /\[BEST_BALL_SCORECARD\][\s\S]*?\[\/BEST_BALL_SCORECARD\]/g,
        /\[BEST_BALL_STROKE_PLAY_SCORECARD\][\s\S]*?\[\/BEST_BALL_STROKE_PLAY_SCORECARD\]/g,
        /\[UMBRIAGO_SCORECARD\][\s\S]*?\[\/UMBRIAGO_SCORECARD\]/g,
        /\[COPENHAGEN_SCORECARD\][\s\S]*?\[\/COPENHAGEN_SCORECARD\]/g,
        /\[SCRAMBLE_SCORECARD\][\s\S]*?\[\/SCRAMBLE_SCORECARD\]/g,
        /\[SKINS_SCORECARD\][\s\S]*?\[\/SKINS_SCORECARD\]/g,
        /\[WOLF_SCORECARD\][\s\S]*?\[\/WOLF_SCORECARD\]/g,
        /\[ROUND_RESULT\][\s\S]*?\[\/ROUND_RESULT\]/g,
        /\[UMBRIAGO_RESULT\][\s\S]*?\[\/UMBRIAGO_RESULT\]/g,
        /\[GAME_RESULT\][\s\S]*?\[\/GAME_RESULT\]/g,
      ];

      const preservedBlocks: string[] = [];
      for (const re of embeddedBlockRegexes) {
        const matches = post.content?.match(re);
        if (matches?.length) preservedBlocks.push(...matches);
      }

      if (preservedBlocks.length) {
        newContent = [newContent, ...preservedBlocks].filter(Boolean).join("\n");
      }

      const { error } = await supabase
        .from("posts")
        .update({ content: newContent || null })
        .eq("id", post.id)
        .eq("user_id", currentUserId);

      if (error) throw error;

      // Update local state
      post.content = newContent || null;
      setIsEditingPost(false);
      toast.success("Post updated");
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Failed to update post");
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleCancelEditPost = () => {
    setIsEditingPost(false);
    setEditPostContent("");
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select(`
        *,
        profiles:user_id (
          display_name,
          username,
          avatar_url
        )
      `)
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });

    if (data) {
      setComments(data);
      setCommentCount(data.length);
      
      // Fetch likes and reply counts for each comment
      const likesMap = new Map<string, { count: number; userHasLiked: boolean }>();
      const replyCountsMap = new Map<string, number>();
      
      await Promise.all(data.map(async (comment) => {
        // Fetch like count
        const { count: likesCount } = await supabase
          .from("post_comment_likes")
          .select("*", { count: "exact", head: true })
          .eq("comment_id", comment.id);
        
        // Check if current user has liked
        let userHasLiked = false;
        if (currentUserId) {
          const { data: likeData } = await supabase
            .from("post_comment_likes")
            .select("id")
            .eq("comment_id", comment.id)
            .eq("user_id", currentUserId)
            .maybeSingle();
          userHasLiked = !!likeData;
        }
        
        // Fetch reply count
        const { count: repliesCount } = await supabase
          .from("post_comment_replies")
          .select("*", { count: "exact", head: true })
          .eq("comment_id", comment.id);
        
        likesMap.set(comment.id, {
          count: likesCount || 0,
          userHasLiked,
        });
        
        replyCountsMap.set(comment.id, repliesCount || 0);
      }));
      
      setCommentLikes(likesMap);
      setCommentReplyCounts(replyCountsMap);
      
      // Reset expanded replies and loaded replies when comments change
      setExpandedReplies(new Set());
      setCommentReplies(new Map());
      
      try {
        const { setCachedPostEngagement } = await import("@/utils/postsEngagement");
        setCachedPostEngagement(post.id, currentUserId, {
          likeCount,
          commentCount: data.length,
          likedByMe: liked,
        });
      } catch {
        // ignore cache update failures
      }
    }
  };

  useEffect(() => {
    if (showComments && !commentsLoaded) {
      loadComments();
      setCommentsLoaded(true);
    }
  }, [showComments, commentsLoaded]);

  const handleLike = async () => {
    try {
      if (liked) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        const nextLiked = false;
        const nextLikeCount = Math.max(0, likeCount - 1);
        setLiked(nextLiked);
        setLikeCount(nextLikeCount);
        try {
          const { setCachedPostEngagement } = await import("@/utils/postsEngagement");
          setCachedPostEngagement(post.id, currentUserId, {
            likeCount: nextLikeCount,
            commentCount,
            likedByMe: nextLiked,
          });
        } catch {
          // ignore cache update failures
        }
      } else {
        await supabase
          .from("post_likes")
          .insert({ post_id: post.id, user_id: currentUserId });
        const nextLiked = true;
        const nextLikeCount = likeCount + 1;
        setLiked(nextLiked);
        setLikeCount(nextLikeCount);
        try {
          const { setCachedPostEngagement } = await import("@/utils/postsEngagement");
          setCachedPostEngagement(post.id, currentUserId, {
            likeCount: nextLikeCount,
            commentCount,
            likedByMe: nextLiked,
          });
        } catch {
          // ignore cache update failures
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
    }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: post.id,
          user_id: currentUserId,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment("");
      await loadComments();
      toast.success("Comment added");
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId);
    setEditCommentContent(currentContent);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return;

    try {
      const { error } = await supabase
        .from("post_comments")
        .update({ content: editCommentContent.trim() })
        .eq("id", commentId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      setEditingCommentId(null);
      setEditCommentContent("");
      await loadComments();
      toast.success("Comment updated");
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      await loadComments();
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const handleLikeComment = async (commentId: string, hasLiked: boolean) => {
    if (!currentUserId) return;

    try {
      if (hasLiked) {
        await supabase
          .from("post_comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", currentUserId);
      } else {
        await supabase.from("post_comment_likes").insert({
          comment_id: commentId,
          user_id: currentUserId,
        });
      }
      
      // Update local state optimistically
      const currentLikes = commentLikes.get(commentId) || { count: 0, userHasLiked: false };
      const newCount = hasLiked ? Math.max(0, currentLikes.count - 1) : currentLikes.count + 1;
      setCommentLikes(new Map(commentLikes).set(commentId, {
        count: newCount,
        userHasLiked: !hasLiked,
      }));
      
      // Refresh to get accurate count
      await loadComments();
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
      // Rollback on error
      await loadComments();
    }
  };

  const toggleReplies = async (commentId: string) => {
    const newExpanded = new Set(expandedReplies);
    
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
      // Fetch replies if not already loaded
      if (!commentReplies.has(commentId)) {
        await loadRepliesForComment(commentId);
      }
    }
    setExpandedReplies(newExpanded);
  };

  const loadRepliesForComment = async (commentId: string) => {
    try {
      const { data: repliesData } = await supabase
        .from("post_comment_replies")
        .select("id, content, user_id, created_at")
        .eq("comment_id", commentId)
        .order("created_at", { ascending: true });

      if (repliesData) {
        // Fetch profiles for replies
        const userIds = [...new Set(repliesData.map(r => r.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        setCommentReplies(prev => new Map(prev).set(commentId, repliesData.map(r => ({
          ...r,
          profiles: profilesMap.get(r.user_id) || null
        }))));
      }
    } catch (error) {
      console.error("Error loading replies:", error);
    }
  };

  const handleSubmitReply = async (commentId: string) => {
    const text = replyText.get(commentId)?.trim();
    if (!text || !currentUserId) return;

    try {
      const { error } = await supabase.from("post_comment_replies").insert({
        comment_id: commentId,
        user_id: currentUserId,
        content: text,
      });

      if (error) throw error;

      setReplyText(prev => new Map(prev).set(commentId, ""));
      
      // Refresh replies
      await loadRepliesForComment(commentId);
      
      // Update reply count
      const { count: repliesCount } = await supabase
        .from("post_comment_replies")
        .select("*", { count: "exact", head: true })
        .eq("comment_id", commentId);
      
      setCommentReplyCounts(prev => new Map(prev).set(commentId, repliesCount || 0));
    } catch (error: any) {
      console.error("Error posting reply:", error);
      toast.error("Failed to post reply");
    }
  };

  const displayName = post.profile?.display_name || post.profile?.username || "User";
  const initials = displayName.charAt(0).toUpperCase();
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  // Check if this post contains a drill result, round result, umbriago result, match play result, best ball result, or game result
  const parsed = useMemo(() => {
    const content = String(post.content || "");
    const drillResult = parseDrillResult(content);
    const roundScorecardResult = parseRoundScorecardResult(content);
    const matchPlayScorecardResult = parseMatchPlayScorecardResult(content);
    const bestBallScorecardResult = parseBestBallScorecardResult(content);
    const bestBallStrokePlayScorecardResult = parseBestBallStrokePlayScorecardResult(content);
    const roundResult = !roundScorecardResult ? parseRoundResult(content) : null;
    const umbriagioScorecardResult = parseUmbriagioScorecardResult(content);
    const umbriagioResult = !umbriagioScorecardResult ? parseUmbriagioResult(content) : null;
    const copenhagenScorecardResult = parseCopenhagenScorecardResult(content);
    const scrambleScorecardResult = parseScrambleScorecardResult(content);
    const skinsScorecardResult = parseSkinsScorecardResult(content);
    const wolfScorecardResult = parseWolfScorecardResult(content);
    const gameResult =
      !matchPlayScorecardResult &&
      !bestBallScorecardResult &&
      !bestBallStrokePlayScorecardResult &&
      !copenhagenScorecardResult &&
      !scrambleScorecardResult &&
      !skinsScorecardResult &&
      !wolfScorecardResult
        ? parseGameResult(content)
        : null;
    const safeFallbackText = stripEmbeddedPostBlocks(content);
    return {
      drillResult,
      roundScorecardResult,
      matchPlayScorecardResult,
      bestBallScorecardResult,
      bestBallStrokePlayScorecardResult,
      roundResult,
      umbriagioScorecardResult,
      umbriagioResult,
      copenhagenScorecardResult,
      scrambleScorecardResult,
      skinsScorecardResult,
      wolfScorecardResult,
      gameResult,
      safeFallbackText,
    };
  }, [post.content]);

  const {
    drillResult,
    roundScorecardResult,
    matchPlayScorecardResult,
    bestBallScorecardResult,
    bestBallStrokePlayScorecardResult,
    roundResult,
    umbriagioScorecardResult,
    umbriagioResult,
    copenhagenScorecardResult,
    scrambleScorecardResult,
    skinsScorecardResult,
    wolfScorecardResult,
    gameResult,
    safeFallbackText,
  } = parsed;

  return (
    <>
    <Card className="rounded-none border-x-0">
      <CardContent className="p-4 space-y-4">
        {/* Post Header */}
        <div className="flex items-center gap-3">
          <ProfilePhoto
            src={post.profile?.avatar_url}
            alt={displayName}
            fallback={displayName}
            size="md"
            onClick={() => handleProfileClick(post.user_id)}
          />
          <div className="flex-1">
            <p 
              className="font-semibold text-foreground cursor-pointer hover:underline"
              onClick={() => handleProfileClick(post.user_id)}
            >
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
          {isOwnPost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                >
                  <MoreHorizontal size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEditPost}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Post Content */}
        {isEditingPost ? (
          <div className="space-y-3">
            <Textarea
              value={editPostContent}
              onChange={(e) => setEditPostContent(e.target.value)}
              placeholder="What's on your golf mind?"
              className="min-h-[80px] resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEditPost}
                disabled={isSavingPost}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSavePost}
                disabled={isSavingPost}
              >
                {isSavingPost ? "Saving..." : "Save"}
              </Button>
            </div>
            {/* Show the result card in read-only mode during edit */}
            {drillResult && (
              <DrillResultCard 
                drillTitle={drillResult.drillTitle}
                score={drillResult.score}
                unit={drillResult.unit}
                isPersonalBest={drillResult.isPersonalBest}
                date={post.created_at}
                clickable={false}
              />
            )}
            {roundScorecardResult && (
              <RoundCard 
                round={{
                  id: roundScorecardResult.roundId || '',
                  round_name: roundScorecardResult.roundName,
                  course_name: roundScorecardResult.courseName,
                  date: roundScorecardResult.datePlayed,
                  score: roundScorecardResult.scoreVsPar,
                  playerCount: 1,
                  gameMode: 'Stroke Play',
                  gameType: 'round',
                  holesPlayed: roundScorecardResult.holesPlayed,
                }}
                onClick={() => {
                  if (roundScorecardResult.roundId) {
                    navigate(buildGameUrl('round', roundScorecardResult.roundId, 'leaderboard', { 
                      entryPoint: 'home', 
                      viewType: 'spectator' 
                    }));
                  }
                }}
              />
            )}
            {matchPlayScorecardResult && (
              <MatchPlayScorecardCard
                gameId={matchPlayScorecardResult.gameId || undefined}
                roundName={matchPlayScorecardResult.roundName}
                courseName={matchPlayScorecardResult.courseName}
                datePlayed={matchPlayScorecardResult.datePlayed}
                player1Name={matchPlayScorecardResult.player1Name}
                player2Name={matchPlayScorecardResult.player2Name}
                finalResult={matchPlayScorecardResult.finalResult}
                winnerPlayer={matchPlayScorecardResult.winnerPlayer}
                matchStatus={matchPlayScorecardResult.matchStatus}
                holeScores={matchPlayScorecardResult.holeScores}
                holePars={matchPlayScorecardResult.holePars}
              />
            )}
            {roundResult && (
              <RoundCard 
                round={{
                  id: roundResult.roundId || '',
                  round_name: roundResult.roundName,
                  course_name: roundResult.courseName,
                  date: new Date().toISOString(),
                  score: roundResult.scoreVsPar,
                  playerCount: 1,
                  gameMode: 'Stroke Play',
                  gameType: 'round',
                  holesPlayed: roundResult.holesPlayed,
                }}
              />
            )}
            {gameResult && gameResult.gameId && (
              <GameResultCardFromDB 
                gameType={gameResult.gameType}
                gameId={gameResult.gameId}
                resultUserId={post.user_id}
                fallbackCourseName={gameResult.courseName}
                fallbackRoundName={gameResult.roundName}
              />
            )}
            {bestBallStrokePlayScorecardResult && (
              <BestBallStrokePlayScorecardInPost
                bestBallStrokePlayScorecardResult={bestBallStrokePlayScorecardResult}
                textContent={bestBallStrokePlayScorecardResult.textContent}
              />
            )}
          </div>
        ) : drillResult ? (
          <div className="space-y-3">
            {drillResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{drillResult.textContent}</p>
            )}
            <DrillResultCard 
              drillTitle={drillResult.drillTitle}
              score={drillResult.score}
              unit={drillResult.unit}
              isPersonalBest={drillResult.isPersonalBest}
              date={post.created_at}
              clickable={false}
            />
          </div>
        ) : roundScorecardResult ? (
          post.scorecard_snapshot && typeof post.scorecard_snapshot === 'object' && !Array.isArray(post.scorecard_snapshot) ? (
            <RoundScorecardInPostFromSnapshot
              roundScorecardResult={roundScorecardResult}
              textContent={roundScorecardResult.textContent}
              postScorecardSnapshot={post.scorecard_snapshot}
            />
          ) : (
            // Show round card only if no snapshot exists
            <RoundCard
              round={{
                id: roundScorecardResult.roundId || '',
                course_name: roundScorecardResult.courseName,
                date: roundScorecardResult.datePlayed,
                holesPlayed: roundScorecardResult.holesPlayed,
                round_name: roundScorecardResult.roundName,
                score: 0,
                playerCount: 1,
                gameMode: 'Stroke Play',
              }}
              onClick={() => {
                if (roundScorecardResult.roundId) {
                  navigate(`/rounds/${roundScorecardResult.roundId}/leaderboard`);
                }
              }}
            />
          )
        ) : matchPlayScorecardResult ? (
          <MatchPlayScorecardInPost
            matchPlayScorecardResult={matchPlayScorecardResult}
            textContent={matchPlayScorecardResult.textContent}
          />
        ) : bestBallScorecardResult ? (
          <BestBallScorecardInPost
            bestBallScorecardResult={bestBallScorecardResult}
            textContent={bestBallScorecardResult.textContent}
            />
        ) : bestBallStrokePlayScorecardResult ? (
          <BestBallStrokePlayScorecardInPost
            bestBallStrokePlayScorecardResult={bestBallStrokePlayScorecardResult}
            textContent={bestBallStrokePlayScorecardResult.textContent}
          />
        ) : roundResult ? (
          <div className="space-y-3">
            {roundResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{roundResult.textContent}</p>
            )}
            <RoundCard 
              round={{
                id: roundResult.roundId || '',
                round_name: roundResult.roundName,
                course_name: roundResult.courseName,
                date: new Date().toISOString(),
                score: roundResult.scoreVsPar,
                totalScore: roundResult.score,
                playerCount: 1,
                gameMode: 'Stroke Play',
                gameType: 'round',
                holesPlayed: roundResult.holesPlayed,
              }}
              onClick={async () => {
                if (roundResult.roundId) {
                  sessionStorage.setItem(`spectator_return_${roundResult.roundId}`, location.pathname);
                  navigate(`/rounds/${roundResult.roundId}/leaderboard`);
                } else {
                  // Try to find the round by matching course, user, and score
                  try {
                    const { data: rounds, error } = await supabase
                      .from('rounds')
                      .select('id')
                      .eq('user_id', post.user_id)
                      .eq('course_name', roundResult.courseName)
                      .order('created_at', { ascending: false })
                      .limit(5);
                    
                    if (error) throw error;
                    
                    if (rounds && rounds.length > 0) {
                      // Try to find exact match with score from round_summaries
                      for (const round of rounds) {
                        const { data: summary } = await supabase
                          .from('round_summaries')
                          .select('total_score, score_vs_par')
                          .eq('round_id', round.id)
                          .maybeSingle();
                        
                        if (summary && summary.total_score === roundResult.score) {
                          sessionStorage.setItem(`spectator_return_${round.id}`, location.pathname);
                          navigate(`/rounds/${round.id}/leaderboard`);
                          return;
                        }
                      }
                      // Fallback to first round if no exact match
                      sessionStorage.setItem(`spectator_return_${rounds[0].id}`, location.pathname);
                      navigate(`/rounds/${rounds[0].id}/leaderboard`);
                      return;
                    }
                    toast.error("Round details not found");
                  } catch (err) {
                    console.error("Error finding round:", err);
                    toast.error("Error finding round details");
                  }
                }
              }}
            />
          </div>
        ) : umbriagioScorecardResult ? (
          <UmbriagioScorecardInPost
            umbriagioScorecardResult={umbriagioScorecardResult}
            textContent={umbriagioScorecardResult.textContent}
          />
        ) : copenhagenScorecardResult ? (
          <CopenhagenScorecardInPost
            copenhagenScorecardResult={copenhagenScorecardResult}
            textContent={copenhagenScorecardResult.textContent}
          />
        ) : scrambleScorecardResult ? (
          <ScrambleScorecardInPost
            scrambleScorecardResult={scrambleScorecardResult}
            textContent={scrambleScorecardResult.textContent}
          />
        ) : skinsScorecardResult ? (
          <SkinsScorecardInPost
            skinsScorecardResult={skinsScorecardResult}
            textContent={skinsScorecardResult.textContent}
          />
        ) : wolfScorecardResult ? (
          <WolfScorecardInPost
            wolfScorecardResult={wolfScorecardResult}
            textContent={wolfScorecardResult.textContent}
          />
        ) : umbriagioResult ? (
          <div className="space-y-3">
            {umbriagioResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{umbriagioResult.textContent}</p>
            )}
            {umbriagioResult.gameId ? (
              <GameResultCardFromDB 
                gameType="Umbriago"
                gameId={umbriagioResult.gameId}
                resultUserId={post.user_id}
                fallbackCourseName={umbriagioResult.courseName}
                fallbackRoundName={null}
              />
            ) : (
              <RoundCard 
                round={{
                  id: '',
                  round_name: 'Umbriago',
                  course_name: umbriagioResult.courseName,
                  date: new Date().toISOString(),
                  score: 0,
                  playerCount: 4,
                  gameMode: 'Umbriago',
                  gameType: 'umbriago',
                }}
                onClick={async () => {
                  // Try to find the game by matching course and user
                  const { data: games } = await supabase
                    .from('umbriago_games')
                    .select('id')
                    .eq('user_id', post.user_id)
                    .eq('course_name', umbriagioResult.courseName)
                    .order('created_at', { ascending: false })
                    .limit(1);
                  if (games && games.length > 0) {
                    navigate(`/umbriago/${games[0].id}/summary`);
                    return;
                  }
                  toast.error("Game details not found");
                }}
              />
            )}
          </div>
        ) : gameResult ? (
          <div className="space-y-3">
            {gameResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{gameResult.textContent}</p>
            )}
            {gameResult.gameId ? (
              <GameResultCardFromDB 
                gameType={gameResult.gameType}
                gameId={gameResult.gameId}
                resultUserId={post.user_id}
                fallbackCourseName={gameResult.courseName}
                fallbackRoundName={gameResult.roundName}
              />
            ) : (
              <RoundCard 
                round={{
                  id: '',
                  round_name: gameResult.roundName || gameResult.gameType,
                  course_name: gameResult.courseName,
                  date: new Date().toISOString(),
                  score: 0,
                  playerCount: 2,
                  gameMode: gameResult.gameType,
                  gameType: getGameTypeForCard(gameResult.gameType),
                }}
                onClick={() => toast.error("Game details not found")}
              />
            )}
          </div>
        ) : safeFallbackText && (
          <p className="text-foreground whitespace-pre-wrap">{safeFallbackText}</p>
        )}

        {/* Post Image */}
        {post.image_url && (
          <img
            src={post.image_url}
            alt="Post"
            className="w-full rounded-lg object-cover max-h-96"
          />
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-4 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={liked ? "text-red-500" : ""}
          >
            <Heart size={18} className={`mr-2 ${liked ? "fill-current" : ""}`} />
            {likeCount} {likeCount === 1 ? "Like" : "Likes"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle size={18} className="mr-2" />
            {commentCount} {commentCount === 1 ? "Comment" : "Comments"}
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="space-y-3 pt-3 border-t">
            {/* Existing Comments */}
            {comments.map((comment) => {
              const commentName = comment.profiles?.display_name || comment.profiles?.username || "User";
              const commentInitials = commentName.charAt(0).toUpperCase();
              const commentTime = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });

              const isOwnComment = comment.user_id === currentUserId;
              const isEditing = editingCommentId === comment.id;

              return (
                <div key={comment.id} className="flex gap-2">
                  <ProfilePhoto
                    src={comment.profiles?.avatar_url}
                    alt={commentName}
                    fallback={commentName}
                    size="sm"
                    onClick={() => handleProfileClick(comment.user_id)}
                  />
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editCommentContent}
                          onChange={(e) => setEditCommentContent(e.target.value)}
                          className="min-h-[60px] resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEditComment(comment.id)}
                            disabled={!editCommentContent.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditCommentContent("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-muted rounded-lg p-2 flex justify-between items-start">
                          <div className="flex-1">
                            <p 
                              className="text-sm font-semibold cursor-pointer hover:underline"
                              onClick={() => handleProfileClick(comment.user_id)}
                            >
                              {commentName}
                            </p>
                            <p className="text-sm text-foreground">{comment.content}</p>
                          </div>
                          {isOwnComment && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground"
                                >
                                  <MoreHorizontal size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditComment(comment.id, comment.content)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`gap-1 h-7 ${commentLikes.get(comment.id)?.userHasLiked ? "text-red-500" : ""}`}
                            onClick={() => handleLikeComment(comment.id, commentLikes.get(comment.id)?.userHasLiked || false)}
                          >
                            <Heart size={14} fill={commentLikes.get(comment.id)?.userHasLiked ? "currentColor" : "none"} />
                            {commentLikes.get(comment.id)?.count || 0}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 h-7"
                            onClick={() => toggleReplies(comment.id)}
                          >
                            <MessageCircle size={14} />
                            {commentReplyCounts.get(comment.id) || 0}
                          </Button>
                          <p className="text-xs text-muted-foreground">{commentTime}</p>
                        </div>

                        {/* Replies Section */}
                        {expandedReplies.has(comment.id) && (
                          <div className="mt-3 space-y-3 border-l-2 border-muted pl-4 ml-2">
                            {commentReplies.get(comment.id)?.map((reply) => {
                              const replyName = reply.profiles?.display_name || reply.profiles?.username || "User";
                              const replyTime = formatDistanceToNow(new Date(reply.created_at), { addSuffix: true });
                              return (
                                <div key={reply.id} className="flex items-start gap-2">
                                  <ProfilePhoto
                                    src={reply.profiles?.avatar_url}
                                    alt={replyName}
                                    fallback={replyName}
                                    size="sm"
                                    onClick={() => handleProfileClick(reply.user_id)}
                                  />
                                  <div className="flex-1">
                                    <div className="bg-muted/50 rounded-lg p-2">
                                      <p 
                                        className="text-xs font-semibold cursor-pointer hover:underline mb-1"
                                        onClick={() => handleProfileClick(reply.user_id)}
                                      >
                                        {replyName}
                                      </p>
                                      <p className="text-sm text-foreground">{reply.content}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 ml-2">{replyTime}</p>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Reply Input */}
                            {currentUserId && (
                              <div className="flex gap-2 mt-2">
                                <Textarea
                                  placeholder="Write a reply..."
                                  value={replyText.get(comment.id) || ""}
                                  onChange={(e) => setReplyText(prev => new Map(prev).set(comment.id, e.target.value))}
                                  className="min-h-[60px] resize-none"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSubmitReply(comment.id);
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSubmitReply(comment.id)}
                                  disabled={!replyText.get(comment.id)?.trim()}
                                >
                                  <Send size={14} />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* New Comment Input */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[40px] h-10 py-2 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleComment();
                  }
                }}
              />
              <Button
                size="icon"
                onClick={handleComment}
                disabled={isSubmitting || !newComment.trim()}
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Post?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this post? This action cannot be undone and the post will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};
