import { access } from "node:fs/promises";
import path from "node:path";

const requiredRouteFiles = [
  "app/page.tsx",
  "app/staff-login/page.tsx",
  "app/kiosk/page.tsx",
  "app/dashboard/triage/page.tsx",
  "app/dashboard/faxes/page.tsx",
  "app/dashboard/admin/page.tsx",
  "app/dashboard/admin/documents/page.tsx",
  "app/patient/[id]/page.tsx",
];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const root = process.cwd();
  const checks = await Promise.all(
    requiredRouteFiles.map(async (relativePath) => {
      const absolutePath = path.join(root, relativePath);
      const exists = await fileExists(absolutePath);
      return { relativePath, exists };
    })
  );

  const missing = checks.filter((entry) => !entry.exists);

  if (missing.length > 0) {
    console.error("Critical route check failed. Missing files:");
    for (const entry of missing) {
      console.error(`- ${entry.relativePath}`);
    }
    process.exit(1);
  }

  console.log(`Critical route check passed (${checks.length} routes).`);
}

main().catch((error) => {
  console.error("Critical route check failed with an unexpected error.");
  console.error(error);
  process.exit(1);
});
