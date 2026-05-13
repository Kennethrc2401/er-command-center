import re

# Read the schema file
with open(r'convex/schema.ts', 'r') as f:
    content = f.read()

# Fix notifications table - replace invalid indices with valid ones
old_notif = '''    notifications: defineTable({
      type: v.string(), // e.g., "CRITICAL_LAB", "DETERIORATION", "STAT_ORDER"
      title: v.string(),
      message: v.string(),
      patientId: v.id("patients"),
      encounterId: v.optional(v.id("encounters")),
      timestamp: v.number(),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      routedTo: v.optional(v.union(v.literal("NURSE"), v.literal("DOCTOR"), v.literal("UNIT_COORDINATOR"))),
      isRead: v.optional(v.boolean()),
      readAt: v.optional(v.number()),
      suppressionKey: v.optional(v.string()),
      suppressedUntil: v.optional(v.number()),
    })
      .index("by_id", ["_id"])
      .index("by_creation_time", ["_creationTime"]),'''

new_notif = '''    notifications: defineTable({
      type: v.string(), // e.g., "CRITICAL_LAB", "DETERIORATION", "STAT_ORDER"
      title: v.string(),
      message: v.string(),
      patientId: v.id("patients"),
      encounterId: v.optional(v.id("encounters")),
      timestamp: v.number(),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      routedTo: v.optional(v.union(v.literal("NURSE"), v.literal("DOCTOR"), v.literal("UNIT_COORDINATOR"))),
      isRead: v.optional(v.boolean()),
      readAt: v.optional(v.number()),
      suppressionKey: v.optional(v.string()),
      suppressedUntil: v.optional(v.number()),
    })
      .index("by_patient", ["patientId"])
      .index("by_type", ["type"])
      .index("by_timestamp", ["timestamp"]),'''

content = content.replace(old_notif, new_notif)

# Fix notificationRoutingEvents table
old_routing = '''    notificationRoutingEvents: defineTable({
      notificationId: v.optional(v.id("notifications")),
      encounterId: v.optional(v.id("encounters")),
      patientId: v.id("patients"),
      type: v.string(),
      role: v.string(),
      routedByUser: v.optional(v.string()),
      routedAt: v.number(),
      skipped: v.optional(v.boolean()),
      skipReason: v.optional(v.string()),
    })
      .index("by_id", ["_id"])
      .index("by_creation_time", ["_creationTime"]),'''

new_routing = '''    notificationRoutingEvents: defineTable({
      notificationId: v.optional(v.id("notifications")),
      encounterId: v.optional(v.id("encounters")),
      patientId: v.id("patients"),
      type: v.string(),
      role: v.string(),
      routedByUser: v.optional(v.string()),
      routedAt: v.number(),
      skipped: v.optional(v.boolean()),
      skipReason: v.optional(v.string()),
    })
      .index("by_patient", ["patientId"])
      .index("by_role", ["role"])
      .index("by_routed_at", ["routedAt"]),'''

content = content.replace(old_routing, new_routing)

# Write back
with open(r'convex/schema.ts', 'w') as f:
    f.write(content)

print("Schema fixed successfully!")
