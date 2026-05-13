import { describe, expect, it, vi } from "vitest";

vi.mock("./_generated/server", () => ({
  mutation: (def: any) => def,
  query: (def: any) => def,
}));

const primaryCare = await import("./primaryCare");

const createAppointmentHandler = (primaryCare.createAppointment as any).handler as (ctx: any, args: any) => Promise<any>;
const updateAppointmentHandler = (primaryCare.updateAppointment as any).handler as (ctx: any, args: any) => Promise<any>;
const moveAppointmentHandler = (primaryCare.moveAppointment as any).handler as (ctx: any, args: any) => Promise<any>;
const listAppointmentsHandler = (primaryCare.listAppointments as any).handler as (ctx: any, args: any) => Promise<any>;
const listRoomsHandler = (primaryCare.listRooms as any).handler as (ctx: any, args: any) => Promise<any>;
const createRoomHandler = (primaryCare.createRoom as any).handler as (ctx: any, args: any) => Promise<any>;
const removeRoomHandler = (primaryCare.removeRoom as any).handler as (ctx: any, args: any) => Promise<any>;
const ensureDefaultsHandler = (primaryCare.ensurePrimaryCareDefaults as any).handler as (ctx: any, args: any) => Promise<any>;

type Identity = { role?: string; userId?: string; publicMetadata?: { clinicAdmin?: boolean } } | null;

type Doc = Record<string, any> & { _id: string };

class QueryBuilder {
  constructor(private db: MemoryDb, private table: string, private predicates: Array<(doc: Doc) => boolean> = []) {}

  field(name: string) {
    return { __field: name };
  }

  eq(left: any, right: any) {
    return (doc: Doc) => this.read(left, doc) === right;
  }

  gte(left: any, right: any) {
    return (doc: Doc) => this.read(left, doc) >= right;
  }

  lt(left: any, right: any) {
    return (doc: Doc) => this.read(left, doc) < right;
  }

  filter(predicateOrCallback: any) {
    const predicate = typeof predicateOrCallback === "function" ? predicateOrCallback(this) : predicateOrCallback;
    return new QueryBuilder(this.db, this.table, [...this.predicates, predicate]);
  }

  async collect() {
    const rows = this.db.getTable(this.table);
    return rows.filter((doc) => this.predicates.every((predicate) => predicate(doc))).map((doc) => ({ ...doc }));
  }

  private read(value: any, doc: Doc) {
    if (value && typeof value === "object" && "__field" in value) {
      return doc[value.__field as string];
    }
    return value;
  }
}

class MemoryDb {
  private tables = new Map<string, Doc[]>();
  private seq = 1;

  getTable(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  query(table: string) {
    return new QueryBuilder(this, table);
  }

  async get(id: string) {
    for (const rows of this.tables.values()) {
      const found = rows.find((row) => row._id === id);
      if (found) return { ...found };
    }
    return null;
  }

  async insert(table: string, doc: Record<string, any>) {
    const _id = `${table}:${this.seq++}`;
    const row = { _id, ...doc };
    this.getTable(table).push(row);
    return _id;
  }

  async patch(id: string, patch: Record<string, any>) {
    for (const rows of this.tables.values()) {
      const idx = rows.findIndex((row) => row._id === id);
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...patch };
        return;
      }
    }
    throw new Error(`Document not found: ${id}`);
  }

  async delete(id: string) {
    for (const rows of this.tables.values()) {
      const idx = rows.findIndex((row) => row._id === id);
      if (idx >= 0) {
        rows.splice(idx, 1);
        return;
      }
    }
    throw new Error(`Document not found: ${id}`);
  }
}

function makeCtx(identity: Identity = null) {
  const db = new MemoryDb();
  return {
    db,
    auth: {
      getUserIdentity: async () => identity,
    },
  } as any;
}

async function seedRoom(ctx: any, clinicId: string, name = "Room 1") {
  return ctx.db.insert("rooms", { clinicId, name, capacity: 1, createdAt: Date.now() });
}

