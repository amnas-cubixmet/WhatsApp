export function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function makeOrderNumber() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(2, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WA-${stamp}-${suffix}`;
}
