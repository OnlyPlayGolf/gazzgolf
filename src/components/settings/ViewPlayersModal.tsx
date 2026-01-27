import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { GamePlayer } from "./GameDetailsSection";
import { getTeeDisplayName } from "@/components/TeeSelector";
import { UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendFriendRequest, useFriendshipStatusMap } from "@/hooks/useSendFriendRequest";
import { supabase } from "@/integrations/supabase/client";

interface ViewPlayersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: GamePlayer[];
  useHandicaps?: boolean;
  /** Current user id for add-friend; if not passed, resolved from auth when modal opens. */
  currentUserId?: string | null;
}

function formatHandicap(handicap: number | null | undefined): string {
  if (handicap === null || handicap === undefined) return "-";
  if (handicap < 0) return `+${Math.abs(handicap)}`;
  return handicap.toString();
}

export function ViewPlayersModal({
  open,
  onOpenChange,
  players,
  currentUserId: currentUserIdProp,
}: ViewPlayersModalProps) {
  const { toast } = useToast();
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState<
    string | null
  >(null);
  const [friendRequestTarget, setFriendRequestTarget] =
    useState<GamePlayer | null>(null);
  const [playersDialogOpen, setPlayersDialogOpen] = useState(open);

  useEffect(() => {
    setPlayersDialogOpen(open);
  }, [open]);

  useEffect(() => {
    if (open) {
      if (currentUserIdProp !== undefined) {
        setResolvedCurrentUserId(currentUserIdProp ?? null);
      } else {
        supabase.auth.getUser().then(({ data: { user } }) =>
          setResolvedCurrentUserId(user?.id ?? null)
        );
      }
    } else {
      setResolvedCurrentUserId(null);
      setFriendRequestTarget(null);
    }
  }, [open, currentUserIdProp]);

  const playerIdsForFriendStatus =
    open && resolvedCurrentUserId
      ? players
          .filter(
            (p) => p.userId && p.userId !== resolvedCurrentUserId
          )
          .map((p) => p.userId!)
      : [];
  const { statusMap: friendshipStatusMap, refetch: refetchFriendshipStatus } =
    useFriendshipStatusMap(playerIdsForFriendStatus, resolvedCurrentUserId);

  return (
    <>
      <Dialog open={playersDialogOpen} onOpenChange={(isOpen) => {
        setPlayersDialogOpen(isOpen);
        if (!isOpen) {
          onOpenChange(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Players</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {[...players]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((player, idx) => (
                <div
                  key={player.userId ?? idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <ProfilePhoto
                    src={player.avatarUrl}
                    alt={player.name}
                    fallback={player.name}
                    size="md"
                    className="shrink-0"
                  />
                  {/* Name + team: flex-1 so it fills space, truncates if needed */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{player.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                      {player.team && <span>{player.team}</span>}
                      {player.tee && (
                        <span>• {getTeeDisplayName(player.tee)} tees</span>
                      )}
                    </div>
                  </div>
                  {/* Add friend icon: own column to the right of the name, always visible when eligible */}
                  {player.userId &&
                    player.userId !== resolvedCurrentUserId &&
                    friendshipStatusMap[player.userId] === undefined && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFriendRequestTarget(player);
                          setPlayersDialogOpen(false);
                        }}
                        title="Add friend"
                        aria-label={`Add ${player.name} as friend`}
                      >
                        <UserPlus size={18} />
                      </Button>
                    )}
                </div>
              ))}
            {players.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No players
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!friendRequestTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setFriendRequestTarget(null);
            setPlayersDialogOpen(true);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send friend request</AlertDialogTitle>
            <AlertDialogDescription>
              Send a friend request to{" "}
              <span className="font-medium text-foreground">
                {friendRequestTarget?.name ?? "this player"}
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setFriendRequestTarget(null);
                setPlayersDialogOpen(true);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (
                  !resolvedCurrentUserId ||
                  !friendRequestTarget?.userId
                )
                  return;
                const ok = await sendFriendRequest(
                  resolvedCurrentUserId,
                  friendRequestTarget.userId,
                  toast
                );
                if (ok) refetchFriendshipStatus();
                setFriendRequestTarget(null);
                setPlayersDialogOpen(true);
              }}
            >
              Send request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
