import {
  correspondenceRepo,
  meetingRepo,
  directiveRepo,
  matterRepo,
  contactRepo,
  notificationRepo,
  auditRepo
} from '../../data/sqlite/repositories';
import {
  User,
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
  RoleType
} from '../types';
import { SecurityAuthorizationError, UserContext } from '../../data/contracts';
import { detectMeetingConflict } from '../rules/conflictDetector';

function toUserContext(user: User): UserContext {
  return {
    userId: user.id,
    role: user.role,
    can_view_confidential: Boolean(user.can_view_confidential)
  };
}

function assertAuthenticated(user?: User): asserts user is User {
  if (!user || !user.id || user.id === 'guest') {
    throw new SecurityAuthorizationError('عملية مرفوضة: يجب تسجيل الدخول وتوثيق هوية المستخدم أولاً');
  }
}

/**
 * CommandService: Centralized Use-Case and Business Mutation Layer.
 * Enforces:
 * 1. Actor authentication & context validation
 * 2. Role-based authorization & clearance rules
 * 3. Domain business logic & validation
 * 4. Repository mutation execution
 * 5. Automatic, tamper-evident cryptographic audit logging
 */
export class CommandService {
  // ==========================================
  // CORRESPONDENCE COMMANDS
  // ==========================================

  static async createCorrespondence(
    data: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Correspondence> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const created = await correspondenceRepo.create(data, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'CREATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: created.id,
      before_value: null,
      after_value: JSON.stringify({
        serial: created.serial_number,
        type: created.type,
        subject: created.subject,
        confidentiality: created.confidentiality
      }),
      ip_address: ip
    });

