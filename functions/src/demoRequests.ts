import * as admin from "firebase-admin";
import { createHash, randomUUID } from "node:crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { OWNER_EMAIL } from "./ownerNotifications";

const HOUR_MS = 60 * 60 * 1000;
const EMAIL_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_IP_HOUR = 5;

function field(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength * 4) return "";
  return value.replace(/\s+/g, " ").trim();
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const submitDemoRequest = onCall(
  { region: "us-central1", maxInstances: 10 },
  async request => {
    // A hidden form field catches basic automated submissions without making a
    // legitimate visitor solve a challenge.
    if (field(request.data?.website, 100)) return { status: "received" };

    const name = field(request.data?.name, 100);
    const email = field(request.data?.email, 254).toLowerCase();
    const address = field(request.data?.address, 250);
    const phone = field(request.data?.phone, 40);

    if (name.length < 2 || name.length > 100) {
      throw new HttpsError("invalid-argument", "Enter your name.");
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Enter a valid email address.");
    }
    if (address.length < 5 || address.length > 250) {
      throw new HttpsError("invalid-argument", "Enter your company address.");
    }
    if (phone && (phone.length > 40 || !/^[+().\-\s\d]{7,40}$/.test(phone))) {
      throw new HttpsError("invalid-argument", "Check the phone number or leave it blank.");
    }

    const db = admin.firestore();
    const now = Date.now();
    const emailRateRef = db.collection("demoRequestEmailCooldowns").doc(digest(email));
    const ip = String(request.rawRequest.ip || "").trim();
    const ipRateRef = ip
      ? db.collection("demoRequestRateLimits").doc(digest(ip))
      : null;
    const id = randomUUID();
    const demoRef = db.collection("demoRequests").doc(id);
    const mailRef = db.collection("mail").doc(`demo_${id}`);

    await db.runTransaction(async transaction => {
      const emailRate = await transaction.get(emailRateRef);
      const ipRate = ipRateRef ? await transaction.get(ipRateRef) : null;
      const lastEmailAt = Number(emailRate.data()?.lastSubmittedAtMs || 0);
      if (now - lastEmailAt < EMAIL_COOLDOWN_MS) return;

      const windowStart = Number(ipRate?.data()?.windowStartMs || 0);
      const withinWindow = now - windowStart < HOUR_MS;
      const count = withinWindow ? Number(ipRate?.data()?.count || 0) : 0;
      if (ipRateRef && count >= MAX_REQUESTS_PER_IP_HOUR) {
        throw new HttpsError("resource-exhausted", "Please try again later or email us directly.");
      }

      transaction.set(emailRateRef, { lastSubmittedAtMs: now });
      if (ipRateRef) {
        transaction.set(ipRateRef, {
          windowStartMs: withinWindow ? windowStart : now,
          count: count + 1,
        });
      }
      transaction.create(demoRef, {
        name,
        email,
        address,
        phone: phone || null,
        status: "new",
        source: "website_demo_form",
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.create(mailRef, {
        to: [OWNER_EMAIL],
        category: "demo_request",
        demoRequestId: id,
        message: {
          subject: `Demo request from ${name}`,
          text: `A visitor requested a We Heart Paperwork demo.\n\nName: ${name}\nEmail: ${email}\nCompany address: ${address}\nPhone: ${phone || "Not provided"}\n\nReply to the visitor at ${email}.`,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { status: "received" };
  },
);
