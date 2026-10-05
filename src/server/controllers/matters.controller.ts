import { Request, Response, NextFunction } from 'express';
import { matterRepo } from '../repositories/index.js';
import {
  createMatterSchema,
  updateMatterSchema,
  addMatterLinkSchema
} from '../validation/schemas.js';

export class MattersController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = {
        status: req.query.status as string,
        search: req.query.search as string
      };
      const list = await matterRepo.getAll(filter, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await matterRepo.getById(req.params.id, req.userContext!);
      if (!item) {
        res.status(404).json({ error: 'الملف غير موجود' });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createMatterSchema.parse(req.body);
      const created = await matterRepo.create(validated as any, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateMatterSchema.parse(req.body);
      const updated = await matterRepo.update(req.params.id, validated, req.userContext!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const success = await matterRepo.softDelete(req.params.id, req.userContext!);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }

  static async getLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await matterRepo.getLinks(req.params.id, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async addLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = addMatterLinkSchema.parse(req.body);
      const created = await matterRepo.addLink({ ...validated, matter_id: req.params.id } as any, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async removeLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const success = await matterRepo.removeLink(req.params.linkId, req.userContext!);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }
}
