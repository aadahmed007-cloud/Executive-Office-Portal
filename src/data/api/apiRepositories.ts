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
  SecurityAuthorizationError,
  MeetingFilter,
  CorrespondenceFilter,
  DirectiveFilter,
  MatterFilter,
  AuditFilter
} from '../contracts/index.js';
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

/**
 * Universal Client API fetcher wrapper.
 */
async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: any;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method || 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new Error('فشل الاتصال بالخادم: تعذر الوصول إلى الشبكة أو انقطع الاتصال (Network Error)');
  }

  const parsed = await parseApiResponse<T>(response);

  if (!parsed.ok) {
    if (parsed.status === 401 || parsed.status === 403) {
      throw new SecurityAuthorizationError(`${parsed.error} [${parsed.technicalDetails}]`);
    }
    throw new Error(`${parsed.error} [${parsed.technicalDetails}]`);
  }

  return parsed.data as T;
}

async function parseApiResponse<T>(response: Response): Promise<{ ok: boolean; status: number; data?: T; error?: string; technicalDetails?: string }> {
  const status = response.status;
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const htmlText = await response.text();
    return {
      ok: false,
      status,
      error: 'استجابة غير صالحة من الخادم (Invalid server response format)',
      technicalDetails: htmlText.substring(0, 100)
    };
  }

  try {
    const body = await response.json();
    if (response.ok) {
      return { ok: true, status, data: body as T };
    } else {
      return {
        ok: false,
        status,
        error: body.error || 'حدث خطأ غير معروف في المعالجة',
        technicalDetails: `HTTP ${status}`
      };
    }
  } catch {
    return {
      ok: false,
      status,
      error: 'فشل تحليل الاستجابة بصيغة JSON',
      technicalDetails: `HTTP ${status}`
    };
  }
}

// --- API Meeting Repository ---
export class ApiMeetingRepository implements IMeetingRepository {
  async getAll(filter: MeetingFilter | undefined, ctx: UserContext): Promise<Meeting[]> {
    const query = new URLSearchParams((filter || {}) as any).toString();
    return apiRequest<Meeting[]>(`/api/meetings${query ? `?${query}` : ''}`);
  }

  async getById(id: string, ctx: UserContext): Promise<Meeting | null> {
    return apiRequest<Meeting | null>(`/api/meetings/${id}`);
  }