async function seedAppt(ctx: any, args: Record<string, any>) {
  return createAppointmentHandler(ctx, {
    clinicId: args.clinicId,
    patientName: args.patientName ?? "John Doe",
    patientId: args.patientId,
    providerId: args.providerId,
    roomId: args.roomId,
    typeId: args.typeId,
    startMs: args.startMs,
    endMs: args.endMs,
    notes: args.notes,
  });
}

describe("primaryCare integration-style handlers", () => {
  it("creates appointments and persists provider/room fields", async () => {
    const ctx = makeCtx({ role: "staff", userId: "staff-1" });
    const roomId = await seedRoom(ctx, "clinic-a");

    const apptId = await seedAppt(ctx, {
      clinicId: "clinic-a",
      patientName: "Jane Doe",
      providerId: "users:1",
      roomId,
      typeId: "primaryCareApptTypes:1",
      startMs: 1_000,
      endMs: 2_000,
      notes: "First visit",
    });

    const appt = await ctx.db.get(apptId);
    expect(appt).toMatchObject({
      clinicId: "clinic-a",
      patientName: "Jane Doe",
      providerId: "users:1",
      roomId,
      startMs: 1_000,
      endMs: 2_000,
      notes: "First visit",
      pmStatus: "scheduled",
    });
  });

  it("derives PM status and reason from notes tags on update", async () => {
    const ctx = makeCtx({ role: "staff", userId: "staff-1" });
    const roomId = await seedRoom(ctx, "clinic-a");
    const apptId = await seedAppt(ctx, {
      clinicId: "clinic-a",
      providerId: "users:1",
      roomId,
      startMs: 1_000,
      endMs: 2_000,
      notes: "Initial",
    });

    await updateAppointmentHandler(ctx, {
      apptId,
      notes: "Front desk check [PM_STATUS:CHECKED_IN] [PM_REASON:Insurance verified]",
    });

    const appt = await ctx.db.get(apptId);
    expect(appt.pmStatus).toBe("checked_in");
    expect(appt.pmStatusReason).toBe("Insurance verified");
    expect(typeof appt.checkedInAt).toBe("number");
    expect(typeof appt.pmStatusUpdatedAt).toBe("number");
  });

  it("rejects overlapping room bookings", async () => {
    const ctx = makeCtx({ role: "staff", userId: "staff-1" });
    const roomId = await seedRoom(ctx, "clinic-a");

    await seedAppt(ctx, {
      clinicId: "clinic-a",
      providerId: "users:1",
      roomId,
      typeId: "primaryCareApptTypes:1",
      startMs: 1_000,
      endMs: 2_000,
    });

    await expect(
      seedAppt(ctx, {
        clinicId: "clinic-a",
        providerId: "users:2",
        roomId,
        typeId: "primaryCareApptTypes:1",
        startMs: 1_500,
        endMs: 2_500,
      }),
    ).rejects.toThrow("Appointment conflicts with existing appointment.");
  });

  it("allows the owning doctor to update an appointment", async () => {
    const ctx = makeCtx({ role: "doctor", userId: "users:1" });
    const roomId = await seedRoom(ctx, "clinic-a");
    const apptId = await seedAppt(ctx, {
      clinicId: "clinic-a",
      providerId: "users:1",
      roomId,
      typeId: "primaryCareApptTypes:1",
      startMs: 1_000,
      endMs: 2_000,
    });

    await updateAppointmentHandler(ctx, {
      apptId,
      patientName: "Updated Patient",
      startMs: 3_000,
      endMs: 4_000,
    });

    const appt = await ctx.db.get(apptId);
    expect(appt).toMatchObject({
      patientName: "Updated Patient",
      startMs: 3_000,
      endMs: 4_000,
    });
  });

  it("rejects update attempts from a different doctor", async () => {
    const ctx = makeCtx({ role: "doctor", userId: "users:2" });
    const roomId = await seedRoom(ctx, "clinic-a");
    const apptId = await seedAppt(ctx, {
      clinicId: "clinic-a",
      providerId: "users:1",
      roomId,
      typeId: "primaryCareApptTypes:1",
      startMs: 1_000,
      endMs: 2_000,
    });

    await expect(
      updateAppointmentHandler(ctx, {
        apptId,
        patientName: "Not allowed",
      }),
    ).rejects.toThrow("Not authorized to update this appointment");
  });

  it("prevents move operations from creating conflicts", async () => {
    const ctx = makeCtx({ role: "staff", userId: "staff-1" });
    const roomId = await seedRoom(ctx, "clinic-a");
    const firstApptId = await seedAppt(ctx, {
      clinicId: "clinic-a",
      providerId: "users:1",
      roomId,
      typeId: "primaryCareApptTypes:1",
      startMs: 1_000,
      endMs: 2_000,
    });
    await seedAppt(ctx, {
      clinicId: "clinic-a",
      providerId: "users:2",
      roomId,
      typeId: "primaryCareApptTypes:1",
      startMs: 5_000,
      endMs: 6_000,
    });

    await expect(moveAppointmentHandler(ctx, { apptId: firstApptId, deltaMs: 4_000 })).rejects.toThrow(
      "Moved time conflicts with existing appointment.",
    );
  });

  it("lists rooms and appointments through the query handlers", async () => {
    const ctx = makeCtx({ role: "admin", userId: "admin-1" });
    await seedRoom(ctx, "clinic-a", "Room A");
    await seedRoom(ctx, "clinic-a", "Room B");

    await seedAppt(ctx, {
      clinicId: "clinic-a",
      providerId: "users:1",
      roomId: "rooms:1",
      typeId: "primaryCareApptTypes:1",
      startMs: 2_000,
      endMs: 3_000,
    });
    await seedAppt(ctx, {
      clinicId: "clinic-a",
      providerId: "users:1",
      roomId: "rooms:2",
      typeId: "primaryCareApptTypes:1",
      startMs: 1_000,
      endMs: 1_500,
    });

    const rooms = await listRoomsHandler(ctx, { clinicId: "clinic-a" });
    expect(rooms).toHaveLength(2);

    const appts = await listAppointmentsHandler(ctx, { clinicId: "clinic-a" });
    expect(appts.map((a: any) => a.startMs)).toEqual([1_000, 2_000]);
  });

  it("creates and removes rooms for clinic admins", async () => {
    const ctx = makeCtx({ role: "admin", userId: "admin-1" });
    const roomId = await createRoomHandler(ctx, { clinicId: "clinic-a", name: "Procedure Room", capacity: 1 });

    const created = await ctx.db.get(roomId);
    expect(created).toMatchObject({ name: "Procedure Room", capacity: 1, clinicId: "clinic-a" });

    await removeRoomHandler(ctx, { roomId });
    await expect(ctx.db.get(roomId)).resolves.toBeNull();
  });

  it("seeds defaults when a clinic is empty", async () => {
    const ctx = makeCtx({ role: "staff", userId: "staff-1" });

    await ensureDefaultsHandler(ctx, { clinicId: "clinic-a" });

    const types = await (primaryCare.listApptTypes as any).handler(ctx, { clinicId: "clinic-a" });
    const rooms = await listRoomsHandler(ctx, { clinicId: "clinic-a" });
    const templates = await (primaryCare.listTemplates as any).handler(ctx, { clinicId: "clinic-a" });

    expect(types.map((t: any) => t.name)).toContain("Consult - New");
    expect(types.map((t: any) => t.name)).toContain("SP Injection");
    expect(rooms.map((r: any) => r.name)).toContain("Exam Room 1");
    expect(templates.map((t: any) => t.name)).toContain("Primary Care SOAP");
  });
});