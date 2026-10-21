import {
  meetingRepo,
  correspondenceRepo,
  directiveRepo,
  UserContext
} from '../repositories/index.js';
import {
  Meeting,
  Correspondence,
  Directive
} from '../../domain/types/index.js';

/**
 * Backend Command & Orchestration Service.
 * Centralizes transactional integrity, audit log recording, and notifications on the server.
 */
export class BackendCommandService {
  // Meetings
  static async createMeeting(data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Meeting> {
    const ctx = userContext || { userId: 'server', role: 'SECRETARY' as const, can_view_confidential: false };
    return meetingRepo.create(data, ctx);
  }

  // Correspondence
  static async createCorrespondence(data: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Correspondence> {
    const ctx = userContext || { userId: 'server', role: 'SECRETARY' as const, can_view_confidential: false };
    return correspondenceRepo.create(data, ctx);
  }

  // Directives
  static async createDirective(data: Omit<Directive, 'id' | 'created_at' | 'updated_at'>, userContext?: UserContext): Promise<Directive> {
    const ctx = userContext || { userId: 'server', role: 'SECRETARY' as const, can_view_confidential: false };
    return directiveRepo.create(data, ctx);
  }
}
