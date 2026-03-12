import { EkgLoader } from "@/components/ui/EkgLoader";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#020617_0%,#0f172a_45%,#0b1120_100%)] px-6">
      <EkgLoader message="Stabilizing page data..." className="max-w-2xl" />
    </main>
  );
}