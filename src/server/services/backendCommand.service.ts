import {
  meetingRepo,
  correspondenceRepo,
  directiveRepo,
  matterRepo,
  contactRepo,
  notificationRepo,
  auditRepo,
  settingsRepo,
  UserContext
} from '../repositories/index.js';
import {
  Meeting,
  Correspondence,
  Directive,
  BriefingNote,
  Approval,
  CorrespondenceRouting,
  DirectiveUpdate,
  Matter,
  Contact,
  Notification,
  User
} from '../../domain/types/index.js';
import { AuditLogger } from '../../domain/security/auditLogger.js';

/**
 * Backend Command & Orchestration Service.
 * Centralizes transactional integrity, audit log recording, and notifications on the server.
 */
export class BackendCommandService {
  // Meetings
  static async createMeeting(data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Meeting> {
    const created = await meetingRepo.create(data, userContext);
    await auditRepo.log({
      user_id: userContext?.userId || 'server',
      user_name: data.created_by || 'النظام',
      user_role: userContext?.role || 'SECRETARY',
      action_type: 'CREATE',
      entity_type: 'MEETING',
      entity_id: created.id,
      before_value: null,
      after_value: `جدولة اجتماع جديد: ${created.title} في ${created.location}`,
      ip_address: '127.0.0.1 (Local Server)'
    });
    return created;
  }

  // Correspondence
  static async createCorrespondence(data: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Correspondence> {
    const created = await correspondenceRepo.create(data, userContext);
    await auditRepo.log({
      user_id: userContext?.userId || 'server',
      user_name: data.created_by || 'النظام',
      user_role: userContext?.role || 'SECRETARY',
      action_type: 'CREATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: created.id,
      before_value: null,
      after_value: `تسجيل مكاتبة جديدة: [${created.serial_number}] ${created.subject}`,
      ip_address: '127.0.0.1 (Local Server)'
    });
    return created;
  }

  // Directives
  static async createDirective(data: Omit<Directive, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Directive> {
    const created = await directiveRepo.create(data, userContext);
    const mockUser: User = {
      id: userContext?.userId || 'usr-system',
      username: 'system',
      name: data.created_by || 'مكتب رئيس مجلس الإدارة',
      title: 'السكرتارية التنفيذية',
      role: userContext?.role || 'SECRETARY',
      department_id: 'dept-sec',
      can_view_confidential: userContext?.can_view_confidential ?? true,
      email: 'system@egyptpost.org',
      created_at: new Date().toISOString()
    };
    await AuditLogger.logDirectiveCreation(mockUser, created);
    return created;
  }
}
