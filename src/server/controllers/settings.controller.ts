import { Request, Response, NextFunction } from 'express';
import { settingsRepo } from '../repositories/index.js';
import { updateSettingsSchema } from '../validation/schemas.js';
import { sqliteEngine } from '../../data/database/sqliteEngine.js';

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

  static getVersion(req: Request, res: Response) {
    const user = req.user;
    const canConf = Boolean(user && user.can_view_confidential);

    const rows = sqliteEngine.query<{
      non_confidential_version: number;
      confidential_version: number;
    }>('SELECT non_confidential_version, confidential_version FROM change_versions WHERE id = 1');

    const row = rows[0] || { non_confidential_version: 0, confidential_version: 0 };

    if (canConf) {
      return res.json({
        non_confidential_version: row.non_confidential_version,
        confidential_version: row.confidential_version,
      });
    } else {
      return res.json({
        non_confidential_version: row.non_confidential_version,
      });
    }
  }
}
