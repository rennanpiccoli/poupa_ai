// Display helpers (pt-PT). Pure.
export const eur = (cents: number) =>
  (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

/** "hoje", "ontem", "há 3 dias" */
export function seenLabel(iso: string | Date | undefined, now = new Date()): string {
  if (!iso) return "";
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(new Date(iso))) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}
