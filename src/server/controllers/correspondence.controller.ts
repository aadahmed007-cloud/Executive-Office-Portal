import { Request, Response, NextFunction } from 'express';
import { correspondenceRepo } from '../repositories/index.js';
import { BackendCommandService } from '../services/backendCommand.service.js';

export class CorrespondenceController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = {
        type: req.query.type as any,
        status: req.query.status as string,
        matterId: req.query.matterId as string,
        search: req.query.search as string
      };
      const list = await correspondenceRepo.getAll(filter, req.userContext);
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
      const item = await correspondenceRepo.getById(req.params.id, req.userContext);
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
      const created = await BackendCommandService.createCorrespondence(req.body, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await correspondenceRepo.update(req.params.id, req.body, req.userContext);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const success = await correspondenceRepo.softDelete(req.params.id, req.userContext);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }

  static async getBriefing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const note = await correspondenceRepo.getBriefingNote(req.params.id, req.userContext);
      res.json(note);
    } catch (err) {
      next(err);
    }
  }

  static async saveBriefing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const saved = await correspondenceRepo.saveBriefingNote(req.body, req.userContext);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }

  static async getApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approval = await correspondenceRepo.getApproval(req.params.id, req.userContext);
      res.json(approval);
    } catch (err) {
      next(err);
    }
  }

  static async recordApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const recorded = await correspondenceRepo.recordApproval(req.body, req.userContext);
      res.json(recorded);
    } catch (err) {
      next(err);
    }
  }

  static async getRoutings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await correspondenceRepo.getRoutings(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async addRouting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await correspondenceRepo.addRouting(req.body, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async getAttachments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await correspondenceRepo.getAttachments(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async addAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await correspondenceRepo.addAttachment(req.body, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
}