  async create(meeting: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Meeting> {
    return apiRequest<Meeting>('/api/meetings', { method: 'POST', body: meeting });
  }

  async update(id: string, meeting: Partial<Meeting>, ctx: UserContext): Promise<Meeting> {
    return apiRequest<Meeting>(`/api/meetings/${id}`, { method: 'PATCH', body: meeting });
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/meetings/${id}`, { method: 'DELETE' });
  }

  async getAttendees(meetingId: string, ctx: UserContext): Promise<MeetingAttendee[]> {
    return apiRequest<MeetingAttendee[]>(`/api/meetings/${meetingId}/attendees`);
  }

  async setAttendees(meetingId: string, attendees: Omit<MeetingAttendee, 'id' | 'meeting_id'>[], ctx: UserContext): Promise<void> {
    return apiRequest<void>(`/api/meetings/${meetingId}/attendees`, { method: 'PUT', body: attendees });
  }

  async getAgenda(meetingId: string, ctx: UserContext): Promise<AgendaItem[]> {
    return apiRequest<AgendaItem[]>(`/api/meetings/${meetingId}/agenda`);
  }

  async setAgenda(meetingId: string, items: Omit<AgendaItem, 'id' | 'meeting_id'>[], ctx: UserContext): Promise<void> {
    return apiRequest<void>(`/api/meetings/${meetingId}/agenda`, { method: 'PUT', body: items });
  }

  async getMinutes(meetingId: string, ctx: UserContext): Promise<MeetingMinutes | null> {
    return apiRequest<MeetingMinutes | null>(`/api/meetings/${meetingId}/minutes`);
  }

  async saveMinutes(minutes: Omit<MeetingMinutes, 'id'>, ctx: UserContext): Promise<MeetingMinutes> {
    return apiRequest<MeetingMinutes>(`/api/meetings/${minutes.meeting_id}/minutes`, { method: 'POST', body: minutes });
  }

  async getDecisions(meetingId: string, ctx: UserContext): Promise<Decision[]> {
    return apiRequest<Decision[]>(`/api/meetings/${meetingId}/decisions`);
  }

  async addDecision(decision: Omit<Decision, 'id'>, ctx: UserContext): Promise<Decision> {
    return apiRequest<Decision>(`/api/meetings/${decision.meeting_id}/decisions`, { method: 'POST', body: decision });
  }
}

// --- API Correspondence Repository ---
export class ApiCorrespondenceRepository implements ICorrespondenceRepository {
  async getAll(filter: CorrespondenceFilter | undefined, ctx: UserContext): Promise<Correspondence[]> {
    const query = new URLSearchParams((filter || {}) as any).toString();
    return apiRequest<Correspondence[]>(`/api/correspondence${query ? `?${query}` : ''}`);
  }

  async getById(id: string, ctx: UserContext): Promise<Correspondence | null> {
    return apiRequest<Correspondence | null>(`/api/correspondence/${id}`);
  }

  async getBySerial(serial: string, ctx: UserContext): Promise<Correspondence | null> {
    return apiRequest<Correspondence | null>(`/api/correspondence/serial/${encodeURIComponent(serial)}`);
  }

  async create(item: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Correspondence> {
    return apiRequest<Correspondence>('/api/correspondence', { method: 'POST', body: item });
  }

  async update(id: string, item: Partial<Correspondence>, ctx: UserContext): Promise<Correspondence> {
    return apiRequest<Correspondence>(`/api/correspondence/${id}`, { method: 'PATCH', body: item });
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/correspondence/${id}`, { method: 'DELETE' });
  }

  async getBriefingNote(correspondenceId: string, ctx: UserContext): Promise<BriefingNote | null> {
    return apiRequest<BriefingNote | null>(`/api/correspondence/${correspondenceId}/briefing`);
  }

  async saveBriefingNote(note: Omit<BriefingNote, 'id'>, ctx: UserContext): Promise<BriefingNote> {
    return apiRequest<BriefingNote>(`/api/correspondence/${note.correspondence_id}/briefing`, { method: 'POST', body: note });
  }

  async getApproval(correspondenceId: string, ctx: UserContext): Promise<Approval | null> {
    return apiRequest<Approval | null>(`/api/correspondence/${correspondenceId}/approval`);
  }

  async recordApproval(approval: Omit<Approval, 'id'>, ctx: UserContext): Promise<Approval> {
    return apiRequest<Approval>(`/api/correspondence/${approval.correspondence_id}/approval`, { method: 'POST', body: approval });
  }

  async getRoutings(correspondenceId: string, ctx: UserContext): Promise<CorrespondenceRouting[]> {
    return apiRequest<CorrespondenceRouting[]>(`/api/correspondence/${correspondenceId}/routings`);
  }

  async addRouting(routing: Omit<CorrespondenceRouting, 'id'>, ctx: UserContext): Promise<CorrespondenceRouting> {
    return apiRequest<CorrespondenceRouting>(`/api/correspondence/${routing.correspondence_id}/routings`, { method: 'POST', body: routing });
  }

  async getAttachments(correspondenceId: string, ctx: UserContext): Promise<Attachment[]> {
    return apiRequest<Attachment[]>(`/api/correspondence/${correspondenceId}/attachments`);
  }

  async addAttachment(att: Omit<Attachment, 'id'>, ctx: UserContext): Promise<Attachment> {
    return apiRequest<Attachment>(`/api/correspondence/${att.entity_id}/attachments`, { method: 'POST', body: att });
  }

