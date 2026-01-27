import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FriendshipStatus = "friend" | "pending_sent" | "pending_received";

export type ToastFn = (opts: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

/**
 * Sends a friend request from currentUserId to targetUserId.
 * Returns true if the request was sent; false if already friends or pending (toast shown by this function).
 */
export async function sendFriendRequest(
  currentUserId: string,
  targetUserId: string,
  toast: ToastFn
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status, requester, addressee")
      .or(
        `and(requester.eq.${currentUserId},addressee.eq.${targetUserId}),and(requester.eq.${targetUserId},addressee.eq.${currentUserId})`
      )
      .maybeSingle();

    if (existing) {
      if (existing.status === "accepted") {
        toast({
          title: "Already friends",
          description: "You are already friends with this user",
          variant: "destructive",
        });
      } else if (existing.requester === currentUserId) {
        toast({
          title: "Request pending",
          description: "You already sent a friend request to this user",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Request pending",
          description:
            "This user has already sent you a friend request. Check your friend requests!",
          variant: "destructive",
        });
      }
      return false;
    }

    const { error } = await supabase.from("friendships").insert({
      requester: currentUserId,
      addressee: targetUserId,
      status: "pending",
    });

    if (error) throw error;

    toast({
      title: "Success",
      description: "Friend request sent",
    });
    return true;
  } catch (err) {
    console.error("Error sending friend request:", err);
    toast({
      title: "Error",
      description: "Failed to send friend request",
      variant: "destructive",
    });
    return false;
  }
}

/**
 * Returns a map of userId -> friendship status for the given user ids relative to currentUserId.
 * Only queries when currentUserId is set and userIds is non-empty.
 */
export function useFriendshipStatusMap(
  userIds: string[],
  currentUserId: string | null
): {
  statusMap: Record<string, FriendshipStatus>;
  refetch: () => void;
} {
  const [statusMap, setStatusMap] = useState<Record<string, FriendshipStatus>>({});
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!currentUserId || userIds.length === 0) {
      setStatusMap({});
      return;
    }

    const uniqueIds = [...new Set(userIds)];
    const idSet = new Set(uniqueIds);
    let cancelled = false;

    async function load() {
      const { data: rows } = await supabase
        .from("friendships")
        .select("requester, addressee, status")
        .or(`requester.eq.${currentUserId},addressee.eq.${currentUserId}`);

      if (cancelled) return;

      const map: Record<string, FriendshipStatus> = {};
      for (const r of rows ?? []) {
        const other =
          r.requester === currentUserId ? r.addressee : r.requester;
        if (!idSet.has(other)) continue;
        if (r.status === "accepted") {
          map[other] = "friend";
        } else if (r.requester === currentUserId) {
          map[other] = "pending_sent";
        } else {
          map[other] = "pending_received";
        }
      }
      setStatusMap(map);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, userIds.join(","), refetchTrigger]);

  return { statusMap, refetch };
}
