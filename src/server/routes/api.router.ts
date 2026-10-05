import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { MeetingsController } from '../controllers/meetings.controller.js';
import { CorrespondenceController } from '../controllers/correspondence.controller.js';
import { DirectivesController } from '../controllers/directives.controller.js';
import { MattersController } from '../controllers/matters.controller.js';
import { ContactsController } from '../controllers/contacts.controller.js';
import { NotificationsController } from '../controllers/notifications.controller.js';
import { AuditController } from '../controllers/audit.controller.js';
import { SettingsController } from '../controllers/settings.controller.js';
import {
  requireAuth,
  csrfProtection,
  mustChangePasswordGuard,
  rbacGuard
} from '../middleware/auth.middleware.js';
import { PermissionAction, PermissionResource } from '../security/permissions.js';

export interface DeclarativeRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  handler: any;
  requireAuth: boolean;
  mustChangePassword: boolean; // if true, blocked if must_change_password is true
  resource?: PermissionResource;
  action?: PermissionAction;
}

export const DECLARATIVE_ROUTES: DeclarativeRoute[] = [
  // 1. Open Routes
  { method: 'get', path: '/health', handler: (req: any, res: any) => res.json({ status: 'ok' }), requireAuth: false, mustChangePassword: false },
  { method: 'post', path: '/auth/login', handler: AuthController.login, requireAuth: false, mustChangePassword: false },

  // 2. Session Routes
  { method: 'get', path: '/auth/me', handler: AuthController.me, requireAuth: true, mustChangePassword: false },
  { method: 'post', path: '/auth/logout', handler: AuthController.logout, requireAuth: true, mustChangePassword: false },
  { method: 'post', path: '/auth/change-password', handler: AuthController.changePassword, requireAuth: true, mustChangePassword: false },
  { method: 'post', path: '/auth/reauth', handler: AuthController.reauth, requireAuth: true, mustChangePassword: false },

  // 3. Users Management
  { method: 'get', path: '/users', handler: AuthController.getUsers, requireAuth: true, mustChangePassword: true, resource: 'users', action: 'read' },

  // 4. Meetings
  { method: 'get', path: '/meetings', handler: MeetingsController.getAll, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'read' },
  { method: 'post', path: '/meetings', handler: MeetingsController.create, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'create' },
  { method: 'get', path: '/meetings/:id', handler: MeetingsController.getById, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'read' },
  { method: 'patch', path: '/meetings/:id', handler: MeetingsController.update, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'update' },
  { method: 'delete', path: '/meetings/:id', handler: MeetingsController.softDelete, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'archive' },
  { method: 'get', path: '/meetings/:id/attendees', handler: MeetingsController.getAttendees, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'read' },
  { method: 'put', path: '/meetings/:id/attendees', handler: MeetingsController.setAttendees, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'update' },
  { method: 'get', path: '/meetings/:id/agenda', handler: MeetingsController.getAgenda, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'read' },
  { method: 'put', path: '/meetings/:id/agenda', handler: MeetingsController.setAgenda, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'update' },
  { method: 'get', path: '/meetings/:id/minutes', handler: MeetingsController.getMinutes, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'read' },
  { method: 'post', path: '/meetings/:id/minutes', handler: MeetingsController.saveMinutes, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'update_minutes' },
  { method: 'post', path: '/meetings/:id/minutes/approve', handler: MeetingsController.approveMinutes, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'approve_minutes' },
  { method: 'get', path: '/meetings/:id/decisions', handler: MeetingsController.getDecisions, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'read' },
  { method: 'post', path: '/meetings/:id/decisions', handler: MeetingsController.addDecision, requireAuth: true, mustChangePassword: true, resource: 'meetings', action: 'decide' },

  // 5. Correspondence
  { method: 'get', path: '/correspondence', handler: CorrespondenceController.getAll, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'read' },
  { method: 'post', path: '/correspondence', handler: CorrespondenceController.create, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'create' },
  { method: 'get', path: '/correspondence/next-serial', handler: CorrespondenceController.getNextSerial, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'read' },
  { method: 'get', path: '/correspondence/:id', handler: CorrespondenceController.getById, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'read' },
  { method: 'patch', path: '/correspondence/:id', handler: CorrespondenceController.update, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'update' },
  { method: 'post', path: '/correspondence/:id/submit', handler: CorrespondenceController.submit, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'update' },
  { method: 'post', path: '/correspondence/:id/reclassify', handler: CorrespondenceController.reclassify, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'update' },
  { method: 'delete', path: '/correspondence/:id', handler: CorrespondenceController.softDelete, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'archive' },
  { method: 'get', path: '/correspondence/:id/briefing', handler: CorrespondenceController.getBriefing, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'read' },
  { method: 'post', path: '/correspondence/:id/briefing', handler: CorrespondenceController.saveBriefing, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'comment' },
  { method: 'get', path: '/correspondence/:id/approval', handler: CorrespondenceController.getApproval, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'read' },
  { method: 'post', path: '/correspondence/:id/approval', handler: CorrespondenceController.recordApproval, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'approve' },
  { method: 'get', path: '/correspondence/:id/routings', handler: CorrespondenceController.getRoutings, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'read' },
  { method: 'post', path: '/correspondence/:id/routings', handler: CorrespondenceController.addRouting, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'refer' },
  { method: 'get', path: '/correspondence/:id/attachments', handler: CorrespondenceController.getAttachments, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'read' },
  { method: 'post', path: '/correspondence/:id/attachments', handler: CorrespondenceController.addAttachment, requireAuth: true, mustChangePassword: true, resource: 'correspondence', action: 'update' },

  // 6. Directives
  { method: 'get', path: '/directives', handler: DirectivesController.getAll, requireAuth: true, mustChangePassword: true, resource: 'directives', action: 'read' },
  { method: 'post', path: '/directives', handler: DirectivesController.create, requireAuth: true, mustChangePassword: true, resource: 'directives', action: 'create' },
  { method: 'get', path: '/directives/next-code', handler: DirectivesController.getNextCode, requireAuth: true, mustChangePassword: true, resource: 'directives', action: 'read' },
  { method: 'get', path: '/directives/:id', handler: DirectivesController.getById, requireAuth: true, mustChangePassword: true, resource: 'directives', action: 'read' },
  { method: 'patch', path: '/directives/:id', handler: DirectivesController.update, requireAuth: true, mustChangePassword: true, resource: 'directives', action: 'update' },
  { method: 'post', path: '/directives/:id/status', handler: DirectivesController.updateStatus, requireAuth: true, mustChangePassword: true, resource: 'directives', action: 'update' },
  { method: 'delete', path: '/directives/:id', handler: DirectivesController.softDelete, requireAuth: true, mustChangePassword: true, resource: 'directives', action: 'archive' },
  { method: 'get', path: '/directives/:id/updates', handler: DirectivesController.getUpdates, requireAuth: true, mustChangePassword: true, resource: 'directives', action: 'read' },
  { method: 'post', path: '/directives/:id/updates', handler: DirectivesController.addUpdate, requireAuth: true, mustChangePassword: true, resource: 'directives', action: 'update' },

  // 7. Matters
  { method: 'get', path: '/matters', handler: MattersController.getAll, requireAuth: true, mustChangePassword: true, resource: 'matters', action: 'read' },
  { method: 'post', path: '/matters', handler: MattersController.create, requireAuth: true, mustChangePassword: true, resource: 'matters', action: 'create' },
  { method: 'get', path: '/matters/:id', handler: MattersController.getById, requireAuth: true, mustChangePassword: true, resource: 'matters', action: 'read' },
  { method: 'patch', path: '/matters/:id', handler: MattersController.update, requireAuth: true, mustChangePassword: true, resource: 'matters', action: 'update' },
  { method: 'delete', path: '/matters/:id', handler: MattersController.softDelete, requireAuth: true, mustChangePassword: true, resource: 'matters', action: 'archive' },
  { method: 'get', path: '/matters/:id/links', handler: MattersController.getLinks, requireAuth: true, mustChangePassword: true, resource: 'matters', action: 'read' },
  { method: 'post', path: '/matters/:id/links', handler: MattersController.addLink, requireAuth: true, mustChangePassword: true, resource: 'matters', action: 'update' },
  { method: 'delete', path: '/matters/links/:linkId', handler: MattersController.removeLink, requireAuth: true, mustChangePassword: true, resource: 'matters', action: 'update' },

  // 8. Contacts
  { method: 'get', path: '/contacts', handler: ContactsController.getAll, requireAuth: true, mustChangePassword: true, resource: 'contacts', action: 'read' },
  { method: 'post', path: '/contacts', handler: ContactsController.create, requireAuth: true, mustChangePassword: true, resource: 'contacts', action: 'create' },
  { method: 'get', path: '/contacts/:id', handler: ContactsController.getById, requireAuth: true, mustChangePassword: true, resource: 'contacts', action: 'read' },
  { method: 'patch', path: '/contacts/:id', handler: ContactsController.update, requireAuth: true, mustChangePassword: true, resource: 'contacts', action: 'update' },
  { method: 'delete', path: '/contacts/:id', handler: ContactsController.softDelete, requireAuth: true, mustChangePassword: true, resource: 'contacts', action: 'archive' },
  { method: 'get', path: '/contacts/:id/interactions', handler: ContactsController.getInteractions, requireAuth: true, mustChangePassword: true, resource: 'contacts', action: 'read' },
  { method: 'post', path: '/contacts/:id/interactions', handler: ContactsController.addInteraction, requireAuth: true, mustChangePassword: true, resource: 'contacts', action: 'update' },

  // 9. Notifications
  { method: 'get', path: '/notifications', handler: NotificationsController.getAll, requireAuth: true, mustChangePassword: true, resource: 'notifications', action: 'read' },
  { method: 'patch', path: '/notifications/:id/read', handler: NotificationsController.markAsRead, requireAuth: true, mustChangePassword: true, resource: 'notifications', action: 'update' },
  { method: 'post', path: '/notifications/read-all', handler: NotificationsController.markAllAsRead, requireAuth: true, mustChangePassword: true, resource: 'notifications', action: 'update' },

  // 10. Audit Log
  { method: 'get', path: '/audit', handler: AuditController.getAll, requireAuth: true, mustChangePassword: true, resource: 'audit', action: 'read' },
  { method: 'get', path: '/audit/verify', handler: AuditController.verify, requireAuth: true, mustChangePassword: true, resource: 'audit', action: 'read' },

  // 11. Settings
  { method: 'get', path: '/settings', handler: SettingsController.getSettings, requireAuth: true, mustChangePassword: true, resource: 'settings', action: 'read' },
  { method: 'patch', path: '/settings', handler: SettingsController.updateSettings, requireAuth: true, mustChangePassword: true, resource: 'settings', action: 'update' }
];

export const apiRouter = Router();

// Apply CSRF Protection to all state-changing API requests
apiRouter.use(csrfProtection);

// Register each route with its correct middleware chain dynamically
DECLARATIVE_ROUTES.forEach((route) => {
  const middlewares: any[] = [];

  if (route.requireAuth) {
    middlewares.push(requireAuth);
  }

  if (route.mustChangePassword) {
    middlewares.push(mustChangePasswordGuard);
  }

  if (route.resource && route.action) {
    middlewares.push(rbacGuard(route.resource, route.action));
  }

  // Register route in Express Router
  apiRouter[route.method](route.path, ...middlewares, route.handler);
});
