import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BottomTabBar } from "@/components/BottomTabBar";
import { migrateStorageKeys } from "@/utils/storageManager";
import Index from "./pages/Index";
import DrillsCategories from "./pages/DrillsCategories";
import CategoryDrills from "./pages/CategoryDrills";
import Drills from "./pages/Drills";
import DrillDetail from "./pages/DrillDetail";
import Auth from "./pages/Auth";
import LevelSelection from "./pages/LevelSelection";
import Levels from "./pages/Levels";
import Groups from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import PublicProfile from "./pages/PublicProfile";
import FriendRounds from "./pages/FriendRounds";
import ProfileSettings from "./pages/ProfileSettings";
import Messages from "./pages/Messages";
import AddFriendFromQR from "./pages/AddFriendFromQR";
import Leaderboards from "./pages/Leaderboards";
import Menu from "./pages/Menu";
import Friends from "./pages/Friends";
import NotFound from "./pages/NotFound";
import UserDrills from "./pages/UserDrills";
import CreateDrill from "./pages/CreateDrill";
import RunDrill from "./pages/RunDrill";
import DrillResults from "./pages/DrillResults";
import GroupDetail from "./pages/GroupDetail";
import AcceptInvite from "./pages/AcceptInvite";
import Rounds from "./pages/Rounds";
import RoundsPlay from "./pages/RoundsPlay";
import PlayedRounds from "./pages/PlayedRounds";
import RoundSetup from "./pages/RoundSetup";
import HoleTracker from "./pages/HoleTracker";
import RoundTracker from "./pages/RoundTracker";
import RoundSummary from "./pages/RoundSummary";
import ProRoundSetup from "./pages/ProRoundSetup";
import ProHoleTracker from "./pages/ProHoleTracker";
import ProRoundSummary from "./pages/ProRoundSummary";
import ManagePlayers from "./pages/ManagePlayers";
import RoundLeaderboard from "./pages/RoundLeaderboard";
import RoundInfo from "./pages/RoundInfo";
import RoundFeed from "./pages/RoundFeed";
import RoundSettings from "./pages/RoundSettings";
import Practice from "./pages/Practice";
import AggressivePuttingDrill from "./pages/AggressivePuttingDrill";
import PGATour18Drill from "./pages/PGATour18Drill";
import UpDownPuttingDrill from "./pages/UpDownPuttingDrill";
import ShortPuttingDrill from "./pages/ShortPuttingDrill";
import JasonDayLagDrill from "./pages/JasonDayLagDrill";
import EightBallDrill from "./pages/EightBallDrill";
import ShotShapeMasterDrill from "./pages/ShotShapeMasterDrill";
import ApproachControlDrill from "./pages/ApproachControlDrill";
import WedgesProgressionDrill from "./pages/WedgesProgressionDrill";
import Wedges2LapsDrill from "./pages/Wedges2LapsDrill";
import TW9WindowsDrill from "./pages/TW9WindowsDrill";
import DriverControlDrill from "./pages/DriverControlDrill";
import DriverControlInfo from "./pages/DriverControlInfo";
import DriverControlScore from "./pages/DriverControlScore";
import DriverControlFeed from "./pages/DriverControlFeed";
import DriverControlLeaderboard from "./pages/DriverControlLeaderboard";
import DriverControlMessages from "./pages/DriverControlMessages";
import UpDownsTestDrill from "./pages/UpDownsTestDrill";
import EasyChipDrill from "./pages/EasyChipDrill";
import UmbriagioSetup from "./pages/UmbriagioSetup";
import UmbriagioPlay from "./pages/UmbriagioPlay";
import UmbriagioSummary from "./pages/UmbriagioSummary";
import UmbriagioInfo from "./pages/UmbriagioInfo";
import UmbriagioFeed from "./pages/UmbriagioFeed";
import UmbriagioLeaderboard from "./pages/UmbriagioLeaderboard";
import UmbriagioSettings from "./pages/UmbriagioSettings";
import HowToPlayUmbriago from "./pages/HowToPlayUmbriago";
import WolfSetup from "./pages/WolfSetup";
import WolfPlay from "./pages/WolfPlay";
import WolfSummary from "./pages/WolfSummary";
import WolfInfo from "./pages/WolfInfo";
import WolfFeed from "./pages/WolfFeed";
import WolfLeaderboard from "./pages/WolfLeaderboard";
import WolfSettings from "./pages/WolfSettings";
import HowToPlayWolf from "./pages/HowToPlayWolf";
import StrokePlaySettings from "./pages/StrokePlaySettings";
import StrokePlaySetup from "./pages/StrokePlaySetup";
import PerformanceStats from "./pages/PerformanceStats";
import CopenhagenSetup from "./pages/CopenhagenSetup";
import CopenhagenPlay from "./pages/CopenhagenPlay";
import CopenhagenInfo from "./pages/CopenhagenInfo";
import CopenhagenFeed from "./pages/CopenhagenFeed";
import CopenhagenLeaderboard from "./pages/CopenhagenLeaderboard";
import CopenhagenSettings from "./pages/CopenhagenSettings";
import CopenhagenSummary from "./pages/CopenhagenSummary";
import HowToPlayCopenhagen from "./pages/HowToPlayCopenhagen";
import MatchPlaySetup from "./pages/MatchPlaySetup";
import MatchPlayPlay from "./pages/MatchPlayPlay";
import MatchPlayInfo from "./pages/MatchPlayInfo";
import MatchPlayFeed from "./pages/MatchPlayFeed";
import MatchPlayLeaderboard from "./pages/MatchPlayLeaderboard";
import MatchPlaySettings from "./pages/MatchPlaySettings";
import MatchPlaySummary from "./pages/MatchPlaySummary";
import HowToPlayMatchPlay from "./pages/HowToPlayMatchPlay";
import SpectateRound from "./pages/SpectateRound";
import SpectateMatchPlay from "./pages/SpectateMatchPlay";
import BestBallSetup from "./pages/BestBallSetup";
import BestBallPlay from "./pages/BestBallPlay";
import HowToPlayBestBallStroke from "./pages/HowToPlayBestBallStroke";
import HowToPlayBestBallMatch from "./pages/HowToPlayBestBallMatch";

