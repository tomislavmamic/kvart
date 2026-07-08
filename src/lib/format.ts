const formatter = new Intl.DateTimeFormat("hr-HR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(date: Date): string {
  return formatter.format(date);
}
