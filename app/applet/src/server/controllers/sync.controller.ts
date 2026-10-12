import { Request, Response } from 'express';
import { sqliteEngine } from '../../../../../src/data/database/sqliteEngine.js';

export class SyncController {
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
