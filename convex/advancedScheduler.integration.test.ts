import { describe, expect, it, vi } from "vitest";

vi.mock("./_generated/server", () => ({
  mutation: (def: any) => def,
  query: (def: any) => def,
}));

const primaryCare = await import("./primaryCare");

const createAppointmentHandler = (primaryCare.createAppointment as any).handler as (ctx: any, args: any) => Promise<any>;
const updateAppointmentHandler = (primaryCare.updateAppointment as any).handler as (ctx: any, args: any) => Promise<any>;
const listAppointmentsHandler = (primaryCare.listAppointments as any).handler as (ctx: any, args: any) => Promise<any>;
const listRoomsHandler = (primaryCare.listRooms as any).handler as (ctx: any, args: any) => Promise<any>;
const createRoomHandler = (primaryCare.createRoom as any).handler as (ctx: any, args: any) => Promise<any>;

class MemoryDb {
  private tables = new Map<string, any[]>();
  private seq = 1;
  getTable(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }
  query(table: string) {
    const self = this;
    const predicates: Array<(row: any) => boolean> = [];
    const api = {
      field: (f: string) => f,
      eq: (fieldName: string, value: any) => ((row: any) => row[fieldName] === value),
      gte: (fieldName: string, value: any) => ((row: any) => row[fieldName] >= value),
      lt: (fieldName: string, value: any) => ((row: any) => row[fieldName] < value),
    };
    const apiQuery: any = {
      filter: (fn: (q: any) => (rowPredicate: any) => boolean) => {
        const pred = fn(api as any);
        predicates.push(pred as any);
        return apiQuery;
      },
      collect: async () => {
        const rows = self.getTable(table).slice();
        return rows.filter((r) => predicates.every((p) => p(r)));
      },
    };
    return apiQuery as any;
  }
  async insert(table: string, doc: Record<string, any>) {
    const _id = `${table}:${this.seq++}`;
    this.getTable(table).push({ _id, ...doc });
    return _id;
  }
  async get(id: string) {
    for (const rows of this.tables.values()) {
      const found = rows.find((row) => row._id === id);
      if (found) return { ...found };
    }
    return null;
  }
  async patch(id: string, patch: Record<string, any>) {
    for (const rows of this.tables.values()) {
      const i = rows.findIndex((r) => r._id === id);
      if (i >= 0) {
        rows[i] = { ...rows[i], ...patch };
        return;
      }
    }
    throw new Error("Not found");
  }
}

function makeCtx(role = { role: 'staff', userId: 'staff-1' } as any) {
  const db = new MemoryDb();
  return { db, auth: { getUserIdentity: async () => role } } as any;
}

describe('Advanced scheduler interactions', () => {
  it('can duplicate and move appointments', async () => {
    const ctx = makeCtx({ role: 'staff', userId: 'staff-1' });
    const adminCtx = makeCtx({ role: 'admin', userId: 'admin-1', publicMetadata: { clinicAdmin: true } });
    const roomId = await createRoomHandler(adminCtx, { clinicId: 'clinic-a', name: 'Exam 1', capacity: 1 });

    const apptId = await createAppointmentHandler(ctx, {
      clinicId: 'clinic-a',
      patientName: 'Dup Test',
      providerId: 'users:1',
      roomId,
      typeId: 'primaryCareApptTypes:1',
      startMs: 1000,
      endMs: 2000,
    });

    // duplicate by creating another appointment at a later time
    const original = await ctx.db.get(apptId);
    const duration = original.endMs - original.startMs;
    const newStart = original.endMs + 60_000;
    const duplicatedId = await createAppointmentHandler(ctx, {
      clinicId: 'clinic-a',
      patientName: original.patientName,
      providerId: original.providerId,
      roomId: original.roomId,
      typeId: original.typeId,
      startMs: newStart,
      endMs: newStart + duration,
    });

    const appts = await listAppointmentsHandler(ctx, { clinicId: 'clinic-a' });
    expect(appts.map((a:any)=>a.patientName)).toContain('Dup Test');
    expect(appts).toHaveLength(2);

    // move duplicated appointment to new room
    const newRoomId = await createRoomHandler(adminCtx, { clinicId: 'clinic-a', name: 'Exam 2', capacity: 1 });
    await updateAppointmentHandler(ctx, { apptId: duplicatedId, roomId: newRoomId });
    const updated = await ctx.db.get(duplicatedId);
    expect(updated.roomId).toBe(newRoomId);
  });
});