  async getNextSerial(type: 'incoming' | 'outgoing', year?: number): Promise<string> {
    const res = await apiRequest<{ serial: string }>(`/api/correspondence/next-serial?type=${type}${year ? `&year=${year}` : ''}`);
    return res.serial;
  }
}

// --- API Directive Repository ---
export class ApiDirectiveRepository implements IDirectiveRepository {
  async getAll(filter: DirectiveFilter | undefined, ctx: UserContext): Promise<Directive[]> {
    const query = new URLSearchParams((filter || {}) as any).toString();
    return apiRequest<Directive[]>(`/api/directives${query ? `?${query}` : ''}`);
  }

  async getById(id: string, ctx: UserContext): Promise<Directive | null> {
    return apiRequest<Directive | null>(`/api/directives/${id}`);
  }

  async create(directive: Omit<Directive, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Directive> {
    return apiRequest<Directive>('/api/directives', { method: 'POST', body: directive });
  }

  async update(id: string, directive: Partial<Directive>, ctx: UserContext): Promise<Directive> {
    return apiRequest<Directive>(`/api/directives/${id}`, { method: 'PATCH', body: directive });
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/directives/${id}`, { method: 'DELETE' });
  }

  async getUpdates(directiveId: string, ctx: UserContext): Promise<DirectiveUpdate[]> {
    return apiRequest<DirectiveUpdate[]>(`/api/directives/${directiveId}/updates`);
  }

  async addUpdate(update: Omit<DirectiveUpdate, 'id' | 'created_at'>, ctx: UserContext): Promise<DirectiveUpdate> {
    return apiRequest<DirectiveUpdate>(`/api/directives/${update.directive_id}/updates`, { method: 'POST', body: update });
  }

  async getNextCode(year?: number): Promise<string> {
    const res = await apiRequest<{ code: string }>(`/api/directives/next-code${year ? `?year=${year}` : ''}`);
    return res.code;
  }
}

// --- API Matter Repository ---
export class ApiMatterRepository implements IMatterRepository {
  async getAll(filter: MatterFilter | undefined, ctx: UserContext): Promise<Matter[]> {
    const query = new URLSearchParams((filter || {}) as any).toString();
    return apiRequest<Matter[]>(`/api/matters${query ? `?${query}` : ''}`);
  }

  async getById(id: string, ctx: UserContext): Promise<Matter | null> {
    return apiRequest<Matter | null>(`/api/matters/${id}`);
  }

  async create(matter: Omit<Matter, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Matter> {
    return apiRequest<Matter>('/api/matters', { method: 'POST', body: matter });
  }

  async update(id: string, matter: Partial<Matter>, ctx: UserContext): Promise<Matter> {
    return apiRequest<Matter>(`/api/matters/${id}`, { method: 'PATCH', body: matter });
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/matters/${id}`, { method: 'DELETE' });
  }

  async getLinks(matterId: string, ctx: UserContext): Promise<MatterLink[]> {
    return apiRequest<MatterLink[]>(`/api/matters/${matterId}/links`);
  }

  async addLink(link: Omit<MatterLink, 'id' | 'created_at'>, ctx: UserContext): Promise<MatterLink> {
    return apiRequest<MatterLink>(`/api/matters/${link.matter_id}/links`, { method: 'POST', body: link });
  }

