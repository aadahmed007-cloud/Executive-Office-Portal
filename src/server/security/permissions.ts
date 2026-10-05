import { RoleType, User } from '../../domain/types/index.js';
import { UserContext } from '../../data/contracts/index.js';

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'archive'
  | 'update_minutes'
  | 'approve_minutes'
  | 'decide'
  | 'comment'
  | 'refer'
  | 'disable';

export type PermissionResource =
  | 'meetings'
  | 'correspondence'
  | 'directives'
  | 'matters'
  | 'contacts'
  | 'notifications'
  | 'audit'
  | 'users'
  | 'settings';

export const PERMISSION_MATRIX: Record<RoleType, Partial<Record<PermissionResource, Partial<Record<PermissionAction, boolean>>>>> = {
  SECRETARY: {
    meetings: { create: true, read: true, update: true, update_minutes: true, archive: true },
    correspondence: { create: true, read: true, update: true, comment: true, refer: true, archive: true },
    directives: { read: true, update: true, archive: true },
    matters: { create: true, read: true, update: true, archive: true },
    contacts: { create: true, read: true, update: true, archive: true },
    notifications: { read: true, update: true },
    users: { read: true },
    audit: { read: true }
  },
  CHAIRMAN: {
    meetings: { read: true, approve_minutes: true, decide: true },
    correspondence: { read: true, approve: true, comment: true, refer: true },
    directives: { create: true, read: true, update: true },
    matters: { read: true },
    contacts: { read: true },
    notifications: { read: true, update: true },
    users: { read: true },
  },
  ADMIN: {
    users: { create: true, read: true, update: true, disable: true },
    settings: { read: true, update: true },
    audit: { read: true }
  },
  AUDITOR: {},
  DEPT_HEAD: {}
};

export function can(
  user: User | UserContext | undefined,
  action: PermissionAction,
  resource: PermissionResource
): boolean {
  if (!user) {
    return false;
  }
  const role: RoleType = 'role' in user ? user.role : (user as UserContext).role;
  return Boolean(PERMISSION_MATRIX[role]?.[resource]?.[action]);
}
