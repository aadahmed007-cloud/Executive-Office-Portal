import { Request, Response, NextFunction } from 'express';
import { auditRepo } from '../repositories/index.js';

export class AuditController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = {
        entityType: req.query.entityType as string,
        userId: req.query.userId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100
      };
      const list = await auditRepo.getAll(filter, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async log(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await auditRepo.log(req.body, req.userContext!);
      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await (auditRepo as any).verify(req.userContext!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
