"use client";

import { UserButton, SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";

export default function StaffHeader() {
  return (
    <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
      <div className="flex items-center gap-4">
        <span className="font-bold text-slate-800">🏥 Imaginary ER</span>
        <SignedIn>
          <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200">
            System Online
          </Badge>
        </SignedIn>
      </div>

      <div className="flex items-center gap-4">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="text-sm font-semibold text-blue-600 hover:text-blue-800">
              Staff Login
            </button>
          </SignInButton>
        </SignedOut>
        
        <SignedIn>
          {/* This button handles the logout and profile management */}
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </header>
  );
}