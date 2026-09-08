import type { ProjectionLog, Song } from "./types.ts";

const DAY = 86_400_000;

export interface SongStat {
  refId: string;
  title: string;
  count: number;
  lastAt: number;
  consecutiveSundays: number;
}

export interface CultoStats {
  windowDays: number;
  totalPlays: number;
  top: SongStat[];
  unused: { id: string; title: string; days: number }[];
  consecutiveWarnings: string[];
}

function isSunday(ts: number): boolean {
  return new Date(ts).getDay() === 0;
}

export function computeSongStats(
  logs: ProjectionLog[],
  songs: Song[],
  windowDays = 90,
): CultoStats {
  const since = Date.now() - windowDays * DAY;
  const recent = logs.filter((l) => l.playedAt >= since && l.kind === "song");
  const map = new Map<string, SongStat>();
  for (const log of recent) {
    const cur = map.get(log.refId) ?? {
      refId: log.refId,
      title: log.title,
      count: 0,
      lastAt: 0,
      consecutiveSundays: 0,
    };
    cur.count += 1;
    cur.lastAt = Math.max(cur.lastAt, log.playedAt);
    map.set(log.refId, cur);
  }

  for (const stat of map.values()) {
    const sundays = recent
      .filter((l) => l.refId === stat.refId && isSunday(l.playedAt))
      .map((l) => {
        const d = new Date(l.playedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      });
    const uniq = [...new Set(sundays)].sort((a, b) => b - a);
    let streak = 0;
    for (let i = 0; i < uniq.length; i++) {
      if (i === 0) {
        streak = 1;
        continue;
      }
      if (uniq[i - 1] - uniq[i] <= 8 * DAY) streak += 1;
      else break;
    }
    stat.consecutiveSundays = streak;
  }

  const top = [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const unused = songs
    .filter((s) => {
      const last = logs.find((l) => l.refId === s.id);
      return !last || Date.now() - last.playedAt > 365 * DAY;
    })
    .map((s) => {
      const last = logs.find((l) => l.refId === s.id);
      return {
        id: s.id,
        title: s.title,
        days: last ? Math.round((Date.now() - last.playedAt) / DAY) : 999,
      };
    })
    .sort((a, b) => b.days - a.days)
    .slice(0, 8);

  const consecutiveWarnings = top
    .filter((t) => t.consecutiveSundays >= 3)
    .map((t) => `${t.title} foi usada ${t.consecutiveSundays} domingos consecutivos`);

  return {
    windowDays,
    totalPlays: recent.length,
    top,
    unused,
    consecutiveWarnings,
  };
}

export function cultoDuration(logs: ProjectionLog[]): {
  startedAt: number | null;
  minutes: number;
  byKind: Record<string, number>;
} {
  if (!logs.length) return { startedAt: null, minutes: 0, byKind: {} };
  const today = logs.filter((l) => Date.now() - l.playedAt < 8 * 60 * 60 * 1000);
  const ordered = [...today].sort((a, b) => a.playedAt - b.playedAt);
  if (!ordered.length) return { startedAt: null, minutes: 0, byKind: {} };
  const startedAt = ordered[0].playedAt;
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const byKind: Record<string, number> = {};
  for (let i = 0; i < ordered.length; i++) {
    const end = ordered[i + 1]?.playedAt ?? Date.now();
    const mins = Math.max(1, Math.round((end - ordered[i].playedAt) / 60000));
    byKind[ordered[i].kind] = (byKind[ordered[i].kind] ?? 0) + mins;
  }
  return { startedAt, minutes, byKind };
}
