/**
 * Server-side Repository Registry
 * Exports instantiated SQLite database repositories for server controllers.
 */

import {
  SqliteMeetingRepository,
  SqliteCorrespondenceRepository,
  SqliteDirectiveRepository,
  SqliteMatterRepository,
  SqliteContactRepository,
  SqliteNotificationRepository,
  SqliteAuditRepository,
  SqliteUserRepository,
  SqliteSettingsRepository
} from '../../data/sqlite/repositories.js';

export const meetingRepo = new SqliteMeetingRepository();
export const correspondenceRepo = new SqliteCorrespondenceRepository();
export const directiveRepo = new SqliteDirectiveRepository();
export const matterRepo = new SqliteMatterRepository();
export const contactRepo = new SqliteContactRepository();
export const notificationRepo = new SqliteNotificationRepository();
export const auditRepo = new SqliteAuditRepository();
export const userRepo = new SqliteUserRepository();
export const settingsRepo = new SqliteSettingsRepository();

export * from '../../data/contracts/index.js';
export * from '../../data/sqlite/repositories.js';
