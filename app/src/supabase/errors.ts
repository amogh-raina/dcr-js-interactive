type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function errorParts(error: unknown): SupabaseLikeError {
  if (!error || typeof error !== "object") {
    return {};
  }

  const candidate = error as SupabaseLikeError;
  return {
    code: candidate.code,
    message: candidate.message,
    details: candidate.details,
    hint: candidate.hint,
  };
}

export function persistenceErrorMessage(action: string, error: unknown) {
  const { code, message, details, hint } = errorParts(error);
  const text = [message, details, hint].filter(Boolean).join(" ");
  const normalizedText = text.toLowerCase();

  if (code === "42P01" || normalizedText.includes("does not exist")) {
    return `${action}: database tables are missing. Apply the Supabase persistence migrations.`;
  }

  if (
    code === "42501" ||
    normalizedText.includes("row-level security") ||
    normalizedText.includes("permission denied") ||
    normalizedText.includes("not allowed")
  ) {
    return `${action}: database access was blocked by RLS or table grants. Apply the latest Supabase migrations.`;
  }

  return `${action}: ${message || "database request failed."}`;
}
