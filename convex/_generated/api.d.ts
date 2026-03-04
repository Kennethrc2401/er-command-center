/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as checklists from "../checklists.js";
import type * as education from "../education.js";
import type * as encounters from "../encounters.js";
import type * as imaging from "../imaging.js";
import type * as labs from "../labs.js";
import type * as medications from "../medications.js";
import type * as notes from "../notes.js";
import type * as patients from "../patients.js";
import type * as seed from "../seed.js";
import type * as socialHistory from "../socialHistory.js";
import type * as triage from "../triage.js";
import type * as vitals from "../vitals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  checklists: typeof checklists;
  education: typeof education;
  encounters: typeof encounters;
  imaging: typeof imaging;
  labs: typeof labs;
  medications: typeof medications;
  notes: typeof notes;
  patients: typeof patients;
  seed: typeof seed;
  socialHistory: typeof socialHistory;
  triage: typeof triage;
  vitals: typeof vitals;
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
