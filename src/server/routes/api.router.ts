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

export const apiRouter = Router();

// Health Check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'sovereign_local',
    db: 'sqlite_wal',
    timestamp: new Date().toISOString()
  });
});

// 1. Auth & Users
apiRouter.post('/auth/login', AuthController.login);
apiRouter.get('/users', AuthController.getUsers);

// 2. Meetings
apiRouter.get('/meetings', MeetingsController.getAll);
apiRouter.post('/meetings', MeetingsController.create);
apiRouter.get('/meetings/:id', MeetingsController.getById);
apiRouter.patch('/meetings/:id', MeetingsController.update);
apiRouter.delete('/meetings/:id', MeetingsController.softDelete);
apiRouter.get('/meetings/:id/attendees', MeetingsController.getAttendees);
apiRouter.put('/meetings/:id/attendees', MeetingsController.setAttendees);
apiRouter.get('/meetings/:id/agenda', MeetingsController.getAgenda);
apiRouter.put('/meetings/:id/agenda', MeetingsController.setAgenda);
apiRouter.get('/meetings/:id/minutes', MeetingsController.getMinutes);
apiRouter.post('/meetings/:id/minutes', MeetingsController.saveMinutes);
apiRouter.get('/meetings/:id/decisions', MeetingsController.getDecisions);
apiRouter.post('/meetings/:id/decisions', MeetingsController.addDecision);

// 3. Correspondence
apiRouter.get('/correspondence', CorrespondenceController.getAll);
apiRouter.post('/correspondence', CorrespondenceController.create);
apiRouter.get('/correspondence/next-serial', CorrespondenceController.getNextSerial);
apiRouter.get('/correspondence/:id', CorrespondenceController.getById);
apiRouter.patch('/correspondence/:id', CorrespondenceController.update);
apiRouter.delete('/correspondence/:id', CorrespondenceController.softDelete);
apiRouter.get('/correspondence/:id/briefing', CorrespondenceController.getBriefing);
apiRouter.post('/correspondence/:id/briefing', CorrespondenceController.saveBriefing);
apiRouter.get('/correspondence/:id/approval', CorrespondenceController.getApproval);
apiRouter.post('/correspondence/:id/approval', CorrespondenceController.recordApproval);
apiRouter.get('/correspondence/:id/routings', CorrespondenceController.getRoutings);
apiRouter.post('/correspondence/:id/routings', CorrespondenceController.addRouting);
apiRouter.get('/correspondence/:id/attachments', CorrespondenceController.getAttachments);
apiRouter.post('/correspondence/:id/attachments', CorrespondenceController.addAttachment);

// 4. Directives
apiRouter.get('/directives', DirectivesController.getAll);
apiRouter.post('/directives', DirectivesController.create);
apiRouter.get('/directives/next-code', DirectivesController.getNextCode);
apiRouter.get('/directives/:id', DirectivesController.getById);
apiRouter.patch('/directives/:id', DirectivesController.update);
apiRouter.delete('/directives/:id', DirectivesController.softDelete);
apiRouter.get('/directives/:id/updates', DirectivesController.getUpdates);
apiRouter.post('/directives/:id/updates', DirectivesController.addUpdate);

// 5. Matters
apiRouter.get('/matters', MattersController.getAll);
apiRouter.post('/matters', MattersController.create);
apiRouter.get('/matters/:id', MattersController.getById);
apiRouter.patch('/matters/:id', MattersController.update);
apiRouter.delete('/matters/:id', MattersController.softDelete);
apiRouter.get('/matters/:id/links', MattersController.getLinks);
apiRouter.post('/matters/:id/links', MattersController.addLink);
apiRouter.delete('/matters/links/:linkId', MattersController.removeLink);

// 6. Contacts
apiRouter.get('/contacts', ContactsController.getAll);
apiRouter.post('/contacts', ContactsController.create);
apiRouter.get('/contacts/:id', ContactsController.getById);
apiRouter.patch('/contacts/:id', ContactsController.update);
apiRouter.delete('/contacts/:id', ContactsController.softDelete);
apiRouter.get('/contacts/:id/interactions', ContactsController.getInteractions);
apiRouter.post('/contacts/:id/interactions', ContactsController.addInteraction);

// 7. Notifications
apiRouter.get('/notifications', NotificationsController.getAll);
apiRouter.post('/notifications', NotificationsController.create);
apiRouter.patch('/notifications/:id/read', NotificationsController.markAsRead);
apiRouter.post('/notifications/read-all', NotificationsController.markAllAsRead);

// 8. Audit Log
apiRouter.get('/audit', AuditController.getAll);
apiRouter.post('/audit', AuditController.log);

// 9. Settings
apiRouter.get('/settings', SettingsController.getSettings);
apiRouter.patch('/settings', SettingsController.updateSettings);
