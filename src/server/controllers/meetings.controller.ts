import { Request, Response, NextFunction } from 'express';
import { meetingRepo } from '../repositories/index.js';
import { BackendCommandService } from '../services/backendCommand.service.js';
import {
  createMeetingSchema,
  updateMeetingSchema,
  setAttendeesSchema,
  setAgendaSchema,
  saveMinutesSchema,
  approveMinutesSchema,
  addDecisionSchema
} from '../validation/schemas.js';
import { z } from 'zod';

const attendeeItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  title: z.string().min(1),
  entity: z.string().min(1),
  is_required: z.boolean().or(z.number()).optional(),
  is_external: z.boolean().or(z.number()).optional(),
  attendance_status: z.enum(['invited', 'confirmed', 'attended', 'apologized', 'absent']).optional()
}).strict();

const agendaItemSchema = z.object({
  id: z.string().optional(),
  order_index: z.number(),
  title: z.string().min(1),
  presenter_name: z.string().optional(),
  presenter: z.string().optional(),
  duration_minutes: z.number().nonnegative(),
  is_confidential: z.boolean().or(z.number()).optional()
}).strict();

export class MeetingsController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = {
        status: req.query.status as string,
        matterId: req.query.matterId as string,
        search: req.query.search as string
      };
      const data = await meetingRepo.getAll(filter, req.userContext!);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await meetingRepo.getById(req.params.id, req.userContext!);
      if (!item) {
        res.status(404).json({ error: 'الاجتماع غير موجود' });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createMeetingSchema.parse(req.body);
      const created = await BackendCommandService.createMeeting(validated as any, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateMeetingSchema.parse(req.body);
      const updated = await meetingRepo.update(req.params.id, validated as any, req.userContext!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const success = await meetingRepo.softDelete(req.params.id, req.userContext!);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }

  static async getAttendees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await meetingRepo.getAttendees(req.params.id, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async setAttendees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let attendeesList: any[];
      if (Array.isArray(req.body)) {
        attendeesList = z.array(attendeeItemSchema).parse(req.body);
      } else {
        const parsed = setAttendeesSchema.parse(req.body);
        attendeesList = parsed.attendees;
      }
      await meetingRepo.setAttendees(req.params.id, attendeesList, req.userContext!);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async getAgenda(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await meetingRepo.getAgenda(req.params.id, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async setAgenda(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let agendaList: any[];
      if (Array.isArray(req.body)) {
        agendaList = z.array(agendaItemSchema).parse(req.body);
      } else {
        const parsed = setAgendaSchema.parse(req.body);
        agendaList = parsed.items;
      }
      await meetingRepo.setAgenda(req.params.id, agendaList, req.userContext!);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async getMinutes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const minutes = await meetingRepo.getMinutes(req.params.id, req.userContext!);
      res.json(minutes);
    } catch (err) {
      next(err);
    }
  }

  static async saveMinutes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = saveMinutesSchema.parse(req.body);
      if (validated.status && validated.status !== 'draft') {
        res.status(403).json({ error: 'غير مصرح بتعديل أو حفظ محضر نهائي معتمد مباشرة' });
        return;
      }
      const saved = await meetingRepo.saveMinutes({ ...validated, draft_content: validated.draft_content || '', status: 'draft' } as any, req.userContext!);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }

  static async approveMinutes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let approvedContent = '';
      if (req.body.approved_content) {
        const parsed = approveMinutesSchema.parse(req.body);
        approvedContent = parsed.approved_content;
      } else if (req.body.meeting_id) {
        const parsed = saveMinutesSchema.parse(req.body);
        approvedContent = parsed.approved_content || parsed.draft_content || '';
      }
      const saved = await meetingRepo.saveMinutes({
        meeting_id: req.params.id || req.body.meeting_id,
        approved_content: approvedContent,
        status: 'approved',
        approved_by: req.user?.name || req.userContext?.userId || 'CHAIRMAN',
        approved_at: new Date().toISOString()
      } as any, req.userContext!);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }

  static async getDecisions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await meetingRepo.getDecisions(req.params.id, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async addDecision(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = addDecisionSchema.parse(req.body);
      const meeting_id = req.params.id || validated.meeting_id!;
      const payload = {
        ...validated,
        meeting_id,
        order_index: validated.order_index || 1,
        content: validated.content || validated.decision_text || '',
        assigned_to_name: validated.assigned_to_name || validated.assigned_to_entity || 'غير محدد'
      };
      const added = await meetingRepo.addDecision(payload as any, req.userContext!);
      res.status(201).json(added);
    } catch (err) {
      next(err);
    }
  }
}
