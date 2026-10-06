import {
  Meeting,
  MeetingAttendee,
  AgendaItem,
  MeetingMinutes,
  Decision,
  Correspondence,
  BriefingNote,
  Approval,
  CorrespondenceRouting,
  Attachment,
  Directive,
  DirectiveUpdate,
  Matter,
  MatterLink,
  Contact,
  Interaction,
  Notification,
  AuditLogEntry,
  SystemSettings,
  User,
  RoleType
} from '../../domain/types/index.js';

export interface UserContext {
  userId: string;
  role: RoleType;
  can_view_confidential: boolean;
}

export class SecurityAuthorizationError extends Error {
  constructor(message: string = 'غير مصرح بتنفيذ هذا الإجراء') {
    super(message);
    this.name = 'SecurityAuthorizationError';
  }
}

export type MeetingFilter = { status?: string; matterId?: string; date?: string; search?: string };
export type CorrespondenceFilter = { type?: 'incoming' | 'outgoing'; status?: string; matterId?: string; priority?: string; category?: string; tag?: string; search?: string };
export type DirectiveFilter = { status?: string; assignedDepartment?: string; matterId?: string; search?: string };
export type MatterFilter = { status?: string; search?: string; matterId?: string };
export type AuditFilter = { entityType?: string; userId?: string; limit?: number };

export interface IMeetingRepository {
  getAll(filter: MeetingFilter | undefined, ctx: UserContext): Promise<Meeting[]>;
  getById(id: string, ctx: UserContext): Promise<Meeting | null>;
  create(meeting: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Meeting>;
  update(id: string, meeting: Partial<Meeting>, ctx: UserContext): Promise<Meeting>;
  softDelete(id: string, ctx: UserContext): Promise<boolean>;
  getAttendees(meetingId: string, ctx: UserContext): Promise<MeetingAttendee[]>;
  setAttendees(meetingId: string, attendees: Omit<MeetingAttendee, 'id' | 'meeting_id'>[], ctx: UserContext): Promise<void>;
  getAgenda(meetingId: string, ctx: UserContext): Promise<AgendaItem[]>;
  setAgenda(meetingId: string, items: Omit<AgendaItem, 'id' | 'meeting_id'>[], ctx: UserContext): Promise<void>;
  getMinutes(meetingId: string, ctx: UserContext): Promise<MeetingMinutes | null>;
  saveMinutes(minutes: Omit<MeetingMinutes, 'id'>, ctx: UserContext): Promise<MeetingMinutes>;
  getDecisions(meetingId: string, ctx: UserContext): Promise<Decision[]>;
  addDecision(decision: Omit<Decision, 'id'>, ctx: UserContext): Promise<Decision>;
}

export interface ICorrespondenceRepository {
  getAll(filter: CorrespondenceFilter | undefined, ctx: UserContext): Promise<Correspondence[]>;
  getById(id: string, ctx: UserContext): Promise<Correspondence | null>;
  getBySerial(serial: string, ctx: UserContext): Promise<Correspondence | null>;
  create(item: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Correspondence>;
  update(id: string, item: Partial<Correspondence>, ctx: UserContext): Promise<Correspondence>;
  softDelete(id: string, ctx: UserContext): Promise<boolean>;
  getBriefingNote(correspondenceId: string, ctx: UserContext): Promise<BriefingNote | null>;
  saveBriefingNote(note: Omit<BriefingNote, 'id'>, ctx: UserContext): Promise<BriefingNote>;
  getApproval(correspondenceId: string, ctx: UserContext): Promise<Approval | null>;
  recordApproval(approval: Omit<Approval, 'id'>, ctx: UserContext): Promise<Approval>;
  getRoutings(correspondenceId: string, ctx: UserContext): Promise<CorrespondenceRouting[]>;
  addRouting(routing: Omit<CorrespondenceRouting, 'id'>, ctx: UserContext): Promise<CorrespondenceRouting>;
  getAttachments(correspondenceId: string, ctx: UserContext): Promise<Attachment[]>;
  addAttachment(att: Omit<Attachment, 'id'>, ctx: UserContext): Promise<Attachment>;
  getNextSerial(type: 'incoming' | 'outgoing', year?: number): Promise<string>;
}

export interface IDirectiveRepository {
  getAll(filter: DirectiveFilter | undefined, ctx: UserContext): Promise<Directive[]>;
  getById(id: string, ctx: UserContext): Promise<Directive | null>;
  create(directive: Omit<Directive, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Directive>;
  update(id: string, directive: Partial<Directive>, ctx: UserContext): Promise<Directive>;
  softDelete(id: string, ctx: UserContext): Promise<boolean>;
  getUpdates(directiveId: string, ctx: UserContext): Promise<DirectiveUpdate[]>;
  addUpdate(update: Omit<DirectiveUpdate, 'id' | 'created_at'>, ctx: UserContext): Promise<DirectiveUpdate>;
  getNextCode(year?: number): Promise<string>;
}

export interface IMatterRepository {
  getAll(filter: MatterFilter | undefined, ctx: UserContext): Promise<Matter[]>;
  getById(id: string, ctx: UserContext): Promise<Matter | null>;
  create(matter: Omit<Matter, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Matter>;
  update(id: string, matter: Partial<Matter>, ctx: UserContext): Promise<Matter>;
  softDelete(id: string, ctx: UserContext): Promise<boolean>;
  getLinks(matterId: string, ctx: UserContext): Promise<MatterLink[]>;
  addLink(link: Omit<MatterLink, 'id' | 'created_at'>, ctx: UserContext): Promise<MatterLink>;
  removeLink(linkId: string, ctx: UserContext): Promise<boolean>;
}

export interface IContactRepository {
  getAll(ctx: UserContext): Promise<Contact[]>;
  getById(id: string, ctx: UserContext): Promise<Contact | null>;
  create(contact: Omit<Contact, 'id' | 'created_at'>, ctx: UserContext): Promise<Contact>;
  update(id: string, contact: Partial<Contact>, ctx: UserContext): Promise<Contact>;
  softDelete(id: string, ctx: UserContext): Promise<boolean>;
  getInteractions(contactId: string, ctx: UserContext): Promise<Interaction[]>;
  addInteraction(interaction: Omit<Interaction, 'id'>, ctx: UserContext): Promise<Interaction>;
}

export interface INotificationRepository {
  getAllForRole(role: RoleType, ctx: UserContext): Promise<Notification[]>;
  create(notification: Omit<Notification, 'id' | 'created_at'>, ctx: UserContext): Promise<Notification>;
  markAsRead(id: string, ctx: UserContext): Promise<void>;
  markAllAsRead(role: RoleType, ctx: UserContext): Promise<void>;
}

export interface IAuditRepository {
  getAll(filter: AuditFilter | undefined, ctx: UserContext): Promise<AuditLogEntry[]>;
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>, ctx: UserContext): Promise<void>;
}

export interface IUserRepository {
  getAll(ctx: UserContext): Promise<User[]>;
  getById(id: string, ctx: UserContext): Promise<User | null>;
  getByUsername(username: string): Promise<(User & { password_hash: string; password_salt: string }) | null>;
  getByRole(role: RoleType, ctx: UserContext): Promise<User[]>;
  updatePassword(userId: string, hash: string, salt: string, ctx: UserContext): Promise<void>;
}

export interface ISettingsRepository {
  getSettings(ctx: UserContext): Promise<SystemSettings>;
  updateSettings(settings: Partial<SystemSettings>, ctx: UserContext): Promise<SystemSettings>;
}
