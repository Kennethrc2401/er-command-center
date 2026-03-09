import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/ProvidersTemp";
import AuthUIWrapper from "@/components/auth/AuthUIWrapper";
import { Toaster } from "sonner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// ✅ Valid: Metadata stays in a Server Component
export const metadata: Metadata = {
  title: "ER Command Center",
  description: "Real-time Emergency Department EHR",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* 1. Providers establish the Auth context */}
        <Providers>
          <div className="min-h-screen flex flex-col">
            
            {/* 2. Wrapper consumes the Auth context */}
            <AuthUIWrapper>
              {children}
            </AuthUIWrapper>
            
            <Toaster position="top-right" richColors closeButton />
          </div>
        </Providers>
      </body>
    </html>
  );
}