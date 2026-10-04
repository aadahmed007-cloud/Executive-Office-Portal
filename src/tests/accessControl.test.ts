import { canAccessItem, maskConfidentialCorrespondence, maskConfidentialDirective, maskConfidentialMeeting } from '../domain/rules/confidentiality';
import { User, Correspondence, Directive, Meeting } from '../domain/types';

/**
 * Phase C Unit Test Suite: Access Control & Confidentiality Enforcement
 * Verifies that:
 * 1. A CHAIRMAN without can_view_confidential flag CANNOT access confidential items.
 * 2. A SECRETARY without can_view_confidential flag CANNOT access confidential items.
 * 3. A user with can_view_confidential flag CAN access confidential items.
 * 4. Repository queries enforce filtering at the data-access layer.
 * 5. Repository getById returns null when unauthorized.
 */
export function runAccessControlRuleTests(): boolean {
  const chairmanWithoutFlag: User = {
    id: 'test-chairman-noflag',
    username: 'chairman_restricted',
    name: 'رئيس مجلس الإدارة (بدون تصريح)',
    title: 'رئيس مجلس الإدارة',
    department_id: 'dept-exec',
    email: 'chairman_noflag@postal.local',
    role: 'CHAIRMAN',
    can_view_confidential: false,
    created_at: '2026-01-01'
  };

  const secretaryWithoutFlag: User = {
    id: 'test-sec-noflag',
    username: 'sec_restricted',
    name: 'سكرتير تنفيذي (بدون تصريح)',
    title: 'سكرتير تنفيذي',
    department_id: 'dept-sec',
    email: 'sec_noflag@postal.local',
    role: 'SECRETARY',
    can_view_confidential: false,
    created_at: '2026-01-01'
  };

  const secretaryWithFlag: User = {
    id: 'test-sec-authorized',
    username: 'sec_authorized',
    name: 'سكرتير تنفيذي مصرح',
    title: 'سكرتير تنفيذي مصرح',
    department_id: 'dept-sec',
    email: 'sec_auth@postal.local',
    role: 'SECRETARY',
    can_view_confidential: true,
    created_at: '2026-01-01'
  };

  const chairmanWithFlag: User = {
    id: 'test-chairman-authorized',
    username: 'chairman_authorized',
    name: 'رئيس مجلس الإدارة المصرح',
    title: 'رئيس مجلس الإدارة',
    department_id: 'dept-exec',
    email: 'chairman_auth@postal.local',
    role: 'CHAIRMAN',
    can_view_confidential: true,
    created_at: '2026-01-01'
  };

  // Rule 1: Normal items are accessible by anyone
  console.assert(
    canAccessItem(chairmanWithoutFlag, 'normal') === true,
    'Rule Test 1 Failed: Normal item should be accessible to Chairman without flag'
  );
  console.assert(
    canAccessItem(secretaryWithoutFlag, 'normal') === true,
    'Rule Test 2 Failed: Normal item should be accessible to Secretary without flag'
  );

  // Rule 2: Confidential / Top Secret items MUST be blocked for users without flag
  console.assert(
    canAccessItem(chairmanWithoutFlag, 'confidential') === false,
    'Rule Test 3 Failed: Confidential item must NOT be accessible to Chairman without flag'
  );
  console.assert(
    canAccessItem(chairmanWithoutFlag, 'top_secret') === false,
    'Rule Test 4 Failed: Top-secret item must NOT be accessible to Chairman without flag'
  );
  console.assert(
    canAccessItem(secretaryWithoutFlag, 'confidential') === false,
    'Rule Test 5 Failed: Confidential item must NOT be accessible to Secretary without flag'
  );
  console.assert(
    canAccessItem(secretaryWithoutFlag, 'top_secret') === false,
    'Rule Test 6 Failed: Top-secret item must NOT be accessible to Secretary without flag'
  );

  // Rule 3: Confidential items ARE accessible when flag is true
  console.assert(
    canAccessItem(secretaryWithFlag, 'confidential') === true,
    'Rule Test 7 Failed: Confidential item must be accessible to Secretary with flag'
  );
  console.assert(
    canAccessItem(chairmanWithFlag, 'top_secret') === true,
    'Rule Test 8 Failed: Top-secret item must be accessible to Chairman with flag'
  );

  // Rule 4: Masking functions redact properly
  const sampleCorr: Correspondence = {
    id: 'c-test',
    serial_number: 'CORR-TEST-001',
    type: 'incoming',
    date: '2026-10-01',
    source_or_dest_entity: 'جهة عليا حساسة',
    subject: 'ملف استراتيجي سري للغاية',
    priority: 'top_urgent',
    confidentiality: 'top_secret',
    summary: 'معلومات حساسة جداً تتعلق بالأمن القومي البريدي',
    status: 'registered',
    created_by: 'Secretary',
    created_at: '2026-10-01',
    updated_at: '2026-10-01'
  };

  const maskedForChairman = maskConfidentialCorrespondence(sampleCorr, chairmanWithoutFlag);
  console.assert(
    maskedForChairman.subject.includes('محجوبة'),
    'Rule Test 9 Failed: Subject should be redacted for Chairman without flag'
  );
  console.assert(
    !maskedForChairman.summary.includes('حساسة جداً'),
    'Rule Test 10 Failed: Summary should be redacted for Chairman without flag'
  );

  const unmaskedForChairman = maskConfidentialCorrespondence(sampleCorr, chairmanWithFlag);
  console.assert(
    unmaskedForChairman.subject === sampleCorr.subject,
    'Rule Test 11 Failed: Subject should remain unredacted for authorized Chairman'
  );

  return true;
}

