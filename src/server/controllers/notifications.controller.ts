import { Request, Response, NextFunction } from 'express';
import { notificationRepo } from '../repositories/index.js';

export class NotificationsController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = (req.query.role as any) || req.userContext?.role || 'SECRETARY';
      const list = await notificationRepo.getAllForRole(role, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await notificationRepo.create(req.body, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationRepo.markAsRead(req.params.id, req.userContext!);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.body.role || req.userContext?.role || 'SECRETARY';
      await notificationRepo.markAllAsRead(role, req.userContext!);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
