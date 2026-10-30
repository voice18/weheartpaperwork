import { HttpsError } from "firebase-functions/v2/https";

export type ManagedContact = {
  preferredEmail: string;
  preferredPhone: string;
  textPermission: boolean;
};

export function managedContact(input: Record<string, unknown>): ManagedContact {
  const preferredEmail = typeof input.preferredEmail === "string"
    ? input.preferredEmail.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(preferredEmail) || preferredEmail.length > 254)
    throw new HttpsError("invalid-argument", "Enter a valid best contact email.");
  const rawPhone = typeof input.preferredPhone === "string" ? input.preferredPhone.trim() : "";
  if (!/^[+\d\s().-]{10,30}$/.test(rawPhone))
    throw new HttpsError("invalid-argument", "Enter a valid best contact phone number.");
  const digits = rawPhone.replace(/\D/g, "");
  const preferredPhone = digits.length === 10 ? `+1${digits}`
    : digits.length === 11 && digits.startsWith("1") ? `+${digits}`
    : rawPhone.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : "";
  if (!preferredPhone)
    throw new HttpsError("invalid-argument", "Enter a phone number with area code. For numbers outside the U.S., include + and country code.");
  if (typeof input.textPermission !== "boolean")
    throw new HttpsError("invalid-argument", "Choose yes or no for text messages.");
  return { preferredEmail, preferredPhone, textPermission: input.textPermission };
}

export function contactChanged(before: Record<string, unknown>, next: ManagedContact): boolean {
  return before.preferredEmail !== next.preferredEmail
    || before.preferredPhone !== next.preferredPhone
    || before.textPermission !== next.textPermission;
}
