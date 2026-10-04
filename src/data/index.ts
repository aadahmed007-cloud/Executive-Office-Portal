/**
 * Data Access Layer Factory & Repository Registry.
 *
 * Supports Dual Providers:
 * 1. 'sqlite': Autonomous Client/Local WASM SQLite provider (default).
 * 2. 'api': Local Host / Network Server Express API provider.
 *
 * This clean architectural separation fulfills the requirement to allow swapping
 * local mock/in-memory data with a real server backend without altering domain/UI code.
 */

import {
  meetingRepo as sqliteMeetingRepo,
  correspondenceRepo as sqliteCorrespondenceRepo,
  directiveRepo as sqliteDirectiveRepo,
  matterRepo as sqliteMatterRepo,
  contactRepo as sqliteContactRepo,
  notificationRepo as sqliteNotificationRepo,
  auditRepo as sqliteAuditRepo,
  userRepo as sqliteUserRepo,
  settingsRepo as sqliteSettingsRepo
} from './sqlite/repositories';

import {
  ApiMeetingRepository,
  ApiCorrespondenceRepository,
  ApiDirectiveRepository,
  ApiMatterRepository,
  ApiContactRepository,
  ApiNotificationRepository,
  ApiAuditRepository,
  ApiUserRepository,
  ApiSettingsRepository
} from './api/apiRepositories';

import {
  IMeetingRepository,
  ICorrespondenceRepository,
  IDirectiveRepository,
  IMatterRepository,
  IContactRepository,
  INotificationRepository,
  IAuditRepository,
  IUserRepository,
  ISettingsRepository
} from './contracts';

const isApiProvider = typeof process !== 'undefined'
  ? process.env.VITE_DATA_PROVIDER === 'api'
  : (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DATA_PROVIDER === 'api');

export const meetingRepo: IMeetingRepository = isApiProvider ? new ApiMeetingRepository() : sqliteMeetingRepo;
export const correspondenceRepo: ICorrespondenceRepository = isApiProvider ? new ApiCorrespondenceRepository() : sqliteCorrespondenceRepo;
export const directiveRepo: IDirectiveRepository = isApiProvider ? new ApiDirectiveRepository() : sqliteDirectiveRepo;
export const matterRepo: IMatterRepository = isApiProvider ? new ApiMatterRepository() : sqliteMatterRepo;
export const contactRepo: IContactRepository = isApiProvider ? new ApiContactRepository() : sqliteContactRepo;
export const notificationRepo: INotificationRepository = isApiProvider ? new ApiNotificationRepository() : sqliteNotificationRepo;
export const auditRepo: IAuditRepository = isApiProvider ? new ApiAuditRepository() : sqliteAuditRepo;
export const userRepo: IUserRepository = isApiProvider ? new ApiUserRepository() : sqliteUserRepo;
export const settingsRepo: ISettingsRepository = isApiProvider ? new ApiSettingsRepository() : sqliteSettingsRepo;

export * from './contracts';
