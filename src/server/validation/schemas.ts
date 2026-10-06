import { z } from 'zod';

/**
 * Zod Schemas for API Requests with Strict Validation (.strict()).
 * Any unrecognized keys are strictly rejected with 400 Bad Request.
 */

// --- Correspondence Schemas ---
export const createCorrespondenceSchema = z.object({
  type: z.enum(['incoming', 'outgoing']),
  date: z.string().min(1),
  source_or_dest_entity: z.string().min(1),
  subject: z.string().min(1),
  priority: z.enum(['normal', 'urgent', 'top_urgent']),
  confidentiality: z.enum(['normal', 'confidential', 'secret', 'top_secret']).optional(),
  summary: z.string().nullable().optional(),
  matter_id: z.string().nullable().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional()
}).strict();

export const updateCorrespondenceSchema = z.object({
  date: z.string().optional(),
  source_or_dest_entity: z.string().optional(),
  subject: z.string().optional(),
  priority: z.enum(['normal', 'urgent', 'top_urgent']).optional(),
  summary: z.string().nullable().optional(),
  matter_id: z.string().nullable().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional()
}).strict();

export const reclassifyCorrespondenceSchema = z.object({
  confidentiality: z.enum(['normal', 'confidential', 'secret', 'top_secret']),
  reason: z.string().optional()
}).strict();

export const submitCorrespondenceSchema = z.object({
  comment: z.string().optional()
}).strict();

export const saveBriefingSchema = z.object({
  correspondence_id: z.string().optional(),
  summary: z.string().optional(),
  background: z.string().optional(),
  secretary_recommendation: z.string().optional(),
  executive_opinion: z.string().optional(),
  prepared_by_name: z.string().optional(),
  prepared_at: z.string().optional(),
  legal_opinion: z.string().nullable().optional(),
  financial_impact: z.string().nullable().optional(),
  recommendation: z.string().nullable().optional()
}).strict();

export const recordApprovalSchema = z.object({
  correspondence_id: z.string().optional(),
  decision: z.string().optional(),
  decision_type: z.string().optional(),
  notes: z.string().nullable().optional(),
  referral_target: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  standard_phrase: z.string().optional(),
  custom_directive: z.string().nullable().optional(),
  decided_at: z.string().optional(),
  decided_by_name: z.string().optional()
}).strict();

export const addRoutingSchema = z.object({
  correspondence_id: z.string().min(1),
  from_entity: z.string().min(1),
  to_entity: z.string().optional(),
  to_department_id: z.string().optional(),
  to_department_name: z.string().optional(),
  action_required: z.string().min(1),
  notes: z.string().nullable().optional(),
  deadline: z.string().optional(),
  due_date: z.string().nullable().optional()
}).strict();

export const addAttachmentSchema = z.object({
  correspondence_id: z.string().min(1),
  file_name: z.string().min(1),
  file_size: z.number().nonnegative(),
  file_type: z.string().min(1),
  confidentiality: z.enum(['normal', 'confidential', 'secret', 'top_secret']).optional()
}).strict();

// --- Directives Schemas ---
export const createDirectiveSchema = z.object({
  title: z.string().min(1),
  instruction: z.string().min(1),
  assigned_department: z.string().min(1),
  assigned_person: z.string().nullable().optional(),
  source_type: z.string().min(1),
  source_id: z.string().nullable().optional(),
  priority: z.enum(['normal', 'urgent', 'top_urgent']),
  confidentiality: z.enum(['normal', 'confidential', 'secret', 'top_secret']).optional(),
  due_date: z.string().nullable().optional(),
  matter_id: z.string().nullable().optional()
}).strict();

export const updateDirectiveSchema = z.object({
  title: z.string().optional(),
  instruction: z.string().optional(),
  assigned_department: z.string().optional(),
  assigned_person: z.string().nullable().optional(),
  source_type: z.string().optional(),
  source_id: z.string().nullable().optional(),
  priority: z.enum(['normal', 'urgent', 'top_urgent']).optional(),
  due_date: z.string().nullable().optional(),
  matter_id: z.string().nullable().optional()
}).strict();

export const updateDirectiveStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'delayed', 'cancelled']),
  reason: z.string().optional()
}).strict();

export const addDirectiveUpdateSchema = z.object({
  directive_id: z.string().min(1),
  update_text: z.string().optional(),
  content: z.string().optional(),
  progress_percent: z.number().min(0).max(100)
}).strict();