    return created;
  }

  static async updateCorrespondence(
    id: string,
    changes: Partial<Correspondence>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Correspondence> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const before = await correspondenceRepo.getById(id, ctx);
    if (!before) {
      throw new SecurityAuthorizationError('المعاملة غير موجودة أو غير مصرح لك بتعديلها');
    }

    const updated = await correspondenceRepo.update(id, changes, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: id,
      before_value: JSON.stringify({ status: before.status, priority: before.priority, subject: before.subject }),
      after_value: JSON.stringify({ status: updated.status, priority: updated.priority, subject: updated.subject }),
      ip_address: ip
    });

    return updated;
  }

  static async softDeleteCorrespondence(
    id: string,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<boolean> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const before = await correspondenceRepo.getById(id, ctx);
    if (!before) {
      throw new SecurityAuthorizationError('المعاملة غير موجودة أو غير مصرح لك بأرشفتها');
    }

    const success = await correspondenceRepo.softDelete(id, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'DELETE',
      entity_type: 'CORRESPONDENCE',
      entity_id: id,
      before_value: `رقم المعاملة: ${before.serial_number}`,
      after_value: 'تم النقل للأرشيف/الحذف المنطقي',
      ip_address: ip
    });

    return success;
  }

  static async saveBriefingNote(
    note: Omit<BriefingNote, 'id'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<BriefingNote> {
    assertAuthenticated(actor);
    if (actor.role !== 'SECRETARY' && actor.role !== 'CHAIRMAN') {
      throw new SecurityAuthorizationError('إعداد مذكرات العرض مقصور على السكرتارية التنفيذية ورئيس مجلس الإدارة');
    }
    const ctx = toUserContext(actor);

    const saved = await correspondenceRepo.saveBriefingNote(note, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'BRIEFING_NOTE',
      entity_id: saved.id,
      before_value: null,
      after_value: `مذكرة عرض للمعاملة ${note.correspondence_id} بواسطة ${actor.name}`,
      ip_address: ip
    });

    return saved;
  }

  static async recordApproval(
    approval: Omit<Approval, 'id'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Approval> {
    assertAuthenticated(actor);
    if (actor.role !== 'CHAIRMAN') {
      throw new SecurityAuthorizationError('تأشيرة الاعتماد الرئاسية مقصورة حصرياً على السيد رئيس مجلس الإدارة (Chairman Only)');
    }
    const ctx = toUserContext(actor);

    const recorded = await correspondenceRepo.recordApproval(approval, ctx);

    // Also update parent correspondence status to 'approved'
    await correspondenceRepo.update(approval.correspondence_id, { status: 'approved' }, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'DECIDE',
      entity_type: 'APPROVAL',
      entity_id: recorded.id,
      before_value: 'قيد العرض والمراجعة',
      after_value: `تأشيرة رئاسية معتمدة: ${approval.decision_type} - ${approval.standard_phrase}`,
      ip_address: ip
    });

    return recorded;
  }

  static async addRouting(
    routing: Omit<CorrespondenceRouting, 'id'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<CorrespondenceRouting> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const added = await correspondenceRepo.addRouting(routing, ctx);

    // Update correspondence status to 'under_review'
    await correspondenceRepo.update(routing.correspondence_id, { status: 'under_review' }, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'ROUTING',
      entity_type: 'CORRESPONDENCE_ROUTING',
      entity_id: added.id,
      before_value: null,
      after_value: `إحالة إلى: ${routing.to_department_name} - الإجراء المطلوب: ${routing.action_required}`,
      ip_address: ip
    });

    return added;
  }

  static async addAttachment(
    att: Omit<Attachment, 'id'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Attachment> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const added = await correspondenceRepo.addAttachment(att, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'CREATE',
      entity_type: 'ATTACHMENT',
      entity_id: added.id,
      before_value: null,
      after_value: `ملف: ${att.file_name} (${att.file_size_kb}KB) - سرية: ${att.confidentiality}`,
      ip_address: ip
    });

    return added;
  }

  // ==========================================
  // MEETING COMMANDS
  // ==========================================

  static async createMeeting(
    data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<{ meeting: Meeting; conflictDetected: boolean }> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    // Check conflict
    const allMeetings = await meetingRepo.getAll(undefined, { can_view_confidential: true });
    const conflictResult = detectMeetingConflict(
      { location: data.location, start_time: data.start_time, end_time: data.end_time },
      allMeetings
    );
    const isConflicted = conflictResult.hasConflict;

    const created = await meetingRepo.create(data, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'CREATE',
      entity_type: 'MEETING',
      entity_id: created.id,
      before_value: null,
      after_value: JSON.stringify({
        title: created.title,
        start_time: created.start_time,
        end_time: created.end_time,
        confidentiality: created.confidentiality,
        conflictDetected: isConflicted
      }),
      ip_address: ip
    });

    return { meeting: created, conflictDetected: isConflicted };
  }

  static async updateMeeting(
    id: string,
    changes: Partial<Meeting>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Meeting> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const before = await meetingRepo.getById(id, ctx);
    if (!before) {
      throw new SecurityAuthorizationError('الاجتماع غير موجود أو غير مصرح لك بتعديله');
    }

    const updated = await meetingRepo.update(id, changes, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'MEETING',
      entity_id: id,
      before_value: JSON.stringify({ title: before.title, status: before.status, start_time: before.start_time }),
      after_value: JSON.stringify({ title: updated.title, status: updated.status, start_time: updated.start_time }),
      ip_address: ip
    });

    return updated;
  }

  static async softDeleteMeeting(
    id: string,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<boolean> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const before = await meetingRepo.getById(id, ctx);
    if (!before) {
      throw new SecurityAuthorizationError('الاجتماع غير موجود أو غير مصرح لك بحذفه');
    }

    const success = await meetingRepo.softDelete(id, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'DELETE',
      entity_type: 'MEETING',
      entity_id: id,
      before_value: `اجتماع: ${before.title}`,
      after_value: 'تم الإلغاء/الحذف المنطقي',
      ip_address: ip
    });

    return success;
  }

  static async setAttendees(
    meetingId: string,
    attendees: Omit<MeetingAttendee, 'id' | 'meeting_id'>[],
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<void> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    await meetingRepo.setAttendees(meetingId, attendees, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'MEETING',
      entity_id: meetingId,
      before_value: null,
      after_value: `تحديث قائمة الحضور: ${attendees.length} مشارك`,
      ip_address: ip
    });
  }

  static async setAgenda(
    meetingId: string,
    items: Omit<AgendaItem, 'id' | 'meeting_id'>[],
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<void> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    await meetingRepo.setAgenda(meetingId, items, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'MEETING',
      entity_id: meetingId,
      before_value: null,
      after_value: `تحديث جدول الأعمال: ${items.length} بند`,
      ip_address: ip
    });
  }

  static async saveMinutes(
    minutes: Omit<MeetingMinutes, 'id'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<MeetingMinutes> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const saved = await meetingRepo.saveMinutes(minutes, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'MEETING_MINUTES',
      entity_id: saved.id,
      before_value: null,
      after_value: `محضر اجتماع: ${minutes.status} بواسطة ${actor.name}`,
      ip_address: ip
    });

    return saved;
  }

  static async addDecision(
    decision: Omit<Decision, 'id'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Decision> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const added = await meetingRepo.addDecision(decision, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'DECIDE',
      entity_type: 'MEETING_DECISION',
      entity_id: added.id,
      before_value: null,
      after_value: `قرار اجتماع: ${decision.content} المكلف: ${decision.assigned_to_name}`,
      ip_address: ip
    });

    return added;
  }

  // ==========================================
  // DIRECTIVES COMMANDS
  // ==========================================

  static async createDirective(
    data: Omit<Directive, 'id' | 'created_at' | 'updated_at'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Directive> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const created = await directiveRepo.create(data, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'CREATE',
      entity_type: 'DIRECTIVE',
      entity_id: created.id,
      before_value: null,
      after_value: JSON.stringify({
        code: created.code,
        title: created.title,
        assigned_department: created.assigned_department,
        due_date: created.due_date,
        confidentiality: created.confidentiality
      }),
      ip_address: ip
    });

    return created;
  }

  static async updateDirective(
    id: string,
    changes: Partial<Directive>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Directive> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const before = await directiveRepo.getById(id, ctx);
    if (!before) {
      throw new SecurityAuthorizationError('التكليف غير موجود أو غير مصرح لك بتعديله');
    }

    const updated = await directiveRepo.update(id, changes, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'DIRECTIVE',
      entity_id: id,
      before_value: JSON.stringify({ status: before.status, progress: before.progress_percent }),
      after_value: JSON.stringify({ status: updated.status, progress: updated.progress_percent }),
      ip_address: ip
    });

    return updated;
  }

  static async softDeleteDirective(
    id: string,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<boolean> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const before = await directiveRepo.getById(id, ctx);
    if (!before) {
      throw new SecurityAuthorizationError('التكليف غير موجود أو غير مصرح لك بحذفه');
    }

    const success = await directiveRepo.softDelete(id, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'DELETE',
      entity_type: 'DIRECTIVE',
      entity_id: id,
      before_value: `تكليف: ${before.code} - ${before.title}`,
      after_value: 'تم الحفظ في الأرشيف/الحذف المنطقي',
      ip_address: ip
    });

    return success;
  }

  static async addDirectiveUpdate(
    update: Omit<DirectiveUpdate, 'id' | 'created_at'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<DirectiveUpdate> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const added = await directiveRepo.addUpdate(update, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'DIRECTIVE_UPDATE',
      entity_id: added.id,
      before_value: null,
      after_value: `متابعة إنجاز: ${update.progress_percent}% - ملاحظات: ${update.notes}`,
      ip_address: ip
    });

    return added;
  }

  // ==========================================
  // MATTERS (STRATEGIC ISSUES) COMMANDS
  // ==========================================

  static async createMatter(
    data: Omit<Matter, 'id' | 'created_at' | 'updated_at'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Matter> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const created = await matterRepo.create(data, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'CREATE',
      entity_type: 'MATTER',
      entity_id: created.id,
      before_value: null,
      after_value: JSON.stringify({
        code: created.code,
        title: created.title,
        lead_entity: created.lead_entity,
        confidentiality: created.confidentiality
      }),
      ip_address: ip
    });

    return created;
  }

  static async updateMatter(
    id: string,
    changes: Partial<Matter>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Matter> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const before = await matterRepo.getById(id, ctx);
    if (!before) {
      throw new SecurityAuthorizationError('الملف الاستراتيجي غير موجود أو غير مصرح لك بتعديله');
    }

    const updated = await matterRepo.update(id, changes, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'MATTER',
      entity_id: id,
      before_value: JSON.stringify({ status: before.status, priority: before.priority }),
      after_value: JSON.stringify({ status: updated.status, priority: updated.priority }),
      ip_address: ip
    });

    return updated;
  }

  static async softDeleteMatter(
    id: string,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<boolean> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const before = await matterRepo.getById(id, ctx);
    if (!before) {
      throw new SecurityAuthorizationError('الملف غير موجود أو غير مصرح لك بحذفه');
    }

    const success = await matterRepo.softDelete(id, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'DELETE',
      entity_type: 'MATTER',
      entity_id: id,
      before_value: `ملف استراتيجي: ${before.code} - ${before.title}`,
      after_value: 'تم النقل للأرشيف/الحذف المنطقي',
      ip_address: ip
    });

    return success;
  }

  static async addMatterLink(
    link: Omit<MatterLink, 'id' | 'created_at'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<MatterLink> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const added = await matterRepo.addLink(link, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'MATTER_LINK',
      entity_id: added.id,
      before_value: null,
      after_value: `ربط بند: ${link.title} بالملف الاستراتيجي ${link.matter_id}`,
      ip_address: ip
    });

    return added;
  }

  static async removeMatterLink(
    linkId: string,
    matterId: string,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<boolean> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const success = await matterRepo.removeLink(linkId, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'MATTER_LINK',
      entity_id: linkId,
      before_value: `ارتباط بالملف ${matterId}`,
      after_value: 'تم فك الربط بنجاح',
      ip_address: ip
    });

    return success;
  }

  // ==========================================
  // CONTACTS COMMANDS
  // ==========================================

  static async createContact(
    data: Omit<Contact, 'id' | 'created_at'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Contact> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const created = await contactRepo.create(data, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'CREATE',
      entity_type: 'CONTACT',
      entity_id: created.id,
      before_value: null,
      after_value: `جهة اتصال: ${created.name} (${created.entity} - ${created.position})`,
      ip_address: ip
    });

    return created;
  }

  static async updateContact(
    id: string,
    changes: Partial<Contact>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Contact> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const updated = await contactRepo.update(id, changes, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'UPDATE',
      entity_type: 'CONTACT',
      entity_id: id,
      before_value: null,
      after_value: `تحديث بيانات جهة الاتصال: ${updated.name}`,
      ip_address: ip
    });

    return updated;
  }

  static async softDeleteContact(
    id: string,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<boolean> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const contact = await contactRepo.getById(id);
    const success = await contactRepo.softDelete(id, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'DELETE',
      entity_type: 'CONTACT',
      entity_id: id,
      before_value: contact ? contact.name : id,
      after_value: 'تم الحذف من دليل الاتصال',
      ip_address: ip
    });

    return success;
  }

  static async addInteraction(
    interaction: Omit<Interaction, 'id'>,
    actor: User,
    ip: string = '<LAN_CLIENT_IP>'
  ): Promise<Interaction> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);

    const added = await contactRepo.addInteraction(interaction, ctx);

    await auditRepo.log({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action_type: 'CREATE',
      entity_type: 'INTERACTION',
      entity_id: added.id,
      before_value: null,
      after_value: `تسجيل تواصل: ${interaction.interaction_type} - ${interaction.summary}`,
      ip_address: ip
    });

    return added;
  }

  // ==========================================
  // NOTIFICATIONS COMMANDS
  // ==========================================

  static async createNotification(
    data: Omit<Notification, 'id' | 'created_at'>,
    actor: User
  ): Promise<Notification> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);
    return notificationRepo.create(data, ctx);
  }

  static async markNotificationAsRead(id: string, actor: User): Promise<void> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);
    return notificationRepo.markAsRead(id, ctx);
  }

  static async markAllNotificationsAsRead(role: RoleType, actor: User): Promise<void> {
    assertAuthenticated(actor);
    const ctx = toUserContext(actor);
    return notificationRepo.markAllAsRead(role, ctx);
  }
}
