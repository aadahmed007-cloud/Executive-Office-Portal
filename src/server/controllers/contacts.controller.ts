import { Request, Response, NextFunction } from 'express';
import { contactRepo } from '../repositories/index.js';

export class ContactsController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await contactRepo.getAll(req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await contactRepo.getById(req.params.id, req.userContext!);
      if (!item) {
        res.status(404).json({ error: 'جهة الاتصال غير موجودة' });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await contactRepo.create(req.body, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await contactRepo.update(req.params.id, req.body, req.userContext!);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const success = await contactRepo.softDelete(req.params.id, req.userContext!);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }

  static async getInteractions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await contactRepo.getInteractions(req.params.id, req.userContext!);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  static async addInteraction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await contactRepo.addInteraction(req.body, req.userContext!);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
}
