/**
 * Utility functions for notification actions and deep linking
 */

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'default' | 'outline' | 'secondary';
}

/**
 * Get action URL for a notification based on its type and related IDs
 */
export function getNotificationActionUrl(
  type: string,
  relatedId: string | null,
  relatedUserId: string | null,
  actionUrl: string | null
): string | null {
  // If action_url is explicitly set, use it
  if (actionUrl) {
    return actionUrl;
  }

  // Otherwise, generate based on type and related IDs
  switch (type) {
    case 'high_score':
      if (relatedId) {
        // Navigate to drill results/leaderboard
        return `/drill-results/${relatedId}`;
      }
      break;
    case 'group_invite':
      if (relatedId) {
        return `/group/${relatedId}`;
      }
      break;
    case 'message':
      if (relatedId) {
        return `/messages?conversation=${relatedId}`;
      }
      return '/messages';
    case 'friend_request':
      if (relatedUserId) {
        return `/user/${relatedUserId}`;
      }
      return '/friends';
    default:
      return null;
  }

  return null;
}

/**
 * Get action buttons for a notification
 */
export function getNotificationActions(
  type: string,
  relatedId: string | null,
  relatedUserId: string | null,
  actionUrl: string | null,
  onNavigate: (url: string) => void
): NotificationAction[] {
  const actions: NotificationAction[] = [];
  const url = getNotificationActionUrl(type, relatedId, relatedUserId, actionUrl);

  if (url) {
    actions.push({
      label: type === 'high_score' ? 'View Drill' :
             type === 'group_invite' ? 'View Group' :
             type === 'message' ? 'Open Messages' :
             type === 'friend_request' ? 'View Profile' :
             'View',
      action: () => onNavigate(url),
      variant: 'default',
    });
  }

  return actions;
}
