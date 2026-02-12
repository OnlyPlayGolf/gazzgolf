import React, { Suspense, useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { BottomTabBar } from "@/components/BottomTabBar";
import { migrateStorageKeys } from "@/utils/storageManager";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { syncOwnProfileFromAuthUser } from "@/utils/syncOwnProfileFromAuth";

// Eager-loaded (always needed)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const DrillsCategories = React.lazy(() => import("./pages/DrillsCategories"));
const CategoryDrills = React.lazy(() => import("./pages/CategoryDrills"));
const Drills = React.lazy(() => import("./pages/Drills"));
const DrillDetail = React.lazy(() => import("./pages/DrillDetail"));
const LevelSelection = React.lazy(() => import("./pages/LevelSelection"));
const Levels = React.lazy(() => import("./pages/Levels"));
const Groups = React.lazy(() => import("./pages/Profile"));
const UserProfile = React.lazy(() => import("./pages/UserProfile"));
const PublicProfile = React.lazy(() => import("./pages/PublicProfile"));
const FriendRounds = React.lazy(() => import("./pages/FriendRounds"));
const ProfileSettings = React.lazy(() => import("./pages/ProfileSettings"));
const Messages = React.lazy(() => import("./pages/Messages"));
const AddFriendFromQR = React.lazy(() => import("./pages/AddFriendFromQR"));
const Leaderboards = React.lazy(() => import("./pages/Leaderboards"));
const Menu = React.lazy(() => import("./pages/Menu"));
const Friends = React.lazy(() => import("./pages/Friends"));
const AccountMembership = React.lazy(() => import("./pages/AccountMembership"));
const Settings = React.lazy(() => import("./pages/Settings"));
const SettingsMetrics = React.lazy(() => import("./pages/SettingsMetrics"));
const SettingsLanguage = React.lazy(() => import("./pages/SettingsLanguage"));
const SettingsNotifications = React.lazy(() => import("./pages/SettingsNotifications"));
const SettingsPrivacy = React.lazy(() => import("./pages/SettingsPrivacy"));
const SettingsAppPreferences = React.lazy(() => import("./pages/SettingsAppPreferences"));
const About = React.lazy(() => import("./pages/About"));
const Feedback = React.lazy(() => import("./pages/Feedback"));
const Support = React.lazy(() => import("./pages/Support"));
const UserDrills = React.lazy(() => import("./pages/UserDrills"));
const CreateDrill = React.lazy(() => import("./pages/CreateDrill"));
const RunDrill = React.lazy(() => import("./pages/RunDrill"));
const DrillResults = React.lazy(() => import("./pages/DrillResults"));
const DrillResultDetail = React.lazy(() => import("./pages/DrillResultDetail"));
const GroupDetail = React.lazy(() => import("./pages/GroupDetail"));
const AcceptInvite = React.lazy(() => import("./pages/AcceptInvite"));
const Rounds = React.lazy(() => import("./pages/Rounds"));
const RoundsPlay = React.lazy(() => import("./pages/RoundsPlay"));
const PlayedRounds = React.lazy(() => import("./pages/PlayedRounds"));
const RoundSetup = React.lazy(() => import("./pages/RoundSetup"));
const HoleTracker = React.lazy(() => import("./pages/HoleTracker"));
const RoundTracker = React.lazy(() => import("./pages/RoundTracker"));
const RoundDetail = React.lazy(() => import("./pages/RoundDetail"));
const RoundSummary = React.lazy(() => import("./pages/RoundSummary"));
const ProRoundSetup = React.lazy(() => import("./pages/ProRoundSetup"));
const ProHoleTracker = React.lazy(() => import("./pages/ProHoleTracker"));
const ProRoundSummary = React.lazy(() => import("./pages/ProRoundSummary"));
const BasicStatsTracker = React.lazy(() => import("./pages/BasicStatsTracker"));
const ManagePlayers = React.lazy(() => import("./pages/ManagePlayers"));
const RoundLeaderboard = React.lazy(() => import("./pages/RoundLeaderboard"));
const RoundInfo = React.lazy(() => import("./pages/RoundInfo"));
const RoundFeed = React.lazy(() => import("./pages/RoundFeed"));
const RoundSettings = React.lazy(() => import("./pages/RoundSettings"));
const Practice = React.lazy(() => import("./pages/Practice"));
const AggressivePuttingDrill = React.lazy(() => import("./pages/AggressivePuttingDrill"));
const PGATour18Drill = React.lazy(() => import("./pages/PGATour18Drill"));
const UpDownPuttingDrill = React.lazy(() => import("./pages/UpDownPuttingDrill"));
const ShortPuttingDrill = React.lazy(() => import("./pages/ShortPuttingDrill"));
const JasonDayLagDrill = React.lazy(() => import("./pages/JasonDayLagDrill"));
const EightBallDrill = React.lazy(() => import("./pages/EightBallDrill"));
const ShotShapeMasterDrill = React.lazy(() => import("./pages/ShotShapeMasterDrill"));
const ApproachControlDrill = React.lazy(() => import("./pages/ApproachControlDrill"));
const WedgesProgressionDrill = React.lazy(() => import("./pages/WedgesProgressionDrill"));
const Wedges2LapsDrill = React.lazy(() => import("./pages/Wedges2LapsDrill"));
const TW9WindowsDrill = React.lazy(() => import("./pages/TW9WindowsDrill"));
const DriverControlDrill = React.lazy(() => import("./pages/DriverControlDrill"));
const DriverControlInfo = React.lazy(() => import("./pages/DriverControlInfo"));
const DriverControlScore = React.lazy(() => import("./pages/DriverControlScore"));
const DriverControlFeed = React.lazy(() => import("./pages/DriverControlFeed"));
const DriverControlLeaderboard = React.lazy(() => import("./pages/DriverControlLeaderboard"));
const DriverControlMessages = React.lazy(() => import("./pages/DriverControlMessages"));
const UpDownsTestDrill = React.lazy(() => import("./pages/UpDownsTestDrill"));
const EasyChipDrill = React.lazy(() => import("./pages/EasyChipDrill"));
const TwentyOnePointsSetup = React.lazy(() => import("./pages/TwentyOnePointsSetup"));
const TwentyOnePointsDrill = React.lazy(() => import("./pages/TwentyOnePointsDrill"));
const UmbriagioSetup = React.lazy(() => import("./pages/UmbriagioSetup"));
const UmbriagioPlay = React.lazy(() => import("./pages/UmbriagioPlay"));
const UmbriagioSummary = React.lazy(() => import("./pages/UmbriagioSummary"));
const UmbriagioInfo = React.lazy(() => import("./pages/UmbriagioInfo"));
const UmbriagioFeed = React.lazy(() => import("./pages/UmbriagioFeed"));
const UmbriagioLeaderboard = React.lazy(() => import("./pages/UmbriagioLeaderboard"));
const UmbriagioSettings = React.lazy(() => import("./pages/UmbriagioSettings"));
const HowToPlayUmbriago = React.lazy(() => import("./pages/HowToPlayUmbriago"));
const WolfSetup = React.lazy(() => import("./pages/WolfSetup"));
const WolfPlay = React.lazy(() => import("./pages/WolfPlay"));
const WolfInfo = React.lazy(() => import("./pages/WolfInfo"));
const WolfFeed = React.lazy(() => import("./pages/WolfFeed"));
const WolfLeaderboard = React.lazy(() => import("./pages/WolfLeaderboard"));
const WolfSettings = React.lazy(() => import("./pages/WolfSettings"));
const HowToPlayWolf = React.lazy(() => import("./pages/HowToPlayWolf"));
const StrokePlaySettings = React.lazy(() => import("./pages/StrokePlaySettings"));
const StrokePlaySetup = React.lazy(() => import("./pages/StrokePlaySetup"));
const HowToPlayStrokePlay = React.lazy(() => import("./pages/HowToPlayStrokePlay"));
const PerformanceStats = React.lazy(() => import("./pages/PerformanceStats"));
const CopenhagenSetup = React.lazy(() => import("./pages/CopenhagenSetup"));
const CopenhagenPlay = React.lazy(() => import("./pages/CopenhagenPlay"));
const CopenhagenInfo = React.lazy(() => import("./pages/CopenhagenInfo"));
const CopenhagenFeed = React.lazy(() => import("./pages/CopenhagenFeed"));
const CopenhagenLeaderboard = React.lazy(() => import("./pages/CopenhagenLeaderboard"));
const CopenhagenSettings = React.lazy(() => import("./pages/CopenhagenSettings"));
const HowToPlayCopenhagen = React.lazy(() => import("./pages/HowToPlayCopenhagen"));
const MatchPlaySetup = React.lazy(() => import("./pages/MatchPlaySetup"));
const MatchPlayPlay = React.lazy(() => import("./pages/MatchPlayPlay"));
const MatchPlayInfo = React.lazy(() => import("./pages/MatchPlayInfo"));
const MatchPlayFeed = React.lazy(() => import("./pages/MatchPlayFeed"));
const MatchPlayLeaderboard = React.lazy(() => import("./pages/MatchPlayLeaderboard"));
const MatchPlaySettings = React.lazy(() => import("./pages/MatchPlaySettings"));
const MatchPlaySummary = React.lazy(() => import("./pages/MatchPlaySummary"));
const HowToPlayMatchPlay = React.lazy(() => import("./pages/HowToPlayMatchPlay"));
const SpectateRound = React.lazy(() => import("./pages/SpectateRound"));
const SpectateMatchPlay = React.lazy(() => import("./pages/SpectateMatchPlay"));
const BestBallSetup = React.lazy(() => import("./pages/BestBallSetup"));
const BestBallPlay = React.lazy(() => import("./pages/BestBallPlay"));
const BestBallInfo = React.lazy(() => import("./pages/BestBallInfo"));
const BestBallFeed = React.lazy(() => import("./pages/BestBallFeed"));
const BestBallLeaderboard = React.lazy(() => import("./pages/BestBallLeaderboard"));
const BestBallSettings = React.lazy(() => import("./pages/BestBallSettings"));
const BestBallSummary = React.lazy(() => import("./pages/BestBallSummary"));
const HowToPlayBestBall = React.lazy(() => import("./pages/HowToPlayBestBall"));
const ScrambleSetup = React.lazy(() => import("./pages/ScrambleSetup"));
const ScramblePlay = React.lazy(() => import("./pages/ScramblePlay"));
const ScrambleInfo = React.lazy(() => import("./pages/ScrambleInfo"));
const ScrambleFeed = React.lazy(() => import("./pages/ScrambleFeed"));
const ScrambleLeaderboard = React.lazy(() => import("./pages/ScrambleLeaderboard"));
const ScrambleSettings = React.lazy(() => import("./pages/ScrambleSettings"));
const ScrambleSummary = React.lazy(() => import("./pages/ScrambleSummary"));
const HowToPlayScramble = React.lazy(() => import("./pages/HowToPlayScramble"));
const SkinsSetup = React.lazy(() => import("./pages/SkinsSetup"));
const SkinsTracker = React.lazy(() => import("./pages/SkinsTracker"));
const SkinsInfo = React.lazy(() => import("./pages/SkinsInfo"));
const SkinsFeed = React.lazy(() => import("./pages/SkinsFeed"));
const SkinsLeaderboard = React.lazy(() => import("./pages/SkinsLeaderboard"));
const SkinsSettings = React.lazy(() => import("./pages/SkinsSettings"));
const HowToPlaySkins = React.lazy(() => import("./pages/HowToPlaySkins"));
const Statistics = React.lazy(() => import("./pages/Statistics"));
const StatDetail = React.lazy(() => import("./pages/StatDetail"));
const PuttingStats = React.lazy(() => import("./pages/PuttingStats"));
const ApproachStats = React.lazy(() => import("./pages/ApproachStats"));
const DrivingStats = React.lazy(() => import("./pages/DrivingStats"));
const ShortGameStats = React.lazy(() => import("./pages/ShortGameStats"));
const OtherStats = React.lazy(() => import("./pages/OtherStats"));
const ScoringStats = React.lazy(() => import("./pages/ScoringStats"));
const ScorecardScanner = React.lazy(() => import("./pages/ScorecardScanner"));

// Create QueryClient outside component to prevent recreation on every render
const queryClient = new QueryClient();

const AnimatedAppRoutes = () => {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  const y = 10;
  const transition = {
    duration: 0.2,
    ease: [0.22, 1, 0.36, 1],
  } as const;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="min-h-[100dvh]"
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -y }}
        transition={transition}
      >
        <Suspense fallback={<div className="min-h-[100dvh]" />}>
        <Routes location={location}>
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
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/statistics/putting-detail" element={<PuttingStats />} />
          <Route path="/statistics/approach-detail" element={<ApproachStats />} />
          <Route path="/statistics/driving" element={<DrivingStats />} />
          <Route path="/statistics/short-game-detail" element={<ShortGameStats />} />
          <Route path="/statistics/other" element={<OtherStats />} />
          <Route path="/statistics/scoring-sg" element={<ScoringStats />} />
          <Route path="/statistics/:category" element={<StatDetail />} />
          <Route path="/scorecard-scanner" element={<ScorecardScanner />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/account-membership" element={<AccountMembership />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/metrics" element={<SettingsMetrics />} />
          <Route path="/settings/language" element={<SettingsLanguage />} />
          <Route path="/settings/notifications" element={<SettingsNotifications />} />
          <Route path="/settings/privacy" element={<SettingsPrivacy />} />
          <Route path="/settings/preferences" element={<SettingsAppPreferences />} />
          <Route path="/about" element={<About />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/support" element={<Support />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/user-drills" element={<UserDrills />} />
          <Route path="/create-drill" element={<CreateDrill />} />
          <Route path="/run-drill/:drillId" element={<RunDrill />} />
          <Route path="/drill-results/:drillId" element={<DrillResults />} />
          <Route path="/drill-result/:resultId" element={<DrillResultDetail />} />
          <Route path="/group/:groupId" element={<GroupDetail />} />
          <Route path="/invite/:code" element={<AcceptInvite />} />
          <Route path="/rounds" element={<Rounds />} />
          <Route path="/rounds-play" element={<RoundsPlay />} />
          <Route path="/stroke-play/how-to-play" element={<HowToPlayStrokePlay />} />
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
          <Route path="/rounds/:roundId/detail" element={<RoundDetail />} />
          <Route path="/rounds/:roundId" element={<RoundSummary />} />
          <Route path="/rounds/pro-setup" element={<ProRoundSetup />} />
          <Route path="/rounds/:roundId/pro-track" element={<ProHoleTracker />} />
          <Route path="/rounds/:roundId/basic-track" element={<BasicStatsTracker />} />
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
          <Route path="/copenhagen/how-to-play" element={<HowToPlayCopenhagen />} />
          <Route path="/copenhagen/setup" element={<CopenhagenSetup />} />
          <Route path="/copenhagen/:gameId/play" element={<CopenhagenPlay />} />
          <Route path="/copenhagen/:gameId/info" element={<CopenhagenInfo />} />
          <Route path="/copenhagen/:gameId/feed" element={<CopenhagenFeed />} />
          <Route path="/copenhagen/:gameId/leaderboard" element={<CopenhagenLeaderboard />} />
          <Route path="/copenhagen/:gameId/settings" element={<CopenhagenSettings />} />
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
          <Route path="/best-ball/how-to-play" element={<HowToPlayBestBall />} />
          <Route path="/best-ball/setup" element={<BestBallSetup />} />
          <Route path="/best-ball/:gameId/play" element={<BestBallPlay />} />
          <Route path="/best-ball/:gameId/info" element={<BestBallInfo />} />
          <Route path="/best-ball/:gameId/feed" element={<BestBallFeed />} />
          <Route path="/best-ball/:gameId/leaderboard" element={<BestBallLeaderboard />} />
          <Route path="/best-ball/:gameId/settings" element={<BestBallSettings />} />
          <Route path="/best-ball/:gameId/summary" element={<BestBallSummary />} />
          <Route path="/scramble/how-to-play" element={<HowToPlayScramble />} />
          <Route path="/scramble/setup" element={<ScrambleSetup />} />
          <Route path="/scramble/:gameId/play" element={<ScramblePlay />} />
          <Route path="/scramble/:gameId/info" element={<ScrambleInfo />} />
          <Route path="/scramble/:gameId/feed" element={<ScrambleFeed />} />
          <Route path="/scramble/:gameId/leaderboard" element={<ScrambleLeaderboard />} />
          <Route path="/scramble/:gameId/settings" element={<ScrambleSettings />} />
          <Route path="/scramble/:gameId/summary" element={<ScrambleSummary />} />
          <Route path="/skins/how-to-play" element={<HowToPlaySkins />} />
          <Route path="/skins/setup" element={<SkinsSetup />} />
          <Route path="/skins/:roundId/track" element={<SkinsTracker />} />
          <Route path="/skins/:roundId/info" element={<SkinsInfo />} />
          <Route path="/skins/:roundId/feed" element={<SkinsFeed />} />
          <Route path="/skins/:roundId/leaderboard" element={<SkinsLeaderboard />} />
          <Route path="/skins/:roundId/settings" element={<SkinsSettings />} />
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
          <Route path="/drill/21-points/setup" element={<TwentyOnePointsSetup />} />
          <Route path="/drill/21-points/*" element={<TwentyOnePointsDrill />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

const AuthAwareBottomTabBar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setIsLoggedIn(true);
          return;
        }
        if (event === "SIGNED_OUT") {
          setIsLoggedIn(false);
          return;
        }
        const { data: { session: current } } = await supabase.auth.getSession();
        setIsLoggedIn(!!current?.user);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (!isLoggedIn) return null;

  return <BottomTabBar />;
};

const AuthProfileBootstrap = () => {
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) void syncOwnProfileFromAuthUser(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) void syncOwnProfileFromAuthUser(session.user);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return null;
};

const App = () => {
  useEffect(() => {
    // Run storage migration on app startup
    migrateStorageKeys();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="relative">
          <AuthProfileBootstrap />
          <AnimatedAppRoutes />
          <AuthAwareBottomTabBar />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
