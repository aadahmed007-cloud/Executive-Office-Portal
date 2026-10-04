import {
  IMeetingRepository,
  ICorrespondenceRepository,
  IDirectiveRepository,
  IMatterRepository,
  IContactRepository,
  INotificationRepository,
  IAuditRepository,
  IUserRepository,
  ISettingsRepository,
  UserContext,
  SecurityAuthorizationError
} from '../contracts';
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

/**
 * Helper to execute standard JSON requests against local backend API
 */
async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: any;
    userContext?: UserContext;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (options.userContext?.userId) {
    headers['X-User-Id'] = options.userContext.userId;
  }
  if (options.userContext?.role) {
    headers['X-User-Role'] = options.userContext.role;
  }
  if (options.userContext?.can_view_confidential !== undefined) {
    headers['X-Can-View-Confidential'] = String(options.userContext.can_view_confidential);
  }

  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let errorMsg = `API Request failed with status ${response.status}`;
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch {
      // ignore
    }
    if (response.status === 401 || response.status === 403) {
      throw new SecurityAuthorizationError(errorMsg);
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

// --- API Meeting Repository ---
export class ApiMeetingRepository implements IMeetingRepository {
  async getAll(filter?: { status?: string; matterId?: string; date?: string; search?: string }, userContext?: UserContext): Promise<Meeting[]> {
    const query = new URLSearchParams(filter as any).toString();
    return apiRequest<Meeting[]>(`/api/meetings${query ? `?${query}` : ''}`, { userContext });
  }

  async getById(id: string, userContext?: UserContext): Promise<Meeting | null> {
    return apiRequest<Meeting | null>(`/api/meetings/${id}`, { userContext });
  }

  async create(meeting: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Meeting> {
    return apiRequest<Meeting>('/api/meetings', { method: 'POST', body: meeting, userContext });
  }

  async update(id: string, meeting: Partial<Meeting>, userContext?: UserContext): Promise<Meeting> {
    return apiRequest<Meeting>(`/api/meetings/${id}`, { method: 'PATCH', body: meeting, userContext });
  }

  async softDelete(id: string, userContext?: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/meetings/${id}`, { method: 'DELETE', userContext });
  }

  async getAttendees(meetingId: string, userContext?: UserContext): Promise<MeetingAttendee[]> {
    return apiRequest<MeetingAttendee[]>(`/api/meetings/${meetingId}/attendees`, { userContext });
  }

  async setAttendees(meetingId: string, attendees: Omit<MeetingAttendee, 'id' | 'meeting_id'>[], userContext?: UserContext): Promise<void> {
    return apiRequest<void>(`/api/meetings/${meetingId}/attendees`, { method: 'PUT', body: attendees, userContext });
  }

  async getAgenda(meetingId: string, userContext?: UserContext): Promise<AgendaItem[]> {
    return apiRequest<AgendaItem[]>(`/api/meetings/${meetingId}/agenda`, { userContext });
  }

  async setAgenda(meetingId: string, items: Omit<AgendaItem, 'id' | 'meeting_id'>[], userContext?: UserContext): Promise<void> {
    return apiRequest<void>(`/api/meetings/${meetingId}/agenda`, { method: 'PUT', body: items, userContext });
  }

  async getMinutes(meetingId: string, userContext?: UserContext): Promise<MeetingMinutes | null> {
    return apiRequest<MeetingMinutes | null>(`/api/meetings/${meetingId}/minutes`, { userContext });
  }

  async saveMinutes(minutes: Omit<MeetingMinutes, 'id'>, userContext?: UserContext): Promise<MeetingMinutes> {
    return apiRequest<MeetingMinutes>(`/api/meetings/${minutes.meeting_id}/minutes`, { method: 'POST', body: minutes, userContext });
  }

  async getDecisions(meetingId: string, userContext?: UserContext): Promise<Decision[]> {
    return apiRequest<Decision[]>(`/api/meetings/${meetingId}/decisions`, { userContext });
  }

  async addDecision(decision: Omit<Decision, 'id'>, userContext?: UserContext): Promise<Decision> {
    return apiRequest<Decision>(`/api/meetings/${decision.meeting_id}/decisions`, { method: 'POST', body: decision, userContext });
  }
}

// --- API Correspondence Repository ---
export class ApiCorrespondenceRepository implements ICorrespondenceRepository {
  async getAll(
    filter?: { type?: 'incoming' | 'outgoing'; status?: string; matterId?: string; priority?: string; category?: string; tag?: string; search?: string },
    userContext?: UserContext
  ): Promise<Correspondence[]> {
    const query = new URLSearchParams(filter as any).toString();
    return apiRequest<Correspondence[]>(`/api/correspondence${query ? `?${query}` : ''}`, { userContext });
  }

  async getById(id: string, userContext?: UserContext): Promise<Correspondence | null> {
    return apiRequest<Correspondence | null>(`/api/correspondence/${id}`, { userContext });
  }

  async getBySerial(serial: string, userContext?: UserContext): Promise<Correspondence | null> {
    return apiRequest<Correspondence | null>(`/api/correspondence/serial/${encodeURIComponent(serial)}`, { userContext });
  }

  async create(item: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Correspondence> {
    return apiRequest<Correspondence>('/api/correspondence', { method: 'POST', body: item, userContext });
  }

  async update(id: string, item: Partial<Correspondence>, userContext?: UserContext): Promise<Correspondence> {
    return apiRequest<Correspondence>(`/api/correspondence/${id}`, { method: 'PATCH', body: item, userContext });
  }

  async softDelete(id: string, userContext?: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/correspondence/${id}`, { method: 'DELETE', userContext });
  }

  async getBriefingNote(correspondenceId: string, userContext?: UserContext): Promise<BriefingNote | null> {
    return apiRequest<BriefingNote | null>(`/api/correspondence/${correspondenceId}/briefing`, { userContext });
  }

  async saveBriefingNote(note: Omit<BriefingNote, 'id'>, userContext?: UserContext): Promise<BriefingNote> {
    return apiRequest<BriefingNote>(`/api/correspondence/${note.correspondence_id}/briefing`, { method: 'POST', body: note, userContext });
  }

  async getApproval(correspondenceId: string, userContext?: UserContext): Promise<Approval | null> {
    return apiRequest<Approval | null>(`/api/correspondence/${correspondenceId}/approval`, { userContext });
  }

  async recordApproval(approval: Omit<Approval, 'id'>, userContext?: UserContext): Promise<Approval> {
    return apiRequest<Approval>(`/api/correspondence/${approval.correspondence_id}/approval`, { method: 'POST', body: approval, userContext });
  }

  async getRoutings(correspondenceId: string, userContext?: UserContext): Promise<CorrespondenceRouting[]> {
    return apiRequest<CorrespondenceRouting[]>(`/api/correspondence/${correspondenceId}/routings`, { userContext });
  }

  async addRouting(routing: Omit<CorrespondenceRouting, 'id'>, userContext?: UserContext): Promise<CorrespondenceRouting> {
    return apiRequest<CorrespondenceRouting>(`/api/correspondence/${routing.correspondence_id}/routings`, { method: 'POST', body: routing, userContext });
  }

  async getAttachments(correspondenceId: string, userContext?: UserContext): Promise<Attachment[]> {
    return apiRequest<Attachment[]>(`/api/correspondence/${correspondenceId}/attachments`, { userContext });
  }

  async addAttachment(att: Omit<Attachment, 'id'>, userContext?: UserContext): Promise<Attachment> {
    return apiRequest<Attachment>(`/api/correspondence/${att.entity_id}/attachments`, { method: 'POST', body: att, userContext });
  }

  async getNextSerial(type: 'incoming' | 'outgoing', year?: number): Promise<string> {
    const res = await apiRequest<{ serial: string }>(`/api/correspondence/next-serial?type=${type}${year ? `&year=${year}` : ''}`);
    return res.serial;
  }
}

// --- API Directive Repository ---
export class ApiDirectiveRepository implements IDirectiveRepository {
  async getAll(filter?: { status?: string; assignedDepartment?: string; matterId?: string; search?: string }, userContext?: UserContext): Promise<Directive[]> {
    const query = new URLSearchParams(filter as any).toString();
    return apiRequest<Directive[]>(`/api/directives${query ? `?${query}` : ''}`, { userContext });
  }

  async getById(id: string, userContext?: UserContext): Promise<Directive | null> {
    return apiRequest<Directive | null>(`/api/directives/${id}`, { userContext });
  }

  async create(directive: Omit<Directive, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Directive> {
    return apiRequest<Directive>('/api/directives', { method: 'POST', body: directive, userContext });
  }

  async update(id: string, directive: Partial<Directive>, userContext?: UserContext): Promise<Directive> {
    return apiRequest<Directive>(`/api/directives/${id}`, { method: 'PATCH', body: directive, userContext });
  }

  async softDelete(id: string, userContext?: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/directives/${id}`, { method: 'DELETE', userContext });
  }

  async getUpdates(directiveId: string, userContext?: UserContext): Promise<DirectiveUpdate[]> {
    return apiRequest<DirectiveUpdate[]>(`/api/directives/${directiveId}/updates`, { userContext });
  }

  async addUpdate(update: Omit<DirectiveUpdate, 'id' | 'created_at'>, userContext?: UserContext): Promise<DirectiveUpdate> {
    return apiRequest<DirectiveUpdate>(`/api/directives/${update.directive_id}/updates`, { method: 'POST', body: update, userContext });
  }

  async getNextCode(year?: number): Promise<string> {
    const res = await apiRequest<{ code: string }>(`/api/directives/next-code${year ? `?year=${year}` : ''}`);
    return res.code;
  }
}

// --- API Matter Repository ---
export class ApiMatterRepository implements IMatterRepository {
  async getAll(filter?: { status?: string; search?: string }, userContext?: UserContext): Promise<Matter[]> {
    const query = new URLSearchParams(filter as any).toString();
    return apiRequest<Matter[]>(`/api/matters${query ? `?${query}` : ''}`, { userContext });
  }

  async getById(id: string, userContext?: UserContext): Promise<Matter | null> {
    return apiRequest<Matter | null>(`/api/matters/${id}`, { userContext });
  }

  async create(matter: Omit<Matter, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Matter> {
    return apiRequest<Matter>('/api/matters', { method: 'POST', body: matter, userContext });
  }

  async update(id: string, matter: Partial<Matter>, userContext?: UserContext): Promise<Matter> {
    return apiRequest<Matter>(`/api/matters/${id}`, { method: 'PATCH', body: matter, userContext });
  }

  async softDelete(id: string, userContext?: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/matters/${id}`, { method: 'DELETE', userContext });
  }

  async getLinks(matterId: string, userContext?: UserContext): Promise<MatterLink[]> {
    return apiRequest<MatterLink[]>(`/api/matters/${matterId}/links`, { userContext });
  }

  async addLink(link: Omit<MatterLink, 'id' | 'created_at'>, userContext?: UserContext): Promise<MatterLink> {
    return apiRequest<MatterLink>(`/api/matters/${link.matter_id}/links`, { method: 'POST', body: link, userContext });
  }

  async removeLink(linkId: string, userContext?: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/matters/links/${linkId}`, { method: 'DELETE', userContext });
  }
}

// --- API Contact Repository ---
export class ApiContactRepository implements IContactRepository {
  async getAll(): Promise<Contact[]> {
    return apiRequest<Contact[]>('/api/contacts');
  }

  async getById(id: string): Promise<Contact | null> {
    return apiRequest<Contact | null>(`/api/contacts/${id}`);
  }

  async create(contact: Omit<Contact, 'id' | 'created_at'>, userContext?: UserContext): Promise<Contact> {
    return apiRequest<Contact>('/api/contacts', { method: 'POST', body: contact, userContext });
  }

  async update(id: string, contact: Partial<Contact>, userContext?: UserContext): Promise<Contact> {
    return apiRequest<Contact>(`/api/contacts/${id}`, { method: 'PATCH', body: contact, userContext });
  }

  async softDelete(id: string, userContext?: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/contacts/${id}`, { method: 'DELETE', userContext });
  }

  async getInteractions(contactId: string): Promise<Interaction[]> {
    return apiRequest<Interaction[]>(`/api/contacts/${contactId}/interactions`);
  }

  async addInteraction(interaction: Omit<Interaction, 'id'>, userContext?: UserContext): Promise<Interaction> {
    return apiRequest<Interaction>(`/api/contacts/${interaction.contact_id}/interactions`, { method: 'POST', body: interaction, userContext });
  }
}

