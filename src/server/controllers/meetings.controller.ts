import { Request, Response, NextFunction } from 'express';
import { meetingRepo } from '../repositories/index.js';
import { BackendCommandService } from '../services/backendCommand.service.js';

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
      const created = await BackendCommandService.createMeeting(req.body, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await meetingRepo.update(req.params.id, req.body, req.userContext!);
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
      await meetingRepo.setAttendees(req.params.id, req.body, req.userContext!);
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
      await meetingRepo.setAgenda(req.params.id, req.body, req.userContext!);
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
      if (req.body.status && req.body.status !== 'draft') {
        res.status(403).json({ error: 'غير مصرح بتعديل أو حفظ محضر نهائي معتمد مباشرة' });
        return;
      }
      const saved = await meetingRepo.saveMinutes({ ...req.body, status: 'draft' }, req.userContext!);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }

  static async approveMinutes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const saved = await meetingRepo.saveMinutes({
        ...req.body,
        status: 'approved',
        approved_by: req.user?.name || 'CHAIRMAN',
        approved_at: new Date().toISOString()
      }, req.userContext!);
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
      const added = await meetingRepo.addDecision(req.body, req.userContext!);
      res.status(201).json(added);
    } catch (err) {
      next(err);
    }
  }
}
