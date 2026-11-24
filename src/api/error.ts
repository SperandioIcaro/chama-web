export function getErrorMessage(e: unknown, fallback = "Algo deu errado. Tente de novo.") {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}
