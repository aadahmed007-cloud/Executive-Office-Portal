import { Request, Response, NextFunction } from 'express';
import { correspondenceRepo } from '../repositories/index.js';
import { BackendCommandService } from '../services/backendCommand.service.js';
import {
  createCorrespondenceSchema,
  updateCorrespondenceSchema,
  reclassifyCorrespondenceSchema,
  submitCorrespondenceSchema,
  saveBriefingSchema,
  recordApprovalSchema,
  addRoutingSchema,
  addAttachmentSchema
} from '../validation/schemas.js';

export class CorrespondenceController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = {
        type: req.query.type as any,
        status: req.query.status as string,
        matterId: req.query.matterId as string,
        search: req.query.search as string
      };
      const list = await correspondenceRepo.getAll(filter, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async getNextSerial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = (req.query.type as 'incoming' | 'outgoing') || 'incoming';
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const serial = await correspondenceRepo.getNextSerial(type, year);
      res.json({ serial });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await correspondenceRepo.getById(req.params.id, req.userContext!);
      if (!item) {
        res.status(404).json({ error: 'المعاملة غير موجودة' });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createCorrespondenceSchema.parse(req.body);
      const created = await BackendCommandService.createCorrespondence(validated as any, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateCorrespondenceSchema.parse(req.body);
      const updated = await correspondenceRepo.update(req.params.id, validated as any, req.userContext!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = submitCorrespondenceSchema.parse(req.body);
      const updated = await (correspondenceRepo as any).submit(req.params.id, validated.comment, req.userContext!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async reclassify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = reclassifyCorrespondenceSchema.parse(req.body);
      const updated = await (correspondenceRepo as any).reclassify(
        req.params.id,
        validated.confidentiality,
        validated.reason,
        req.userContext!
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const success = await correspondenceRepo.softDelete(req.params.id, req.userContext!);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }

  static async getBriefing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const note = await correspondenceRepo.getBriefingNote(req.params.id, req.userContext!);
      res.json(note);
    } catch (err) {
      next(err);
    }
  }

  static async saveBriefing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = saveBriefingSchema.parse(req.body);
      const correspondence_id = req.params.id || validated.correspondence_id!;
      const payload = {
        ...validated,
        correspondence_id,
        background: validated.background || validated.summary || '',
        secretary_recommendation: validated.secretary_recommendation || validated.recommendation || '',
        executive_opinion: validated.executive_opinion || validated.legal_opinion || '',
        prepared_by_name: validated.prepared_by_name || req.user?.name || req.userContext?.userId || 'مستخدم النظام',
        prepared_at: validated.prepared_at || new Date().toISOString()
      };
      const saved = await correspondenceRepo.saveBriefingNote(payload as any, req.userContext!);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }

  static async getApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approval = await correspondenceRepo.getApproval(req.params.id, req.userContext!);
      res.json(approval);
    } catch (err) {
      next(err);
    }
  }

  static async recordApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = recordApprovalSchema.parse(req.body);
      const correspondence_id = req.params.id || validated.correspondence_id!;
      const decision_type = (validated.decision_type || validated.decision || 'approved') as any;
      const payload = {
        ...validated,
        correspondence_id,
        decision_type,
        standard_phrase: validated.standard_phrase || (validated as any).notes || 'معتمد',
        custom_directive: validated.custom_directive || null,
        decided_by_name: validated.decided_by_name || req.user?.name || req.userContext?.userId || 'رئيس مجلس الإدارة',
        decided_at: validated.decided_at || new Date().toISOString()
      };
      const recorded = await correspondenceRepo.recordApproval(payload as any, req.userContext!);
      res.json(recorded);
    } catch (err) {
      next(err);
    }
  }

  static async getRoutings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await correspondenceRepo.getRoutings(req.params.id, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async addRouting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = addRoutingSchema.parse(req.body);
      const correspondence_id = req.params.id || validated.correspondence_id;
      const created = await correspondenceRepo.addRouting({
        ...validated,
        correspondence_id
      } as any, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async getAttachments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await correspondenceRepo.getAttachments(req.params.id, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async addAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = addAttachmentSchema.parse(req.body);
      const correspondence_id = req.params.id || validated.correspondence_id;
      const created = await correspondenceRepo.addAttachment({
        ...validated,
        correspondence_id,
        entity_id: correspondence_id
      } as any, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
}
