import { Request, Response, NextFunction } from 'express';
import { userRepo } from '../repositories/index.js';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username } = req.body;
      const userWithHash = await userRepo.getByUsername(username);
      if (!userWithHash) {
        res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        return;
      }
      const { password_hash, password_salt, ...safeUser } = userWithHash;
      res.json({ user: safeUser });
    } catch (err) {
      next(err);
    }
  }

  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await userRepo.getAll();
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
}
