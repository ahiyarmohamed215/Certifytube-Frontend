export function formatAdminDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

export function formatAdminPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const normalized = value > 1 ? value : value * 100;
  return `${Math.round(normalized)}%`;
}

export function formatAdminSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function humanizeAdminKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function prettyPrintJson(value: unknown): string {
  const parsed = tryParseJson(value);
  if (typeof parsed === "string") return parsed;
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(parsed);
  }
}

export function normalizeUnknownArray(value: unknown): unknown[] {
  const parsed = tryParseJson(value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed == null) return [];
  return [parsed];
}

export function normalizeRecord(value: unknown): Record<string, unknown> | null {
  const parsed = tryParseJson(value);
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return null;
}

export function stringifyPrimitive(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-";
    return `${value}`;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return prettyPrintJson(value);
}

export function normalizeOptions(value: unknown): Array<{ key: string; label: string }> {
  const parsed = tryParseJson(value);
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return Object.entries(parsed).map(([key, optionValue]) => ({
      key,
      label: typeof optionValue === "string" ? `${key}. ${optionValue}` : `${key}: ${stringifyPrimitive(optionValue)}`,
    }));
  }

  const items = normalizeUnknownArray(parsed);
  if (items.length === 0) return [];

  return items.map((item, index) => {
    if (typeof item === "string") {
      return { key: `${index}-${item}`, label: item };
    }

    if (typeof item === "number" || typeof item === "boolean") {
      return { key: `${index}-${item}`, label: String(item) };
    }

    const record = normalizeRecord(item);
    if (record) {
      const label = typeof record.label === "string"
        ? record.label
        : typeof record.text === "string"
          ? record.text
          : typeof record.value === "string" || typeof record.value === "number"
            ? String(record.value)
            : prettyPrintJson(record);
      const key = typeof record.id === "string" || typeof record.id === "number"
        ? String(record.id)
        : `${index}-${label}`;
      return { key, label };
    }

    return { key: `${index}-item`, label: prettyPrintJson(item) };
  });
}

export function resolveQuizAnswer(answers: unknown, question: {
  questionUid?: string | null;
  id?: number | null;
  positionIndex?: number | null;
}): string {
  const record = normalizeRecord(answers);
  if (!record) return stringifyPrimitive(tryParseJson(answers));

  const candidates = [
    question.questionUid,
    question.id != null ? String(question.id) : null,
    question.positionIndex != null ? String(question.positionIndex) : null,
  ].filter((value): value is string => Boolean(value));

  for (const key of candidates) {
    if (key in record) {
      return stringifyPrimitive(record[key]);
    }
  }

  return prettyPrintJson(record);
}