  async removeLink(linkId: string, ctx: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/matters/links/${linkId}`, { method: 'DELETE' });
  }
}

// --- API Contact Repository ---
export class ApiContactRepository implements IContactRepository {
  async getAll(ctx: UserContext): Promise<Contact[]> {
    return apiRequest<Contact[]>('/api/contacts');
  }

  async getById(id: string, ctx: UserContext): Promise<Contact | null> {
    return apiRequest<Contact | null>(`/api/contacts/${id}`);
  }

  async create(contact: Omit<Contact, 'id' | 'created_at'>, ctx: UserContext): Promise<Contact> {
    return apiRequest<Contact>('/api/contacts', { method: 'POST', body: contact });
  }

  async update(id: string, contact: Partial<Contact>, ctx: UserContext): Promise<Contact> {
    return apiRequest<Contact>(`/api/contacts/${id}`, { method: 'PATCH', body: contact });
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    return apiRequest<boolean>(`/api/contacts/${id}`, { method: 'DELETE' });
  }

  async getInteractions(contactId: string, ctx: UserContext): Promise<Interaction[]> {
    return apiRequest<Interaction[]>(`/api/contacts/${contactId}/interactions`);
  }

  async addInteraction(interaction: Omit<Interaction, 'id'>, ctx: UserContext): Promise<Interaction> {
    return apiRequest<Interaction>(`/api/contacts/${interaction.contact_id}/interactions`, { method: 'POST', body: interaction });
  }
}

// --- API Notification Repository ---
export class ApiNotificationRepository implements INotificationRepository {
  async getAllForRole(role: RoleType, ctx: UserContext): Promise<Notification[]> {
    return apiRequest<Notification[]>(`/api/notifications?role=${role}`);
  }

  async create(notification: Omit<Notification, 'id' | 'created_at'>, ctx: UserContext): Promise<Notification> {
    return apiRequest<Notification>('/api/notifications', { method: 'POST', body: notification });
  }

  async markAsRead(id: string, ctx: UserContext): Promise<void> {
    return apiRequest<void>(`/api/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllAsRead(role: RoleType, ctx: UserContext): Promise<void> {
    return apiRequest<void>(`/api/notifications/read-all`, { method: 'POST', body: { role } });
  }
}

// --- API Audit Repository ---
export class ApiAuditRepository implements IAuditRepository {
  async getAll(filter: AuditFilter | undefined, ctx: UserContext): Promise<AuditLogEntry[]> {
    const query = new URLSearchParams((filter || {}) as any).toString();
    return apiRequest<AuditLogEntry[]>(`/api/audit${query ? `?${query}` : ''}`);
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>, ctx: UserContext): Promise<void> {
    return apiRequest<void>('/api/audit', { method: 'POST', body: entry });
  }
}

// --- API User Repository ---
export class ApiUserRepository implements IUserRepository {
  async getAll(ctx: UserContext): Promise<User[]> {
    return apiRequest<User[]>('/api/users');
  }

  async getById(id: string, ctx: UserContext): Promise<User | null> {
    return apiRequest<User | null>(`/api/users/${id}`);
  }

  async getByUsername(username: string): Promise<(User & { password_hash: string; password_salt: string }) | null> {
    return apiRequest<(User & { password_hash: string; password_salt: string }) | null>(`/api/users/username/${encodeURIComponent(username)}`);
  }

  async getByRole(role: RoleType, ctx: UserContext): Promise<User[]> {
    return apiRequest<User[]>(`/api/users/role/${role}`);
  }

  async updatePassword(userId: string, hash: string, salt: string, ctx: UserContext): Promise<void> {
    return apiRequest<void>(`/api/users/${userId}/password`, { method: 'PATCH', body: { hash, salt } });
  }
}

// --- API Settings Repository ---
export class ApiSettingsRepository implements ISettingsRepository {
  async getSettings(ctx: UserContext): Promise<SystemSettings> {
    return apiRequest<SystemSettings>('/api/settings');
  }

  async updateSettings(settings: Partial<SystemSettings>, ctx: UserContext): Promise<SystemSettings> {
    return apiRequest<SystemSettings>('/api/settings', { method: 'PATCH', body: settings });
  }
}

// Export singleton API instances for client consumption
export const meetingRepo = new ApiMeetingRepository();
export const correspondenceRepo = new ApiCorrespondenceRepository();
export const directiveRepo = new ApiDirectiveRepository();
export const matterRepo = new ApiMatterRepository();
export const contactRepo = new ApiContactRepository();
export const notificationRepo = new ApiNotificationRepository();
export const auditRepo = new ApiAuditRepository();
export const userRepo = new ApiUserRepository();
export const settingsRepo = new ApiSettingsRepository();
