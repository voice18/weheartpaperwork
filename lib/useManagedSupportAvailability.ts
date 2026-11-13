import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";

/** Closed while loading or if the rollout service cannot be reached. */
export function useManagedSupportAvailability(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, () => {
      const current = ++generation;
      setAvailable(null);
      void httpsCallable<Record<string, never>, { available: boolean }>(functions, "getManagedSupportAvailability")({})
        .then(result => { if (generation === current) setAvailable(result.data.available === true); })
        .catch(() => { if (generation === current) setAvailable(false); });
    });
    return () => { generation++; unsubscribe(); };
  }, []);
  return available;
}
