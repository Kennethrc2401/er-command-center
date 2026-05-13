// pure helpers for appointment conflict detection (testable outside Convex runtime)

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

export function findConflict(candidates: any[], args: { startMs: number; endMs?: number; providerId?: any; roomId?: any }){
  const aStart = args.startMs;
  const aEnd = args.endMs ?? args.startMs;
  return candidates.find((c) => {
    const bStart = c.startMs;
    const bEnd = c.endMs ?? c.startMs;
    const basic = overlaps(aStart, aEnd, bStart, bEnd);
    if (!basic) return false;
    // room collision takes precedence
    if (args.roomId && c.roomId && String(args.roomId) === String(c.roomId)) return true;
    // provider collision
    if (args.providerId && c.providerId && String(args.providerId) === String(c.providerId)) return true;
    // if neither provider nor room specified, any clinic-level overlap counts
    if (!args.providerId && !args.roomId) return true;
    return false;
  });
}
