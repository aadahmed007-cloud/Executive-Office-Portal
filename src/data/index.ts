/**
 * Data Access Layer Factory & Repository Registry.
 *
 * All client data access flows through the API Repository layer calling Express routes (/api/*).
 * This eliminates SQLite engine, seed data, and hashing code from the client bundle.
 */

import {
  meetingRepo,
  correspondenceRepo,
  directiveRepo,
  matterRepo,
  contactRepo,
  notificationRepo,
  auditRepo,
  userRepo,
  settingsRepo
} from './api/apiRepositories';

export {
  meetingRepo,
  correspondenceRepo,
  directiveRepo,
  matterRepo,
  contactRepo,
  notificationRepo,
  auditRepo,
  userRepo,
  settingsRepo
};

export * from './contracts';
