import { Request, Response, NextFunction } from 'express';
import { settingsRepo } from '../repositories/index.js';
import { updateSettingsSchema } from '../validation/schemas.js';

export class SettingsController {
  static async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsRepo.getSettings(req.userContext!);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateSettingsSchema.parse(req.body);
      const updated = await settingsRepo.updateSettings(validated as any, req.userContext!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
}
