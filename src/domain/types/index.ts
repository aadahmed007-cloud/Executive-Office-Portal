export type RoleType = 'CHAIRMAN' | 'SECRETARY' | 'DEPT_HEAD' | 'AUDITOR' | 'ADMIN';

export type ConfidentialityLevel = 'normal' | 'confidential' | 'top_secret';

export type PriorityLevel = 'normal' | 'urgent' | 'top_urgent';

export interface User {
  id: string;
  name: string;
  title: string;
  department_id: string;
  email: string;
  role: RoleType;
  can_view_confidential: boolean;
  avatar?: string;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  head_title: string;
  is_active: boolean;
}

export interface Matter {
  id: string;
  code: string; // e.g. MATTER-2026-001
  title: string;
  description: string;
  confidentiality: ConfidentialityLevel;
  status: 'active' | 'under_review' | 'completed' | 'archived';
  lead_entity: string;
  priority: PriorityLevel;
  created_at: string;
  updated_at: string;
  created_by: string;
  deleted_at?: string | null;
}

export interface MatterLink {
  id: string;
  matter_id: string;
  item_type: 'correspondence' | 'meeting' | 'directive' | 'decision' | 'attachment';
  item_id: string;
  title: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  location: string; // e.g. "قاعة مجلس الإدارة الكبرى - المبنى الرئيسي بالقرية الذكية"
  start_time: string; // ISO 8601
  end_time: string; // ISO 8601
  meeting_type: 'internal' | 'external_entity' | 'ministerial' | 'board';
  status: 'scheduled' | 'confirmed' | 'in_session' | 'minutes_drafted' | 'minutes_approved' | 'cancelled';
  matter_id?: string | null;
  confidentiality: ConfidentialityLevel;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  deleted_at?: string | null;
}

export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  name: string;
  title: string;
  entity: string;
  is_external: boolean;
  attendance_status: 'invited' | 'confirmed' | 'declined' | 'attended';
}

export interface AgendaItem {
  id: string;
  meeting_id: string;
  order_index: number;
  title: string;
  description?: string;
  duration_minutes: number;
  presenter: string;
}

export interface MeetingMinutes {
  id: string;
  meeting_id: string;
  draft_content: string;
  approved_content?: string;
  status: 'draft' | 'approved';
  approved_by?: string;
  approved_at?: string;
}

export interface Decision {
  id: string;
  meeting_id: string;
  order_index: number;
  content: string;
  assigned_department_id?: string;
  assigned_to_name: string;
  due_date: string;
  directive_id?: string; // If auto-converted to a directive
  status: 'pending' | 'in_progress' | 'completed';
}

export interface Correspondence {
  id: string;
  serial_number: string; // e.g. IN-2026-0001 or OUT-2026-0001
  type: 'incoming' | 'outgoing';
  date: string;
  source_or_dest_entity: string;
  subject: string;
  priority: PriorityLevel;
  confidentiality: ConfidentialityLevel;
  summary: string;
  status:
    | 'registered'
    | 'briefing_prepared'
    | 'presented_to_chairman'
    | 'approved'
    | 'rejected'
    | 'postponed'
    | 'referred'
    | 'in_progress'
    | 'completed'
    | 'overdue'
    | 'draft'
    | 'under_review'
    | 'dispatched';
  matter_id?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  deleted_at?: string | null;
}

export interface BriefingNote {
  id: string;
  correspondence_id: string;
  background: string;
  secretary_recommendation: string;
  executive_opinion: string;
  prepared_by_name: string;
  prepared_at: string;
}

export interface Approval {
  id: string;
  correspondence_id: string;
  decision_type: 'approved' | 'rejected' | 'postponed' | 'referred';
  standard_phrase: string; // "للاطلاع", "للدراسة وإبداء الرأي", etc.
  custom_directive?: string;
  decided_at: string;
  decided_by_name: string;
}

export interface CorrespondenceRouting {
  id: string;
  correspondence_id: string;
  from_entity: string;
  to_department_id: string;
  to_department_name: string;
  action_required: string;
  deadline: string;
  status: 'sent' | 'acknowledged' | 'completed';
  routed_at: string;
}

export interface Attachment {
  id: string;
  entity_type: 'correspondence' | 'meeting' | 'directive' | 'matter';
  entity_id: string;
  file_name: string;
  file_size_kb: number;
  mime_type: string;
  confidentiality: ConfidentialityLevel;
  uploaded_at: string;
}

export interface Directive {
  id: string;
  code: string; // DIR-2026-0001
  title: string;
  instruction: string;
  assigned_department: string;
  assigned_person: string;
  source_type: 'correspondence' | 'meeting' | 'direct_instruction';
  source_id?: string;
  priority: PriorityLevel;
  confidentiality: ConfidentialityLevel;
  status: 'new' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'overdue';
  progress_percent: number;
  issued_at: string;
  due_date: string;
  matter_id?: string | null;
  created_by: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface DirectiveUpdate {
  id: string;
  directive_id: string;
  notes: string;
  progress_percent: number;
  updated_by: string;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  entity: string;
  position: string;
  phone: string;
  email: string;
  category: 'ministry' | 'central_bank' | 'postal_administration' | 'vendor' | 'security' | 'other';
  notes?: string;
  created_at: string;
  deleted_at?: string | null;
}

export interface Interaction {
  id: string;
  contact_id: string;
  interaction_type: 'phone_call' | 'official_visit' | 'meeting' | 'correspondence';
  date: string;
  summary: string;
  recorded_by: string;
}

export interface Notification {
  id: string;
  recipient_role: RoleType;
  title: string;
  body: string;
  confidentiality: ConfidentialityLevel;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name: string;
  user_role: RoleType;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'DECIDE' | 'ROUTING' | 'EXPORT' | 'AUTH';
  entity_type: string;
  entity_id: string;
  before_value?: string | null;
  after_value?: string | null;
  timestamp: string;
  ip_address: string;
}

export interface SystemSettings {
  id: string;
  fiscal_year: string;
  session_timeout_minutes: number;
  default_digit_format: 'western' | 'indic';
  default_calendar_format: 'gregorian' | 'with_hijri';
  last_backup_date?: string;
}