// --- API Notification Repository ---
export class ApiNotificationRepository implements INotificationRepository {
  async getAllForRole(role: RoleType, userContext?: UserContext): Promise<Notification[]> {
    return apiRequest<Notification[]>(`/api/notifications?role=${role}`, { userContext });
  }

  async create(notification: Omit<Notification, 'id' | 'created_at'>, userContext?: UserContext): Promise<Notification> {
    return apiRequest<Notification>('/api/notifications', { method: 'POST', body: notification, userContext });
  }

  async markAsRead(id: string, userContext?: UserContext): Promise<void> {
    return apiRequest<void>(`/api/notifications/${id}/read`, { method: 'PATCH', userContext });
  }

  async markAllAsRead(role: RoleType, userContext?: UserContext): Promise<void> {
    return apiRequest<void>(`/api/notifications/read-all`, { method: 'POST', body: { role }, userContext });
  }
}

// --- API Audit Repository ---
export class ApiAuditRepository implements IAuditRepository {
  async getAll(filter?: { entityType?: string; userId?: string; limit?: number }): Promise<AuditLogEntry[]> {
    const query = new URLSearchParams(filter as any).toString();
    return apiRequest<AuditLogEntry[]>(`/api/audit${query ? `?${query}` : ''}`);
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    return apiRequest<void>('/api/audit', { method: 'POST', body: entry });
  }
}

// --- API User Repository ---
export class ApiUserRepository implements IUserRepository {
  async getAll(): Promise<User[]> {
    return apiRequest<User[]>('/api/users');
  }

  async getById(id: string): Promise<User | null> {
    return apiRequest<User | null>(`/api/users/${id}`);
  }

  async getByUsername(username: string): Promise<(User & { password_hash: string; password_salt: string }) | null> {
    return apiRequest<(User & { password_hash: string; password_salt: string }) | null>(`/api/users/username/${encodeURIComponent(username)}`);
  }

  async getByRole(role: RoleType): Promise<User[]> {
    return apiRequest<User[]>(`/api/users/role/${role}`);
  }

  async updatePassword(userId: string, hash: string, salt: string): Promise<void> {
    return apiRequest<void>(`/api/users/${userId}/password`, { method: 'PATCH', body: { hash, salt } });
  }
}

// --- API Settings Repository ---
export class ApiSettingsRepository implements ISettingsRepository {
  async getSettings(): Promise<SystemSettings> {
    return apiRequest<SystemSettings>('/api/settings');
  }

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    return apiRequest<SystemSettings>('/api/settings', { method: 'PATCH', body: settings });
  }
}
