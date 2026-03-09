📖 Clinical User Guide: ER Command Center (Unit 4B)
Role Focus: Certified Clinical Medical Assistant (CCMA) / Triage Technician

System Type: Real-Time Clinical Operating System (COS)

🚦 1. The Triage Workflow (ESI Standard)
The system is built on the Emergency Severity Index (ESI) 5-level triage algorithm.

Intake: Upon patient arrival, the CCMA initiates an "Encounter."

Acuity Assignment: Using the ESI Wizard, the user determines the patient's level.

ESI 1-2 (Red): Immediate life-threat or high-risk. Triggers the EKG Telemetry and pulses on the Big Board.

ESI 3-5 (Blue): Stable/Minor. Monitored for "Wait-Time Breach" (standard > 60 mins).

Safety Net: The isUnstable logic automatically flags vitals (Tachycardia, Hypoxia, Hypotension) regardless of the assigned ESI, ensuring no patient "crashes" in the waiting room.

🛡️ 2. Administrative & Revenue Integrity
Unlike a basic "To-Do" list, this system includes a Mock Eligibility Engine.

Insurance Verification: Within the Vitals Tab, the CCMA can view the "Scanned Insurance Card" (Document Imaging).

Real-Time Check: Clicking "Verify" simulates a 270/271 HIPAA Eligibility Transaction.

Dashboard Impact: The "Insurance Tasks" counter on the main dashboard alerts the front-desk team to pending administrative work, preventing "Bad Debt" before discharge.

📈 3. Clinical Monitoring & Data Flow
Vitals Trending: The system doesn't just show the last BP; it shows the trend. This allows a CCMA to notice if a patient’s BP is slowly dropping over a 4-hour stay.

Smart Notes: The "AI-Powered Narrative" generator converts structured data (HR, BP, CC) into a professional clinical note, reducing the documentation burden on the nursing staff.

Telemetry Monitor: High-acuity patients are displayed with a live EKG waveform simulation to maintain "Visual Awareness" of the unit's sickest patients.

📤 4. Care Transitions (The SBAR Handoff)
The most dangerous time for a patient is the "Shift Change."

SBAR Exporter: The system aggregates Vitals, Labs, and GCS scores into a standardized SBAR (Situation, Background, Assessment, Recommendation) PDF.

Discharge Packet: For stable patients, the system generates a "Patient-Facing" packet including follow-up appointment details, cardiology instructions, and a plain-language discharge summary.

🛠️ 5. Deployment & Technical Specs
Backend: Convex (NoSQL Reactive Database).

Frontend: Next.js 15 + Tailwind CSS + Radix UI.

Security: Presentation Mode (HIPAA-compliant demo toggle).