// Create QueryClient outside component to prevent recreation on every render
const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Run storage migration on app startup
    migrateStorageKeys();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <div className="relative">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/categories" element={<DrillsCategories />} />
            <Route path="/drills" element={<DrillsCategories />} />
            <Route path="/drills/:categoryId" element={<CategoryDrills />} />
            <Route path="/drills/:drillId/detail" element={<DrillDetail />} />
            <Route path="/levels" element={<LevelSelection />} />
            <Route path="/levels/:difficulty" element={<Levels />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/user/:userId" element={<PublicProfile />} />
            <Route path="/user/:userId/rounds" element={<FriendRounds />} />
            <Route path="/add-friend/:userId" element={<AddFriendFromQR />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/profile-settings" element={<ProfileSettings />} />
            <Route path="/performance-stats" element={<PerformanceStats />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/leaderboards" element={<Leaderboards />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/user-drills" element={<UserDrills />} />
            <Route path="/create-drill" element={<CreateDrill />} />
            <Route path="/run-drill/:drillId" element={<RunDrill />} />
            <Route path="/drill-results/:drillId" element={<DrillResults />} />
            <Route path="/group/:groupId" element={<GroupDetail />} />
            <Route path="/invite/:code" element={<AcceptInvite />} />
            <Route path="/rounds" element={<Rounds />} />
            <Route path="/rounds-play" element={<RoundsPlay />} />
            <Route path="/stroke-play/settings" element={<StrokePlaySettings />} />
            <Route path="/stroke-play/setup" element={<StrokePlaySetup />} />
            <Route path="/played-rounds" element={<PlayedRounds />} />
            <Route path="/rounds/manage-players" element={<ManagePlayers />} />
            <Route path="/rounds/setup" element={<RoundSetup />} />
            <Route path="/rounds/:roundId/track" element={<RoundTracker />} />
            <Route path="/rounds/:roundId/info" element={<RoundInfo />} />
            <Route path="/rounds/:roundId/feed" element={<RoundFeed />} />
            <Route path="/rounds/:roundId/leaderboard" element={<RoundLeaderboard />} />
            <Route path="/rounds/:roundId/settings" element={<RoundSettings />} />
            <Route path="/rounds/:roundId/stats" element={<HoleTracker />} />
            <Route path="/rounds/:roundId/summary" element={<RoundSummary />} />
            <Route path="/rounds/:roundId" element={<RoundSummary />} />
            <Route path="/rounds/pro-setup" element={<ProRoundSetup />} />
            <Route path="/rounds/:roundId/pro-track" element={<ProHoleTracker />} />
            <Route path="/rounds/:roundId/pro-summary" element={<ProRoundSummary />} />
            <Route path="/umbriago/how-to-play" element={<HowToPlayUmbriago />} />
            <Route path="/umbriago/setup" element={<UmbriagioSetup />} />
            <Route path="/umbriago/:gameId/play" element={<UmbriagioPlay />} />
            <Route path="/umbriago/:gameId/info" element={<UmbriagioInfo />} />
            <Route path="/umbriago/:gameId/feed" element={<UmbriagioFeed />} />
            <Route path="/umbriago/:gameId/leaderboard" element={<UmbriagioLeaderboard />} />
            <Route path="/umbriago/:gameId/settings" element={<UmbriagioSettings />} />
            <Route path="/umbriago/:gameId/summary" element={<UmbriagioSummary />} />
            <Route path="/wolf/how-to-play" element={<HowToPlayWolf />} />
            <Route path="/wolf/setup" element={<WolfSetup />} />
            <Route path="/wolf/:gameId/play" element={<WolfPlay />} />
            <Route path="/wolf/:gameId/info" element={<WolfInfo />} />
            <Route path="/wolf/:gameId/feed" element={<WolfFeed />} />
            <Route path="/wolf/:gameId/leaderboard" element={<WolfLeaderboard />} />
            <Route path="/wolf/:gameId/settings" element={<WolfSettings />} />
            <Route path="/wolf/:gameId/summary" element={<WolfSummary />} />
            <Route path="/copenhagen/how-to-play" element={<HowToPlayCopenhagen />} />
            <Route path="/copenhagen/setup" element={<CopenhagenSetup />} />
            <Route path="/copenhagen/:gameId/play" element={<CopenhagenPlay />} />
            <Route path="/copenhagen/:gameId/info" element={<CopenhagenInfo />} />
            <Route path="/copenhagen/:gameId/feed" element={<CopenhagenFeed />} />
            <Route path="/copenhagen/:gameId/leaderboard" element={<CopenhagenLeaderboard />} />
            <Route path="/copenhagen/:gameId/settings" element={<CopenhagenSettings />} />
            <Route path="/copenhagen/:gameId/summary" element={<CopenhagenSummary />} />
            <Route path="/match-play/how-to-play" element={<HowToPlayMatchPlay />} />
            <Route path="/match-play/setup" element={<MatchPlaySetup />} />
            <Route path="/match-play/:gameId/play" element={<MatchPlayPlay />} />
            <Route path="/match-play/:gameId/info" element={<MatchPlayInfo />} />
            <Route path="/match-play/:gameId/feed" element={<MatchPlayFeed />} />
            <Route path="/match-play/:gameId/leaderboard" element={<MatchPlayLeaderboard />} />
            <Route path="/match-play/:gameId/settings" element={<MatchPlaySettings />} />
            <Route path="/match-play/:gameId/summary" element={<MatchPlaySummary />} />
            <Route path="/spectate/round/:roundId" element={<SpectateRound />} />
            <Route path="/spectate/match-play/:gameId" element={<SpectateMatchPlay />} />
            <Route path="/best-ball/stroke/how-to-play" element={<HowToPlayBestBallStroke />} />
            <Route path="/best-ball/match/how-to-play" element={<HowToPlayBestBallMatch />} />
            <Route path="/best-ball/setup" element={<BestBallSetup />} />
            <Route path="/best-ball/:gameId/play" element={<BestBallPlay />} />
            <Route path="/drill/aggressive-putting/*" element={<AggressivePuttingDrill />} />
            <Route path="/drill/pga-tour-18/*" element={<PGATour18Drill />} />
            <Route path="/drill/up-down-putting/*" element={<UpDownPuttingDrill />} />
            <Route path="/drill/short-putting-test/*" element={<ShortPuttingDrill />} />
            <Route path="/drill/jason-day-lag/*" element={<JasonDayLagDrill />} />
            <Route path="/drill/8-ball-drill/*" element={<EightBallDrill />} />
            <Route path="/drill/shot-shape-master/*" element={<ShotShapeMasterDrill />} />
            <Route path="/drill/approach-control/*" element={<ApproachControlDrill />} />
            <Route path="/drill/wedges-progression/*" element={<WedgesProgressionDrill />} />
            <Route path="/drill/wedges-2-laps/*" element={<Wedges2LapsDrill />} />
            <Route path="/drill/tw-9-windows/*" element={<TW9WindowsDrill />} />
            <Route path="/drill/driver-control/*" element={<DriverControlDrill />} />
            <Route path="/drill/up-downs-test/*" element={<UpDownsTestDrill />} />
            <Route path="/drill/easy-chip/*" element={<EasyChipDrill />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomTabBar />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
