"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ShieldCheck, 
  History, 
  ArrowLeft,
  BarChart4,
  Users2,
  ScrollText,
  FolderCog
} from "lucide-react";
import ShiftHandoffModal from "@/components/mgmt/ShiftHandoffModal";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Command Center", href: "/dashboard/admin", icon: LayoutDashboard },
    { name: "Staff Management", href: "/dashboard/admin/staff", icon: Users2 },
    { name: "Identity Audit", href: "/dashboard/admin/audit", icon: ShieldCheck },
    { name: "Security Audit", href: "/dashboard/admin/security", icon: ScrollText },
    { name: "Documents Policy", href: "/dashboard/admin/documents", icon: FolderCog },
    { name: "Revenue Reports", href: "/dashboard/admin/revenue", icon: BarChart4 },
    { name: "Unit History", href: "/dashboard/admin/history", icon: History },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      {/* SLIM ADMIN SIDEBAR */}
      <aside className="w-20 lg:w-64 bg-slate-900 flex flex-col transition-all duration-300">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-2 bg-blue-600 rounded-xl group-hover:bg-blue-500 transition-colors">
              <ArrowLeft className="h-4 w-4 text-white" />
            </div>
            <span className="hidden lg:block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Back to Clinical
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                    : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "group-hover:scale-110 transition-transform"}`} />
                <span className={`hidden lg:block text-[10px] font-black uppercase tracking-widest ${isActive ? "text-white" : ""}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
              <span className="text-[10px] font-black text-slate-300">SR</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-[9px] font-black text-slate-200 uppercase tracking-tighter leading-none">Sophia Ramirez</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase mt-1 italic">Unit Coordinator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}