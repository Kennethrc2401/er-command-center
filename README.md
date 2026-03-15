🏥 ER Command Center: Unit 4B Triage System
A Clinical Operating System for Emergency Department Management & Triage Education.

🩺 Project Overview
The ER Command Center is a full-stack clinical dashboard designed to streamline the flow of an Emergency Department. Built with a focus on the ESI (Emergency Severity Index) triage algorithm used at Hackensack Meridian Health, this application provides real-time situational awareness for CCMAs, Nurses, and Charge Doctors.

🌟 Key Clinical Features
Live Triage Queue: Real-time patient census with automated wait-time tracking and acuity-based sorting.

Big-Board Monitor View: A high-contrast, dark-mode interface designed for unit station monitors, featuring Ambulance Diversion alerts when the unit reaches 90% capacity.

Interactive EKG Telemetry: Live waveform simulation for high-acuity patients (ESI 1 & 2) to visualize cardiac distress.

Smart Documentation: Template-driven clinical notes (Chest Pain, SOB, Abdominal Pain) to ensure standardized charting.

SBAR Handoff Exporter: Generates professional PDF Shift Reports for end-of-shift handoffs between clinical teams.

Privacy Mode: A "HIPAA-Ready" toggle that anonymizes patient names and MRNs for public presentations and clinical demos.

🎓 Staff Training Suite
Designed for FDU Clinical Students, the integrated Training Center includes:

Triage Master Class Quiz: A scenario-based flashcard system to practice ESI level assignment.

Interactive ESI Wizard: A step-by-step decision support tool based on the official ESI handbook.

Clinical Reference Guide: Instant access to normal lab values (WBC, Potassium, Hgb) and "Panic" level thresholds.

💻 Technical Stack
Frontend: Next.js 15 (App Router), Tailwind CSS, Lucide React (Icons), Radix UI.

Backend & Real-time: Convex (Reactive Database & Mutations).

Authentication: Clerk (Provider-grade secure login).

PDF Generation: jsPDF & AutoTable.

State Management: Zustand (Presentation & Privacy logic).

🚀 Getting Started
Clone the repo: git clone https://github.com/Kennethrc2401/er-command-center.git

Install dependencies: npm install

Environment Variables: Create a .env.local with your NEXT_PUBLIC_CONVEX_URL and Clerk credentials.

Passkey Environment Variables (for Windows Hello / Face ID / Touch ID):
- `PASSKEY_RP_NAME` (optional, default: `Nexus ER Triage`)
- `PASSKEY_RP_ID` (recommended in production, your domain only, e.g. `app.yourhospital.org`)
- `PASSKEY_ALLOWED_ORIGINS` (recommended in production, comma-separated full origins, e.g. `https://app.yourhospital.org`)
- `STAFF_PASSKEY_CHALLENGE_SECRET` (required for production, long random secret)
- `STAFF_AUTH_SESSION_SECRET` (required for production, long random secret)

Launch the System: npm run dev

🛡️ Disclaimer & Privacy
This application is a Clinical Simulation Tool created for educational purposes at Fairleigh Dickinson University. It is not intended for the storage of real Protected Health Information (PHI) in a live clinical environment.



This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
