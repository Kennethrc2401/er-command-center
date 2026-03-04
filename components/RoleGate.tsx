"use client";

import { useUser } from "@clerk/nextjs";
import { AlertCircle, Lock } from "lucide-react";

interface RoleGateProps {
  children: React.ReactNode;
  allowedRole: "doctor" | "nurse" | "admin";
}

export default function RoleGate({ children, allowedRole }: RoleGateProps) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;

  // Check the publicMetadata we set in the Clerk Dashboard
  const userRole = user?.publicMetadata?.role as string;

  if (userRole !== allowedRole) {
    return (
      <div className="p-6 border-2 border-dashed border-red-200 rounded-xl bg-red-50 flex flex-col items-center text-center space-y-3">
        <div className="p-3 bg-red-100 rounded-full text-red-600">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-red-900">Privilege Restricted</h3>
          <p className="text-sm text-red-700 max-w-xs">
            This clinical action requires <strong>{allowedRole}</strong> credentials. 
            Your current role is logged as <strong>{userRole || "Guest"}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}