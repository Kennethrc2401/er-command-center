/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as academicScribe from "../academicScribe.js";
import type * as alerts from "../alerts.js";
import type * as analytics from "../analytics.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as automation from "../automation.js";
import type * as billing from "../billing.js";
import type * as breakGlass from "../breakGlass.js";
import type * as chartDocuments from "../chartDocuments.js";
import type * as checklists from "../checklists.js";
import type * as clinical from "../clinical.js";
import type * as compliance from "../compliance.js";
import type * as consults from "../consults.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as education from "../education.js";
import type * as encounters from "../encounters.js";
import type * as epic from "../epic.js";
import type * as faxes from "../faxes.js";
import type * as imaging from "../imaging.js";
import type * as insurance from "../insurance.js";
import type * as kiosk from "../kiosk.js";
import type * as labs from "../labs.js";
import type * as medications from "../medications.js";
import type * as notes from "../notes.js";
import type * as notifications from "../notifications.js";
import type * as obgyn from "../obgyn.js";
import type * as orScheduler from "../orScheduler.js";
import type * as orders from "../orders.js";
import type * as passkeys from "../passkeys.js";
import type * as patientNormalization from "../patientNormalization.js";
import type * as patients from "../patients.js";
import type * as portal from "../portal.js";
import type * as pos from "../pos.js";
import type * as primaryCare from "../primaryCare.js";
import type * as primaryCareHelpers from "../primaryCareHelpers.js";
import type * as seed from "../seed.js";
import type * as socialHistory from "../socialHistory.js";
import type * as triage from "../triage.js";
import type * as users from "../users.js";
import type * as verifyInsurance from "../verifyInsurance.js";
import type * as vitals from "../vitals.js";
import type * as workflow from "../workflow.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academicScribe: typeof academicScribe;
  alerts: typeof alerts;
  analytics: typeof analytics;
  audit: typeof audit;
  auth: typeof auth;
  automation: typeof automation;
  billing: typeof billing;
  breakGlass: typeof breakGlass;
  chartDocuments: typeof chartDocuments;
  checklists: typeof checklists;
  clinical: typeof clinical;
  compliance: typeof compliance;
  consults: typeof consults;
  crons: typeof crons;
  debug: typeof debug;
  education: typeof education;
  encounters: typeof encounters;
  epic: typeof epic;
  faxes: typeof faxes;
  imaging: typeof imaging;
  insurance: typeof insurance;
  kiosk: typeof kiosk;
  labs: typeof labs;
  medications: typeof medications;
  notes: typeof notes;
  notifications: typeof notifications;
  obgyn: typeof obgyn;
  orScheduler: typeof orScheduler;
  orders: typeof orders;
  passkeys: typeof passkeys;
  patientNormalization: typeof patientNormalization;
  patients: typeof patients;
  portal: typeof portal;
  pos: typeof pos;
  primaryCare: typeof primaryCare;
  primaryCareHelpers: typeof primaryCareHelpers;
  seed: typeof seed;
  socialHistory: typeof socialHistory;
  triage: typeof triage;
  users: typeof users;
  verifyInsurance: typeof verifyInsurance;
  vitals: typeof vitals;
  workflow: typeof workflow;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
