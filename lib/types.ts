// lib/types.ts
// ─────────────────────────────────────────────────────────────────────────────
//
//  FIRESTORE DATA MODEL
//  ─────────────────────────────────────────────────────────────────────────
//
//  carriers/                          ← top-level collection
//    {carrierId}/                     ← one doc per carrier company
//      name:          string
//      usdotNumber:   string
//      ownerUid:      string          ← Firebase Auth UID of account owner
//      createdAt:     Timestamp
//
//      compliance/                    ← sub-collection
//        {requirementId}/             ← one doc per requirement (mcs150, etc.)
//          dueDate:       string      ← ISO date "2026-08-31"
//          enteredDate:   string      ← date the user entered (source date)
//          completed:     boolean
//          completedAt:   Timestamp | null
//          lastUpdated:   Timestamp
//          notified30:    boolean     ← has 30-day alert been sent?
//          notified90:    boolean     ← has 90-day alert been sent?
//
//      drivers/                       ← sub-collection (future module)
//        {driverId}/
//          name:          string
//          licenseNumber: string
//          licenseState:  string
//          compliance/
//            {requirementId}/
//              dueDate:   string
//              completed: boolean
//              ...
//
//  users/                             ← top-level collection
//    {uid}/
//      email:      string
//      carrierId:  string             ← links user to their carrier record
//      role:       "owner" | "admin" | "viewer"
//      fcmToken:   string             ← push notification token
//      createdAt:  Timestamp
//
// ─────────────────────────────────────────────────────────────────────────────
//  FIRESTORE SECURITY RULES (firestore.rules)
// ─────────────────────────────────────────────────────────────────────────────
//
//  rules_version = '2';
//  service cloud.firestore {
//    match /databases/{database}/documents {
//
//      // Users can only read/write their own user doc
//      match /users/{uid} {
//        allow read, write: if request.auth.uid == uid;
//      }
//
//      // Carrier doc: owner can read/write; admins can read/write; viewers read-only
//      match /carriers/{carrierId} {
//        allow read:  if isCarrierMember(carrierId);
//        allow write: if isCarrierOwnerOrAdmin(carrierId);
//
//        match /compliance/{reqId} {
//          allow read:  if isCarrierMember(carrierId);
//          allow write: if isCarrierOwnerOrAdmin(carrierId);
//        }
//
//        match /drivers/{driverId} {
//          allow read:  if isCarrierMember(carrierId);
//          allow write: if isCarrierOwnerOrAdmin(carrierId);
//
//          match /compliance/{reqId} {
//            allow read:  if isCarrierMember(carrierId);
//            allow write: if isCarrierOwnerOrAdmin(carrierId);
//          }
//        }
//      }
//
//      function isCarrierMember(carrierId) {
//        return request.auth != null &&
//          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.carrierId == carrierId;
//      }
//
//      function isCarrierOwnerOrAdmin(carrierId) {
//        let role = get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
//        return isCarrierMember(carrierId) && (role == "owner" || role == "admin");
//      }
//    }
//  }
//
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = "owner" | "admin" | "viewer";

export interface UserDoc {
  email:      string;
  carrierId:  string;
  role:       UserRole;
  fcmToken?:  string;
  createdAt:  Date;
}

export interface CarrierDoc {
  name:         string;
  usdotNumber:  string;
  ownerUid:     string;
  createdAt:    Date;
}

export interface ComplianceRecord {
  dueDate:      string | null;   // ISO "YYYY-MM-DD" — calculated next due date
  enteredDate:  string | null;   // ISO "YYYY-MM-DD" — what the user typed in
  completed:    boolean;
  completedAt:  Date | null;
  lastUpdated:  Date;
  notified30:   boolean;         // Cloud Function sets this after sending alert
  notified90:   boolean;
  applicable?: boolean;
}

// Requirement IDs — must match keys in the compliance sub-collection
export type RequirementId =
  | "mcs150"
  | "tax2290"
  | "clearinghouse"
  | "mvr"
  | "fmcsa-portal"
  | "ucr"
  | "ifta"
  | "inspection"
  | "insurance"
  | "medical"
  | "irp"
  | "drug"
  | "boc3"
  | "bizlicense";
