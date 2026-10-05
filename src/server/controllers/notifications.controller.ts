import { Request, Response, NextFunction } from 'express';
import { notificationRepo } from '../repositories/index.js';
import {
  markNotificationReadSchema,
  markAllNotificationsReadSchema
} from '../validation/schemas.js';

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

  static async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.body && Object.keys(req.body).length > 0) {
        markNotificationReadSchema.parse(req.body);
      }
      await notificationRepo.markAsRead(req.params.id, req.userContext!);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.body && Object.keys(req.body).length > 0) {
        markAllNotificationsReadSchema.parse(req.body);
      }
      const role = req.userContext?.role || 'SECRETARY';
      await notificationRepo.markAllAsRead(role, req.userContext!);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
