import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

type Rollout = { enabled?: unknown; public?: unknown; pilotCarrierIds?: unknown };

/** Staging is open for tests. Production is closed until explicitly enabled. */
export function managedSupportAvailable(projectId: string | undefined, config: Rollout, carrierId?: string): boolean {
  if (projectId === "weheartpaperwork-staging") return true;
  if (config.enabled !== true) return false;
  if (config.public === true) return true;
  return !!carrierId && Array.isArray(config.pilotCarrierIds) && config.pilotCarrierIds.includes(carrierId);
}

function projectId(): string | undefined {
  return process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId;
}

export async function isManagedSupportAvailable(carrierId?: string): Promise<boolean> {
  const project = projectId();
  if (project === "weheartpaperwork-staging") return true;
  const config = await admin.firestore().collection("serviceConfig").doc("managedSupport").get();
  return managedSupportAvailable(project, config.data() ?? {}, carrierId);
}

export async function requireManagedSupportAvailable(carrierId: string): Promise<void> {
  if (!await isManagedSupportAvailable(carrierId))
    throw new HttpsError("failed-precondition", "Managed support is not available for this account yet. Your app access is unchanged.");
}

export const getManagedSupportAvailability = onCall({ region: "us-central1" }, async request => ({
  available: await isManagedSupportAvailable(request.auth?.uid),
}));
