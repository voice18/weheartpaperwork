export type IntakeDriver = { name: string; cdlNumber: string; cdlClass: string; cdlState: string;
  cdlExpiration: string; medicalExpiration: string };
export type IntakeVehicle = { type: "truck" | "trailer"; unitNumber: string; vin: string;
  registrationExpiration: string; inspectionExpiration: string };
export type ManagedIntake = { drivers: IntakeDriver[]; vehicles: IntakeVehicle[] };

function clean(value: unknown, limit: number): string {
  if (typeof value !== "string") throw new Error("Enter text in every intake field.");
  const result = value.trim();
  if (result.length > limit || /[\x00-\x1f\x7f]/.test(result)) throw new Error("An intake field has invalid text.");
  return result;
}
function date(value: unknown): string {
  const result = clean(value, 10);
  if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    new Date(result + "T00:00:00Z").toISOString().slice(0, 10) !== result))
    throw new Error("Use YYYY-MM-DD for any dates you know.");
  return result;
}
export function managedIntake(value: unknown, areas: { drivers: boolean; fleet: boolean }): ManagedIntake {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const driverRows = input.drivers ?? [];
  const vehicleRows = input.vehicles ?? [];
  if (!Array.isArray(driverRows) || !Array.isArray(vehicleRows) || driverRows.length > 100 || vehicleRows.length > 200)
    throw new Error("The intake can include up to 100 drivers and 200 vehicles.");
  if ((!areas.drivers && driverRows.length) || (!areas.fleet && vehicleRows.length))
    throw new Error("Only list units in areas you selected.");
  const drivers = driverRows.map(raw => {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const name = clean(row.name, 100);
    const cdlNumber = clean(row.cdlNumber, 40).toUpperCase();
    const cdlClass = clean(row.cdlClass, 1).toUpperCase();
    const cdlState = clean(row.cdlState, 2).toUpperCase();
    if (!name || !cdlNumber || !/^[ABC]$/.test(cdlClass) || !/^[A-Z]{2}$/.test(cdlState))
      throw new Error("Each driver needs a name, CDL number, class A/B/C, and issuing state.");
    return { name, cdlNumber, cdlClass, cdlState,
      cdlExpiration: date(row.cdlExpiration ?? ""), medicalExpiration: date(row.medicalExpiration ?? "") };
  });
  const vehicles = vehicleRows.map(raw => {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const type = row.type;
    const unitNumber = clean(row.unitNumber, 40);
    const vin = clean(row.vin, 40).toUpperCase();
    if ((type !== "truck" && type !== "trailer") || !unitNumber || vin.length < 5)
      throw new Error("Each truck or trailer needs a type, unit number, and VIN or serial number.");
    return { type, unitNumber, vin,
      registrationExpiration: date(row.registrationExpiration ?? ""),
      inspectionExpiration: date(row.inspectionExpiration ?? "") } as IntakeVehicle;
  });
  if (new Set(drivers.map(row => `${row.cdlState}:${row.cdlNumber.replace(/[^A-Z0-9]/g, "")}`)).size !== drivers.length)
    throw new Error("A driver's CDL is listed more than once.");
  if (new Set(vehicles.map(row => row.vin)).size !== vehicles.length)
    throw new Error("A vehicle VIN or serial number is listed more than once.");
  return { drivers, vehicles };
}
