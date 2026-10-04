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
} from '../../domain/types';

export interface UserContext {
  userId?: string;
  role?: RoleType;
  can_view_confidential?: boolean;
}

export class SecurityAuthorizationError extends Error {
  constructor(message: string = 'غير مصرح بتنفيذ هذا الإجراء (Access Denied: Unauthorized action)') {
    super(message);
    this.name = 'SecurityAuthorizationError';
  }
}

export interface IMeetingRepository {
  getAll(
    filter?: { status?: string; matterId?: string; date?: string; search?: string },
    userContext?: UserContext
  ): Promise<Meeting[]>;
  getById(id: string, userContext?: UserContext): Promise<Meeting | null>;
  create(meeting: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Meeting>;
  update(id: string, meeting: Partial<Meeting>, userContext?: UserContext): Promise<Meeting>;
  softDelete(id: string, userContext?: UserContext): Promise<boolean>;
  getAttendees(meetingId: string, userContext?: UserContext): Promise<MeetingAttendee[]>;
  setAttendees(meetingId: string, attendees: Omit<MeetingAttendee, 'id' | 'meeting_id'>[], userContext?: UserContext): Promise<void>;
  getAgenda(meetingId: string, userContext?: UserContext): Promise<AgendaItem[]>;
  setAgenda(meetingId: string, items: Omit<AgendaItem, 'id' | 'meeting_id'>[], userContext?: UserContext): Promise<void>;
  getMinutes(meetingId: string, userContext?: UserContext): Promise<MeetingMinutes | null>;
  saveMinutes(minutes: Omit<MeetingMinutes, 'id'>, userContext?: UserContext): Promise<MeetingMinutes>;
  getDecisions(meetingId: string, userContext?: UserContext): Promise<Decision[]>;
  addDecision(decision: Omit<Decision, 'id'>, userContext?: UserContext): Promise<Decision>;
}

export interface ICorrespondenceRepository {
  getAll(
    filter?: { type?: 'incoming' | 'outgoing'; status?: string; matterId?: string; priority?: string; category?: string; tag?: string; search?: string },
    userContext?: UserContext
  ): Promise<Correspondence[]>;
  getById(id: string, userContext?: UserContext): Promise<Correspondence | null>;
  getBySerial(serial: string, userContext?: UserContext): Promise<Correspondence | null>;
  create(item: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Correspondence>;
  update(id: string, item: Partial<Correspondence>, userContext?: UserContext): Promise<Correspondence>;
  softDelete(id: string, userContext?: UserContext): Promise<boolean>;
  getBriefingNote(correspondenceId: string, userContext?: UserContext): Promise<BriefingNote | null>;
  saveBriefingNote(note: Omit<BriefingNote, 'id'>, userContext?: UserContext): Promise<BriefingNote>;
  getApproval(correspondenceId: string, userContext?: UserContext): Promise<Approval | null>;
  recordApproval(approval: Omit<Approval, 'id'>, userContext?: UserContext): Promise<Approval>;
  getRoutings(correspondenceId: string, userContext?: UserContext): Promise<CorrespondenceRouting[]>;
  addRouting(routing: Omit<CorrespondenceRouting, 'id'>, userContext?: UserContext): Promise<CorrespondenceRouting>;
  getAttachments(correspondenceId: string, userContext?: UserContext): Promise<Attachment[]>;
  addAttachment(att: Omit<Attachment, 'id'>, userContext?: UserContext): Promise<Attachment>;
  getNextSerial(type: 'incoming' | 'outgoing', year?: number): Promise<string>;
}

export interface IDirectiveRepository {
  getAll(
    filter?: { status?: string; assignedDepartment?: string; matterId?: string; search?: string },
    userContext?: UserContext
  ): Promise<Directive[]>;
  getById(id: string, userContext?: UserContext): Promise<Directive | null>;
  create(directive: Omit<Directive, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Directive>;
  update(id: string, directive: Partial<Directive>, userContext?: UserContext): Promise<Directive>;
  softDelete(id: string, userContext?: UserContext): Promise<boolean>;
  getUpdates(directiveId: string, userContext?: UserContext): Promise<DirectiveUpdate[]>;
  addUpdate(update: Omit<DirectiveUpdate, 'id' | 'created_at'>, userContext?: UserContext): Promise<DirectiveUpdate>;
  getNextCode(year?: number): Promise<string>;
}

export interface IMatterRepository {
  getAll(filter?: { status?: string; search?: string }, userContext?: UserContext): Promise<Matter[]>;
  getById(id: string, userContext?: UserContext): Promise<Matter | null>;
  create(matter: Omit<Matter, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Matter>;
  update(id: string, matter: Partial<Matter>, userContext?: UserContext): Promise<Matter>;
  softDelete(id: string, userContext?: UserContext): Promise<boolean>;
  getLinks(matterId: string, userContext?: UserContext): Promise<MatterLink[]>;
  addLink(link: Omit<MatterLink, 'id' | 'created_at'>, userContext?: UserContext): Promise<MatterLink>;
  removeLink(linkId: string, userContext?: UserContext): Promise<boolean>;
}

export interface IContactRepository {
  getAll(): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  create(contact: Omit<Contact, 'id' | 'created_at'>, userContext?: UserContext): Promise<Contact>;
  update(id: string, contact: Partial<Contact>, userContext?: UserContext): Promise<Contact>;
  softDelete(id: string, userContext?: UserContext): Promise<boolean>;
  getInteractions(contactId: string): Promise<Interaction[]>;
  addInteraction(interaction: Omit<Interaction, 'id'>, userContext?: UserContext): Promise<Interaction>;
}

export interface INotificationRepository {
  getAllForRole(role: RoleType, userContext?: UserContext): Promise<Notification[]>;
  create(notification: Omit<Notification, 'id' | 'created_at'>, userContext?: UserContext): Promise<Notification>;
  markAsRead(id: string, userContext?: UserContext): Promise<void>;
  markAllAsRead(role: RoleType, userContext?: UserContext): Promise<void>;
}

export interface IAuditRepository {
  getAll(filter?: { entityType?: string; userId?: string; limit?: number }): Promise<AuditLogEntry[]>;
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void>;
}

export interface IUserRepository {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  getByUsername(username: string): Promise<(User & { password_hash: string; password_salt: string }) | null>;
  getByRole(role: RoleType): Promise<User[]>;
  updatePassword(userId: string, hash: string, salt: string): Promise<void>;
}

export interface ISettingsRepository {
  getSettings(): Promise<SystemSettings>;
  updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings>;
}
