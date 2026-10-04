import { CommandService } from '../domain/services/commandService';
import { User } from '../domain/types';
import { auditRepo } from '../data/sqlite/repositories';
import { SecurityAuthorizationError } from '../data/contracts';

export async function runCommandServiceTests(): Promise<boolean> {
  const guestUser: User = {
    id: 'guest',
    username: 'unauthenticated',
    name: 'مستخدم غير مسجل',
    title: 'غير مصرح',
    department_id: '',
    email: '',
    role: 'SECRETARY',
    can_view_confidential: false,
    created_at: ''
  };

  const secretaryUser: User = {
    id: 'sec-command-test',
    username: 'sec_tester',
    name: 'سكرتير تنفيذي معتمد',
    title: 'سكرتير تنفيذي',
    department_id: 'dept-sec',
    email: 'sec_tester@postal.local',
    role: 'SECRETARY',
    can_view_confidential: true,
    created_at: '2026-01-01'
  };

  const chairmanUser: User = {
    id: 'chairman-command-test',
    username: 'chairman_tester',
    name: 'رئيس مجلس الإدارة',
    title: 'رئيس مجلس الإدارة',
    department_id: 'dept-exec',
    email: 'chairman_tester@postal.local',
    role: 'CHAIRMAN',
    can_view_confidential: true,
    created_at: '2026-01-01'
  };

  // Test 1: Guest user cannot execute commands
  let guestBlocked = false;
  try {
    await CommandService.createCorrespondence({
      serial_number: 'CORR-GUEST-001',
      type: 'incoming',
      date: '2026-10-04',
      source_or_dest_entity: 'جهة مجهولة',
      subject: 'محاولة غير مصرح بها',
      priority: 'normal',
      confidentiality: 'normal',
      summary: 'محاولة اختراق أو استدعاء مباشر',
      status: 'registered',
      category: 'operations',
      tags: [],
      created_by: 'guest'
    }, guestUser);
  } catch (err: any) {
    if (err.name === 'SecurityAuthorizationError') {
      guestBlocked = true;
    }
  }
  console.assert(guestBlocked === true, 'CommandService Test 1 Failed: Guest user must be rejected from creating correspondence');

  // Test 2: Secretary cannot execute presidential approval
  let secApprovalBlocked = false;
  try {
    await CommandService.recordApproval({
      correspondence_id: 'corr-in-001',
      decision_type: 'approved',
      standard_phrase: 'تأشيرة غير قانونية',
      decided_at: new Date().toISOString(),
      decided_by_name: secretaryUser.name
    }, secretaryUser);
  } catch (err: any) {
    if (err.name === 'SecurityAuthorizationError') {
      secApprovalBlocked = true;
    }
  }
  console.assert(secApprovalBlocked === true, 'CommandService Test 2 Failed: Secretary must be rejected from recordApproval');

  // Test 3: Authorized Secretary creates a new directive via CommandService
  const initialAuditLogs = await auditRepo.getAll({ limit: 100 });
  const initialAuditCount = initialAuditLogs.length;

  const directive = await CommandService.createDirective({
    code: `DIR-TEST-${Date.now()}`,
    title: 'تكليف عبر طبقة الأوامر والخدمات المعمارية',
    instruction: 'تنفيذ الربط الإلكتروني مع قطاع المناطق البريدية',
    assigned_department: 'قطاع التوزيع والمناطق',
    assigned_person: 'رئيس قطاع المناطق',
    source_type: 'direct_instruction',
    priority: 'urgent',
    confidentiality: 'normal',
    status: 'new',
    progress_percent: 0,
    issued_at: new Date().toISOString(),
    due_date: '2026-11-01',
    created_by: secretaryUser.name
  }, secretaryUser);

  console.assert(Boolean(directive && directive.id), 'CommandService Test 3 Failed: Directive should be created successfully');

  // Test 4: Automatic cryptographic audit log generation
  const afterAuditLogs = await auditRepo.getAll({ limit: 100 });
  console.assert(
    afterAuditLogs.length === initialAuditCount + 1,
    'CommandService Test 4 Failed: Audit log count should increase exactly by 1 after CommandService mutation'
  );

  const latestAudit = afterAuditLogs[0];
  console.assert(
    latestAudit.entity_id === directive.id && latestAudit.action_type === 'CREATE',
    'CommandService Test 5 Failed: Latest audit entry must match the created directive and action CREATE'
  );
  console.assert(
    latestAudit.user_id === secretaryUser.id,
    'CommandService Test 6 Failed: Audit entry user_id must match the authorized actor'
  );
  console.assert(
    Boolean(latestAudit.entry_hash && latestAudit.prev_hash),
    'CommandService Test 7 Failed: Audit entry must have cryptographic entry_hash and prev_hash'
  );

  // Test 5: Chairman executes presidential approval via CommandService on a new correspondence
  const freshCorr = await CommandService.createCorrespondence({
    serial_number: `CORR-APPR-${Date.now()}`,
    type: 'incoming',
    date: '2026-10-04',
    source_or_dest_entity: 'مجلس الوزراء',
    subject: 'مذكرة عرض لاعتماد مشروع التحول الرقمي',
    priority: 'top_urgent',
    confidentiality: 'normal',
    summary: 'طلب الموافقة والتأشيرة الرئاسية على خطة العمل',
    status: 'registered',
    category: 'operations',
    tags: ['عاجل جداً'],
    created_by: secretaryUser.name
  }, secretaryUser);

  const appr = await CommandService.recordApproval({
    correspondence_id: freshCorr.id,
    decision_type: 'approved',
    standard_phrase: 'معتمد للتنفيذ الفوري من رئيس مجلس الإدارة',
    decided_at: new Date().toISOString(),
    decided_by_name: chairmanUser.name
  }, chairmanUser);

  console.assert(Boolean(appr && appr.id), 'CommandService Test 8 Failed: Chairman approval must succeed');

  const afterApprAuditLogs = await auditRepo.getAll({ limit: 100 });
  const apprAudit = afterApprAuditLogs[0];
  console.assert(
    apprAudit.entity_type === 'APPROVAL' && apprAudit.action_type === 'DECIDE',
    'CommandService Test 9 Failed: Approval audit entry must have type APPROVAL and action DECIDE'
  );

  return true;
}