/**
 * Phase C Repository-level Access Control Tests (Async against SQLite)
 */
export async function runAccessControlRepositoryTests(): Promise<boolean> {
  const { meetingRepo, correspondenceRepo, directiveRepo, matterRepo } = await import('../data/sqlite/repositories');

  const unauthorizedCtx = {
    can_view_confidential: false,
    role: 'CHAIRMAN' as const,
    userId: 'usr-chairman-restricted'
  };

  const authorizedCtx = {
    can_view_confidential: true,
    role: 'SECRETARY' as const,
    userId: 'usr-sec-authorized'
  };

  // 1. Verify meeting query filtering
  const allMeetingsUnauth = await meetingRepo.getAll(undefined, unauthorizedCtx);
  const hasConfidentialMeeting = allMeetingsUnauth.some(
    (m) => m.confidentiality === 'confidential' || m.confidentiality === 'top_secret'
  );
  console.assert(
    !hasConfidentialMeeting,
    'Repo Test 1 Failed: Unauthorized meeting query returned confidential items'
  );

  // 2. Verify correspondence query filtering
  const allCorrUnauth = await correspondenceRepo.getAll(undefined, unauthorizedCtx);
  const hasConfidentialCorr = allCorrUnauth.some(
    (c) => c.confidentiality === 'confidential' || c.confidentiality === 'top_secret'
  );
  console.assert(
    !hasConfidentialCorr,
    'Repo Test 2 Failed: Unauthorized correspondence query returned confidential items'
  );

  // 3. Verify directive query filtering
  const allDirsUnauth = await directiveRepo.getAll(undefined, unauthorizedCtx);
  const hasConfidentialDir = allDirsUnauth.some(
    (d) => d.confidentiality === 'confidential' || d.confidentiality === 'top_secret'
  );
  console.assert(
    !hasConfidentialDir,
    'Repo Test 3 Failed: Unauthorized directive query returned confidential items'
  );

  // 4. Verify matter query filtering
  const allMattersUnauth = await matterRepo.getAll(undefined, unauthorizedCtx);
  const hasConfidentialMatter = allMattersUnauth.some(
    (m) => m.confidentiality === 'confidential' || m.confidentiality === 'top_secret'
  );
  console.assert(
    !hasConfidentialMatter,
    'Repo Test 4 Failed: Unauthorized matter query returned confidential items'
  );

  // 5. Verify direct getById on confidential item returns null for unauthorized user
  const allDirsAuth = await directiveRepo.getAll(undefined, authorizedCtx);
  const confidentialDir = allDirsAuth.find((d) => d.confidentiality !== 'normal');

  if (confidentialDir) {
    const directFetchUnauthorized = await directiveRepo.getById(confidentialDir.id, unauthorizedCtx);
    console.assert(
      directFetchUnauthorized === null,
      'Repo Test 5 Failed: Direct getById of confidential directive must return null for unauthorized user'
    );

    const directFetchAuthorized = await directiveRepo.getById(confidentialDir.id, authorizedCtx);
    console.assert(
      directFetchAuthorized !== null && directFetchAuthorized.id === confidentialDir.id,
      'Repo Test 6 Failed: Direct getById of confidential directive must return object for authorized user'
    );
  }

  // 6. Verify direct getById on confidential correspondence returns null for unauthorized user
  const allCorrAuth = await correspondenceRepo.getAll(undefined, authorizedCtx);
  const confidentialCorr = allCorrAuth.find((c) => c.confidentiality !== 'normal');

  if (confidentialCorr) {
    const fetchCorrUnauth = await correspondenceRepo.getById(confidentialCorr.id, unauthorizedCtx);
    console.assert(
      fetchCorrUnauth === null,
      'Repo Test 7 Failed: Direct getById of confidential correspondence must return null for unauthorized user'
    );
  }

  // 8. Mutation Security Test: Secretary trying to record Chairman approval must be rejected
  let approvalBlocked = false;
  try {
    await correspondenceRepo.recordApproval({
      correspondence_id: 'corr-in-001',
      decision_type: 'approved',
      standard_phrase: 'تأشيرة غير مصرح بها',
      decided_at: new Date().toISOString(),
      decided_by_name: 'دخيل'
    }, { role: 'SECRETARY', userId: 'usr-sec-01', can_view_confidential: true }); // Role is not CHAIRMAN
  } catch (err: any) {
    if (err.name === 'SecurityAuthorizationError') {
      approvalBlocked = true;
    }
  }
  console.assert(
    approvalBlocked === true,
    'Repo Test 8 Failed: Non-Chairman role must be rejected with SecurityAuthorizationError on recordApproval'
  );

  // 8b. Chairman recording approval must succeed
  let chairmanApprovalSucceeded = false;
  try {
    const appr = await correspondenceRepo.recordApproval({
      correspondence_id: 'corr-in-001',
      decision_type: 'approved',
      standard_phrase: 'موافق ومعتمد للتنفيذ',
      decided_at: new Date().toISOString(),
      decided_by_name: 'رئيس مجلس الإدارة'
    }, { role: 'CHAIRMAN', userId: 'usr-chairman-01', can_view_confidential: true });
    if (appr && appr.decision_type === 'approved') {
      chairmanApprovalSucceeded = true;
    }
  } catch {}
  console.assert(
    chairmanApprovalSucceeded === true,
    'Repo Test 8b Failed: Chairman must successfully record approval'
  );

  // 9. Mutation Security Test: Unauthorized user trying to create confidential correspondence must be rejected
  let confidentialCreateBlocked = false;
  try {
    await correspondenceRepo.create({
      serial_number: 'IN-TEST-CONF',
      type: 'incoming',
      date: '2026-10-04',
      source_or_dest_entity: 'كيان اختبار',
      subject: 'موضوع سري للغاية غير مصرح به',
      priority: 'urgent',
      confidentiality: 'top_secret',
      summary: 'ملخص تجربة',
      status: 'registered',
      matter_id: null,
      created_by: 'دخيل'
    }, unauthorizedCtx); // can_view_confidential is false
  } catch (err: any) {
    if (err.name === 'SecurityAuthorizationError') {
      confidentialCreateBlocked = true;
    }
  }
  console.assert(
    confidentialCreateBlocked === true,
    'Repo Test 9 Failed: Creating confidential correspondence without clearance must throw SecurityAuthorizationError'
  );

  // 10. Mutation Security Test: Anonymous softDelete without userId must be rejected
  let anonymousDeleteBlocked = false;
  try {
    await correspondenceRepo.softDelete('corr-in-001', {}); // No userId
  } catch (err: any) {
    if (err.name === 'SecurityAuthorizationError') {
      anonymousDeleteBlocked = true;
    }
  }
  console.assert(
    anonymousDeleteBlocked === true,
    'Repo Test 10 Failed: Anonymous softDelete without session userId must throw SecurityAuthorizationError'
  );

  return true;
}
