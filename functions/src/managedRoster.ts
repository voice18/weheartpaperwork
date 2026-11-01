import { createHash } from "node:crypto";
import { ManagedIntake, IntakeDriver, IntakeVehicle } from "./managedIntake";

type Row = { id: string; data: Record<string, unknown> };
type Areas = { drivers: boolean; fleet: boolean };

const driverKey = (state: string, number: string) =>
  `${state.toUpperCase()}:${number.replace(/[^A-Z0-9]/gi, "").toUpperCase()}`;
const unitId = (carrierId: string, kind: "driver" | "vehicle", key: string) =>
  "intake-" + createHash("sha256").update(`${carrierId}:${kind}:${key}`).digest("hex").slice(0, 24);

/** A quote includes existing active units plus verified intake, without creating billable records. */
export function managedRoster(carrierId: string, areas: Areas, intake: ManagedIntake,
  drivers: Row[], vehicles: Row[]) {
  const driverIds: string[] = [];
  const vehicleIds: string[] = [];
  const newDrivers: { id: string; row: IntakeDriver }[] = [];
  const newVehicles: { id: string; row: IntakeVehicle }[] = [];
  if (areas.drivers) {
    const byKey = new Map<string, Row>();
    for (const row of drivers) {
      const key = driverKey(String(row.data.cdlState || ""), String(row.data.cdlNumber || ""));
      if (key !== ":") {
        if (byKey.has(key)) throw new Error("Duplicate CDL records need review before quoting.");
        byKey.set(key, row);
      }
      if (row.data.status !== "inactive") driverIds.push(row.id);
    }
    for (const row of intake.drivers) {
      const key = driverKey(row.cdlState, row.cdlNumber);
      const existing = byKey.get(key);
      if (existing?.data.status === "inactive")
        throw new Error("A listed driver is inactive in the account. Review their status before quoting.");
      if (existing) continue;
      const id = unitId(carrierId, "driver", `${row.cdlState}:${row.cdlNumber}`);
      driverIds.push(id);
      newDrivers.push({ id, row });
    }
  }
  if (areas.fleet) {
    const byVin = new Map<string, Row>();
    for (const row of vehicles) {
      const vin = String(row.data.vin || "").toUpperCase();
      if (vin) {
        if (byVin.has(vin)) throw new Error("Duplicate VIN records need review before quoting.");
        byVin.set(vin, row);
      }
      if (row.data.status !== "inactive") vehicleIds.push(row.id);
    }
    for (const row of intake.vehicles) {
      const existing = byVin.get(row.vin);
      if (existing?.data.status === "inactive")
        throw new Error("A listed vehicle is inactive in the account. Review its status before quoting.");
      if (existing && existing.data.type !== row.type)
        throw new Error("A listed vehicle type differs from the account. Review it before quoting.");
      if (existing) continue;
      const id = unitId(carrierId, "vehicle", row.vin);
      vehicleIds.push(id);
      newVehicles.push({ id, row });
    }
  }
  return {
    driverIds: driverIds.sort(), vehicleIds: vehicleIds.sort(), newDrivers, newVehicles,
    drivers: driverIds.length,
    trucks: areas.fleet ? vehicles.filter(row => row.data.status !== "inactive" && row.data.type !== "trailer").length +
      newVehicles.filter(row => row.row.type === "truck").length : 0,
    trailers: areas.fleet ? vehicles.filter(row => row.data.status !== "inactive" && row.data.type === "trailer").length +
      newVehicles.filter(row => row.row.type === "trailer").length : 0,
  };
}
