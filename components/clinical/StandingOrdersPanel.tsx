"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface StandingOrder {
  _id: Id<"standingOrders">;
  _creationTime: number;
  encounterId: Id<"encounters">;
  orderType: string;
  orderName: string;
  status: string;
  trigger: string;
  triggerValue?: string;
  autoPlaced: boolean;
  placedAt?: number;
  completedAt?: number;
  createdAt: number;
}

export function StandingOrdersPanel() {
  const orders: StandingOrder[] = [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "LAB":
        return "🧪";
      case "IMAGING":
        return "📊";
      case "MEDICATION":
        return "💊";
      case "PROCEDURE":
        return "🔬";
      default:
        return "📋";
    }
  };

  const pending = orders.filter((o) => o.status === "pending");
  const placed = orders.filter((o) => o.status === "placed");
  const completed = orders.filter((o) => o.status === "completed");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Standing Orders
          </CardTitle>
          <div className="flex gap-1">
            {pending.length > 0 && <Badge variant="outline">{pending.length} pending</Badge>}
            {placed.length > 0 && <Badge className="bg-blue-600">{placed.length} placed</Badge>}
            {completed.length > 0 && <Badge className="bg-green-600">{completed.length} done</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No standing orders for this patient
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending */}
            {pending.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Pending Orders ({pending.length})</h4>
                <div className="space-y-2">
                  {pending.map((order) => (
                    <div key={order._id} className="p-2 border border-yellow-200 rounded-lg bg-yellow-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1">
                          <span className="text-lg">{getTypeIcon(order.orderType)}</span>
                          <div>
                            <p className="font-medium text-sm">{order.orderName}</p>
                            <p className="text-xs text-gray-600">
                              Auto-placed: {order.autoPlaced ? "Yes" : "Manual"} • {order.trigger}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-yellow-600">Pending</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Placed */}
            {placed.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Placed Orders ({placed.length})</h4>
                <div className="space-y-2">
                  {placed.map((order) => (
                    <div key={order._id} className="p-2 border border-blue-200 rounded-lg bg-blue-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1">
                          <span className="text-lg">{getTypeIcon(order.orderType)}</span>
                          <div>
                            <p className="font-medium text-sm">{order.orderName}</p>
                            <p className="text-xs text-gray-600">
                              {order.placedAt ? new Date(order.placedAt).toLocaleTimeString() : "Recently"}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-blue-600">Placed</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Completed ({completed.length})</h4>
                <div className="space-y-2">
                  {completed.map((order) => (
                    <div key={order._id} className="p-2 border border-green-200 rounded-lg bg-green-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1">
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">{order.orderName}</p>
                            <p className="text-xs text-gray-600">
                              {order.completedAt ? new Date(order.completedAt).toLocaleTimeString() : "Completed"}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-green-600">Done</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
