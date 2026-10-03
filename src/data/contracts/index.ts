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

export interface IMeetingRepository {
  getAll(filter?: { status?: string; matterId?: string; date?: string }): Promise<Meeting[]>;
  getById(id: string): Promise<Meeting | null>;
  create(meeting: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>): Promise<Meeting>;
  update(id: string, meeting: Partial<Meeting>): Promise<Meeting>;
  softDelete(id: string): Promise<boolean>;
  getAttendees(meetingId: string): Promise<MeetingAttendee[]>;
  setAttendees(meetingId: string, attendees: Omit<MeetingAttendee, 'id' | 'meeting_id'>[]): Promise<void>;
  getAgenda(meetingId: string): Promise<AgendaItem[]>;
  setAgenda(meetingId: string, items: Omit<AgendaItem, 'id' | 'meeting_id'>[]): Promise<void>;
  getMinutes(meetingId: string): Promise<MeetingMinutes | null>;
  saveMinutes(minutes: Omit<MeetingMinutes, 'id'>): Promise<MeetingMinutes>;
  getDecisions(meetingId: string): Promise<Decision[]>;
  addDecision(decision: Omit<Decision, 'id'>): Promise<Decision>;
}

export interface ICorrespondenceRepository {
  getAll(filter?: { type?: 'incoming' | 'outgoing'; status?: string; matterId?: string; priority?: string }): Promise<Correspondence[]>;
  getById(id: string): Promise<Correspondence | null>;
  getBySerial(serial: string): Promise<Correspondence | null>;
  create(item: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>): Promise<Correspondence>;
  update(id: string, item: Partial<Correspondence>): Promise<Correspondence>;
  softDelete(id: string): Promise<boolean>;
  getBriefingNote(correspondenceId: string): Promise<BriefingNote | null>;
  saveBriefingNote(note: Omit<BriefingNote, 'id'>): Promise<BriefingNote>;
  getApproval(correspondenceId: string): Promise<Approval | null>;
  recordApproval(approval: Omit<Approval, 'id'>): Promise<Approval>;
  getRoutings(correspondenceId: string): Promise<CorrespondenceRouting[]>;
  addRouting(routing: Omit<CorrespondenceRouting, 'id'>): Promise<CorrespondenceRouting>;
  getAttachments(correspondenceId: string): Promise<Attachment[]>;
  addAttachment(att: Omit<Attachment, 'id'>): Promise<Attachment>;
  getNextSerial(type: 'incoming' | 'outgoing', year?: number): Promise<string>;
}

export interface IDirectiveRepository {
  getAll(filter?: { status?: string; assignedDepartment?: string; matterId?: string }): Promise<Directive[]>;
  getById(id: string): Promise<Directive | null>;
  create(directive: Omit<Directive, 'id' | 'created_at' | 'updated_at'>): Promise<Directive>;
  update(id: string, directive: Partial<Directive>): Promise<Directive>;
  softDelete(id: string): Promise<boolean>;
  getUpdates(directiveId: string): Promise<DirectiveUpdate[]>;
  addUpdate(update: Omit<DirectiveUpdate, 'id' | 'created_at'>): Promise<DirectiveUpdate>;
  getNextCode(year?: number): Promise<string>;
}

export interface IMatterRepository {
  getAll(filter?: { status?: string }): Promise<Matter[]>;
  getById(id: string): Promise<Matter | null>;
  create(matter: Omit<Matter, 'id' | 'created_at' | 'updated_at'>): Promise<Matter>;
  update(id: string, matter: Partial<Matter>): Promise<Matter>;
  softDelete(id: string): Promise<boolean>;
  getLinks(matterId: string): Promise<MatterLink[]>;
  addLink(link: Omit<MatterLink, 'id' | 'created_at'>): Promise<MatterLink>;
  removeLink(linkId: string): Promise<boolean>;
}

export interface IContactRepository {
  getAll(): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  create(contact: Omit<Contact, 'id' | 'created_at'>): Promise<Contact>;
  update(id: string, contact: Partial<Contact>): Promise<Contact>;
  softDelete(id: string): Promise<boolean>;
  getInteractions(contactId: string): Promise<Interaction[]>;
  addInteraction(interaction: Omit<Interaction, 'id'>): Promise<Interaction>;
}

export interface INotificationRepository {
  getAllForRole(role: RoleType): Promise<Notification[]>;
  create(notification: Omit<Notification, 'id' | 'created_at'>): Promise<Notification>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(role: RoleType): Promise<void>;
}

export interface IAuditRepository {
  getAll(filter?: { entityType?: string; userId?: string; limit?: number }): Promise<AuditLogEntry[]>;
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void>;
}

export interface IUserRepository {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  getByRole(role: RoleType): Promise<User[]>;
}

export interface ISettingsRepository {
  getSettings(): Promise<SystemSettings>;
  updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings>;
}
