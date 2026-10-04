import { Request, Response, NextFunction } from 'express';
import { directiveRepo } from '../repositories/index.js';
import { BackendCommandService } from '../services/backendCommand.service.js';

export class DirectivesController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter = {
        status: req.query.status as string,
        assignedDepartment: req.query.assignedDepartment as string,
        matterId: req.query.matterId as string,
        search: req.query.search as string
      };
      const list = await directiveRepo.getAll(filter, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async getNextCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const code = await directiveRepo.getNextCode(year);
      res.json({ code });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await directiveRepo.getById(req.params.id, req.userContext);
      if (!item) {
        res.status(404).json({ error: 'التكليف غير موجود' });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await BackendCommandService.createDirective(req.body, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await directiveRepo.update(req.params.id, req.body, req.userContext);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const success = await directiveRepo.softDelete(req.params.id, req.userContext);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }

  static async getUpdates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await directiveRepo.getUpdates(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async addUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await directiveRepo.addUpdate(req.body, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
}