// --- Meetings Schemas ---
export const createMeetingSchema = z.object({
  title: z.string().min(1),
  location: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  meeting_type: z.string().min(1),
  matter_id: z.string().nullable().optional(),
  confidentiality: z.enum(['normal', 'confidential', 'secret', 'top_secret']).optional(),
  notes: z.string().nullable().optional()
}).strict();

export const updateMeetingSchema = z.object({
  title: z.string().optional(),
  location: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  meeting_type: z.string().optional(),
  matter_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
}).strict();

export const setAttendeesSchema = z.object({
  attendees: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    title: z.string().min(1),
    entity: z.string().min(1),
    is_required: z.boolean().or(z.number()).optional(),
    is_external: z.boolean().or(z.number()).optional(),
    attendance_status: z.enum(['invited', 'confirmed', 'attended', 'apologized', 'absent']).optional()
  }).strict())
}).strict();

export const setAgendaSchema = z.object({
  items: z.array(z.object({
    id: z.string().optional(),
    order_index: z.number(),
    title: z.string().min(1),
    presenter_name: z.string().optional(),
    presenter: z.string().optional(),
    duration_minutes: z.number().nonnegative(),
    is_confidential: z.boolean().or(z.number()).optional()
  }).strict())
}).strict();

export const saveMinutesSchema = z.object({
  meeting_id: z.string().min(1),
  draft_content: z.string().nullable().optional(),
  approved_content: z.string().nullable().optional(),
  status: z.enum(['draft', 'approved']).optional()
}).strict();

export const approveMinutesSchema = z.object({
  meeting_id: z.string().optional(),
  approved_content: z.string().min(1),
  status: z.string().optional()
}).strict();

export const addDecisionSchema = z.object({
  meeting_id: z.string().optional(),
  agenda_item_id: z.string().nullable().optional(),
  order_index: z.number().optional(),
  content: z.string().optional(),
  decision_text: z.string().optional(),
  assigned_to_entity: z.string().optional(),
  assigned_department_id: z.string().nullable().optional(),
  assigned_to_name: z.string().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(['normal', 'urgent', 'top_urgent']).optional()
}).strict();

// --- Matters Schemas ---
export const createMatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  confidentiality: z.enum(['normal', 'confidential', 'secret', 'top_secret']).optional(),
  lead_entity: z.string().min(1),
  priority: z.enum(['normal', 'urgent', 'top_urgent']).optional()
}).strict();

export const updateMatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  lead_entity: z.string().optional(),
  priority: z.enum(['normal', 'urgent', 'top_urgent']).optional()
}).strict();

export const addMatterLinkSchema = z.object({
  target_type: z.enum(['correspondence', 'directive', 'meeting']),
  target_id: z.string().min(1)
}).strict();

// --- Contacts Schemas ---
export const createContactSchema = z.object({
  name: z.string().min(1),
  entity: z.string().min(1),
  position: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  category: z.string().min(1),
  notes: z.string().nullable().optional()
}).strict();

export const updateContactSchema = z.object({
  name: z.string().optional(),
  entity: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  category: z.string().optional(),
  notes: z.string().nullable().optional()
}).strict();

export const addInteractionSchema = z.object({
  contact_id: z.string().min(1),
  date: z.string().min(1),
  type: z.string().optional(),
  interaction_type: z.string().optional(),
  summary: z.string().min(1),
  follow_up_needed: z.boolean().or(z.number()).optional()
}).strict();

// --- Notifications Schemas ---
export const markNotificationReadSchema = z.object({}).strict();
export const markAllNotificationsReadSchema = z.object({}).strict();

// --- Settings Schemas ---
export const updateSettingsSchema = z.object({
  council_name: z.string().optional(),
  header_title: z.string().optional(),
  primary_color: z.string().optional(),
  session_timeout_minutes: z.number().int().positive().optional(),
  auto_archive_days: z.number().int().positive().optional(),
  enable_two_factor: z.boolean().or(z.number()).optional(),
  fiscal_year: z.string().optional(),
  default_digit_format: z.string().optional(),
  default_calendar_format: z.string().optional()
}).strict();

// --- Auth Schemas ---
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
}).strict();

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8)
}).strict();

export const reauthSchema = z.object({
  password: z.string().min(1)
}).strict();
