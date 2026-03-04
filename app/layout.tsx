import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs'

import Navbar from "@/components/Navbar";

import { Providers } from "@/components/ProvidersTemp"; // Import the new component
import StaffHeader from "@/components/StaffHeader";
import { Toaster } from "sonner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// This works now because this is a Server Component!
export const metadata: Metadata = {
  title: "ER Command Center",
  description: "Real-time Emergency Department EHR",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <StaffHeader /> {/* This will now show the Login button */}
            <Navbar />
            <main className="flex-1">
              {children}
              <Toaster position="top-right" richColors closeButton />
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}