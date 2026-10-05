import { Request, Response, NextFunction } from 'express';
import { settingsRepo } from '../repositories/index.js';

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
      const updated = await settingsRepo.updateSettings(req.body, req.userContext!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
}
