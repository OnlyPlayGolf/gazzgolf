export type GroupType = 'player' | 'coach';
export type GroupMemberRole = 'owner' | 'admin' | 'member';

interface GetGroupRoleLabelArgs {
  groupType?: GroupType | null;
  role: GroupMemberRole;
}

/**
 * Returns the user-facing label for a member's role within a group.
 *
 * - Player groups: owner -> Owner, others -> Player
 * - Coach groups: owner/admin -> Coach, member -> Player
 */
export function getGroupRoleLabel({ groupType, role }: GetGroupRoleLabelArgs): string {
  const effectiveGroupType: GroupType = groupType === 'coach' ? 'coach' : 'player';

  if (effectiveGroupType === 'player') {
    return role === 'owner' ? 'Owner' : 'Player';
  }

  return role === 'owner' || role === 'admin' ? 'Coach' : 'Player';
}

