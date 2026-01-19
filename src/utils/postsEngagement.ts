import { supabase } from "@/integrations/supabase/client";

export type PostEngagement = {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

type PostLikeRow = { post_id: string; user_id: string };
type PostCommentRow = { post_id: string };

const CACHE_TTL_MS = 30_000;
type CacheEntry = { ts: number; engagement: PostEngagement };
const engagementCache = new Map<string, CacheEntry>();

const defaultEngagement = (): PostEngagement => ({
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
});

const cacheKey = (postId: string, currentUserId: string | null) =>
  `${currentUserId || "anon"}:${postId}`;

export function setCachedPostEngagement(
  postId: string,
  currentUserId: string | null,
  engagement: PostEngagement
) {
  if (!postId) return;
  engagementCache.set(cacheKey(postId, currentUserId), { ts: Date.now(), engagement });
}

export function invalidateCachedPostEngagement(postId: string, currentUserId?: string | null) {
  if (!postId) return;
  if (typeof currentUserId === "string" || currentUserId === null) {
    engagementCache.delete(cacheKey(postId, currentUserId ?? null));
    return;
  }
  // remove all user-specific entries for this post
  for (const key of engagementCache.keys()) {
    if (key.endsWith(`:${postId}`)) engagementCache.delete(key);
  }
}

export async function fetchPostsEngagement(
  postIds: string[],
  currentUserId: string | null
): Promise<Record<string, PostEngagement>> {
  const ids = Array.from(new Set(postIds)).filter((id) => typeof id === "string" && id.trim().length > 0);
  if (ids.length === 0) return {};

  const userId = typeof currentUserId === "string" && currentUserId.trim().length > 0 ? currentUserId : null;

  const now = Date.now();
  const result: Record<string, PostEngagement> = {};
  const missing: string[] = [];

  for (const postId of ids) {
    const cached = engagementCache.get(cacheKey(postId, userId));
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      result[postId] = cached.engagement;
    } else {
      missing.push(postId);
    }
  }

  if (missing.length === 0) return result;

  try {
    const [likesRes, commentsRes] = await Promise.all([
      supabase.from("post_likes").select("post_id, user_id").in("post_id", missing),
      supabase.from("post_comments").select("post_id").in("post_id", missing),
    ]);

    if (likesRes.error) console.error("Error fetching post_likes batch:", likesRes.error);
    if (commentsRes.error) console.error("Error fetching post_comments batch:", commentsRes.error);

    const likes = (likesRes.data || []) as unknown as PostLikeRow[];
    const comments = (commentsRes.data || []) as unknown as PostCommentRow[];

    const likeCountMap = new Map<string, number>();
    const likedByMeSet = new Set<string>();
    for (const row of likes) {
      const postId = row.post_id;
      if (!postId) continue;
      likeCountMap.set(postId, (likeCountMap.get(postId) || 0) + 1);
      if (userId && row.user_id === userId) likedByMeSet.add(postId);
    }

    const commentCountMap = new Map<string, number>();
    for (const row of comments) {
      const postId = row.post_id;
      if (!postId) continue;
      commentCountMap.set(postId, (commentCountMap.get(postId) || 0) + 1);
    }

    for (const postId of missing) {
      const engagement: PostEngagement = {
        likeCount: likeCountMap.get(postId) || 0,
        commentCount: commentCountMap.get(postId) || 0,
        likedByMe: likedByMeSet.has(postId),
      };
      result[postId] = engagement;
      engagementCache.set(cacheKey(postId, userId), { ts: now, engagement });
    }
    return result;
  } catch (e) {
    console.error("Error fetching posts engagement batch:", e);
    // Safe fallback: return no engagement rather than failing the page
    for (const postId of missing) {
      result[postId] = defaultEngagement();
    }
    return result;
  }
}

