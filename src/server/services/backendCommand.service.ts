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
    const ctx = userContext || { userId: 'server', role: 'SECRETARY' as const, can_view_confidential: false };
    const created = await meetingRepo.create(data, ctx);
    await auditRepo.log({
      user_id: ctx.userId,
      user_name: data.created_by || 'النظام',
      user_role: ctx.role,
      action_type: 'CREATE',
      entity_type: 'MEETING',
      entity_id: created.id,
      before_value: null,
      after_value: `جدولة اجتماع جديد: ${created.title} في ${created.location}`,
      ip_address: '127.0.0.1'
    }, ctx);
    return created;
  }

  // Correspondence
  static async createCorrespondence(data: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Correspondence> {
    const ctx = userContext || { userId: 'server', role: 'SECRETARY' as const, can_view_confidential: false };
    const created = await correspondenceRepo.create(data, ctx);
    await auditRepo.log({
      user_id: ctx.userId,
      user_name: data.created_by || 'النظام',
      user_role: ctx.role,
      action_type: 'CREATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: created.id,
      before_value: null,
      after_value: `تسجيل مكاتبة جديدة: [${created.serial_number}] ${created.subject}`,
      ip_address: '127.0.0.1'
    }, ctx);
    return created;
  }

  // Directives
  static async createDirective(data: Omit<Directive, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Directive> {
    const ctx = userContext || { userId: 'server', role: 'SECRETARY' as const, can_view_confidential: false };
    const created = await directiveRepo.create(data, ctx);
    const mockUser: User = {
      id: ctx.userId,
      username: 'system',
      name: data.created_by || 'مكتب رئيس مجلس الإدارة',
      title: 'السكرتارية التنفيذية',
      role: ctx.role,
      department_id: 'dept-sec',
      can_view_confidential: ctx.can_view_confidential,
      email: 'system@egyptpost.org',
      created_at: new Date().toISOString()
    };
    await AuditLogger.logDirectiveCreation(mockUser, created);
    return created;
  }
}
