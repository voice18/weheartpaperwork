export function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function inputToIso(input: string): string {
  const digits = input.replace(/\D/g, "");

  if (digits.length !== 8) {
    return "";
  }

  const month = Number(digits.slice(0, 2));
  const day = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  if (
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }

  const date = new Date(year, month - 1, day);

  const isRealDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isRealDate) {
    return "";
  }

  const isoYear = String(year).padStart(4, "0");
  const isoMonth = String(month).padStart(2, "0");
  const isoDay = String(day).padStart(2, "0");

  return `${isoYear}-${isoMonth}-${isoDay}`;
}

export function isoToInput(iso: string): string {
  if (!iso) {
    return "";
  }

  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return iso;
  }

  const [, year, month, day] = match;

  return `${month}-${day}-${year}`;
}