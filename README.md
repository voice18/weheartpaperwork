# Compliance Manager — Setup Guide

## Stack
- **Expo + React Native** — one codebase for web, iOS, Android
- **Firebase Firestore** — real-time database
- **Firebase Auth** — user authentication
- **Firebase Cloud Messaging** — push notifications
- **Firebase Cloud Functions** — automated 30/90/7-day alerts (runs daily)
- **Zustand** — state management

---

## Project Structure

```
compliance-app/
├── app/
│   ├── _layout.tsx              ← Root layout, auth listener
│   ├── (auth)/
│   │   ├── login.tsx            ← Login screen
│   │   └── onboarding.tsx       ← New carrier setup
│   └── (app)/
│       ├── dashboard/
│       │   └── index.tsx        ← Main compliance dashboard ← YOU ARE HERE
│       ├── drivers/
│       │   └── index.tsx        ← Driver-level tracking (next module)
│       └── settings/
│           └── index.tsx        ← USDOT number, notifications, account
├── components/                  ← Shared UI components
├── hooks/                       ← useNotifications, useAuth, etc.
├── lib/
│   ├── firebase.ts              ← Firebase init (put your config here)
│   ├── requirements.ts          ← All compliance logic — shared web + native
│   └── types.ts                 ← TypeScript types + Firestore schema docs
├── store/
│   └── useComplianceStore.ts    ← Zustand store, Firestore reads/writes
└── functions/
    └── src/
        └── index.ts             ← Cloud Functions (daily alert scheduler)
```

---

## Step 1 — Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (e.g. `compliance-manager`)
3. Add a **Web app** — copy the config into `lib/firebase.ts`
4. Enable **Firestore** (start in production mode)
5. Enable **Authentication** → Email/Password (add Google later)
6. Enable **Cloud Messaging**
7. Copy `firestore.rules` from `lib/types.ts` comments into your Firestore rules tab

---

## Step 2 — iOS / Android Push Setup

**iOS:**
1. Go to your Apple Developer account → Certificates → Keys → Create a new APNs key
2. Download the `.p8` file
3. In Firebase console → Project Settings → Cloud Messaging → Apple app config → upload the key

**Android:**
1. Firebase console → Project Settings → Your apps → Add Android app
2. Download `google-services.json` → place in `/compliance-app/google-services.json`

---

## Step 3 — Install & Run

```bash
# Install dependencies
cd compliance-app
npm install

# Run on web
npm run web

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

---

## Step 4 — Deploy Cloud Functions

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (select Functions, Firestore, Hosting)
firebase init

# Deploy functions only
cd functions
npm install
npm run deploy
# or from root:
firebase deploy --only functions

# Deploy web hosting
npm run build:web
firebase deploy --only hosting
```

---

## Firestore Data Model

```
carriers/
  {carrierId}/
    name:          "Acme Trucking"
    usdotNumber:   "1234567"
    ownerUid:      "firebase-auth-uid"

    compliance/
      mcs150/
        dueDate:     "2027-07-31"    ← calculated next due
        enteredDate: null            ← set from USDOT number logic
        completed:   false
        notified30:  false           ← Cloud Function sets after sending
        notified90:  false

      inspection/
        dueDate:     "2027-03-15"    ← enteredDate + 1 year
        enteredDate: "2026-03-15"    ← what user typed in
        completed:   false
        notified30:  false
        notified90:  false

      insurance/
        dueDate:     "2026-09-01"    ← user enters expiration directly
        enteredDate: "2026-09-01"
        completed:   false
        ...

users/
  {uid}/
    email:      "owner@carrier.com"
    carrierId:  "abc123"
    role:       "owner"
    fcmToken:   "expo-push-token-here"
```

---

## Scaling Path

| Stage | What to add |
|---|---|
| **Now** | Single carrier, one user, web + mobile |
| **Next** | Driver module (per-driver medical, MVR, Clearinghouse) |
| **Growth** | Multi-user per carrier (owner + admins + viewers) |
| **Enterprise** | Multi-carrier (fleet management companies, owner-operators) |
| **Revenue** | Subscription tiers via Stripe + Firebase Extensions |

---

## Adding the Web Dashboard

The `compliance_dashboard.jsx` file from Claude becomes a web-only screen.
Drop it into `app/(app)/dashboard/web.tsx` and swap:
- `window.storage.get/set` → calls to `useComplianceStore`
- Hard-coded TODAY → `new Date()`

The `buildReqs` and `urgency` functions in `lib/requirements.ts` are already
shared — import them directly in the dashboard component.
