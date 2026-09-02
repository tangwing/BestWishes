import { currentStreak, localDateFor, totalPublished } from '@bestwishes/domain';
import type { AppDeps } from './deps';

export interface StreakView {
  total: number;
  streak: number;
  byDay: { date: string; count: number }[];
}

export function createStreakService(deps: AppDeps) {
  return {
    /** 仅作者本人可看。 */
    async view(userId: string): Promise<StreakView | null> {
      const user = await deps.repos.users.findById(userId);
      if (!user) return null;
      const days = await deps.repos.streaks.getDays(userId);
      const today = localDateFor(deps.clock.now(), user.utcOffsetMinutes);
      return {
        total: totalPublished(days),
        streak: currentStreak(days, today),
        byDay: Object.entries(days)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => (a.date < b.date ? 1 : -1)),
      };
    },
  };
}

export type StreakService = ReturnType<typeof createStreakService>;
