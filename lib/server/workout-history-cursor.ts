export type WorkoutHistoryCursor = {
  v: 1;
  startedAt: number;
  id: string;
};

export class WorkoutHistoryCursorError extends Error {
  constructor(message = "训练历史游标无效") {
    super(message);
    this.name = "WorkoutHistoryCursorError";
  }
}

function assertCursor(value: unknown): asserts value is WorkoutHistoryCursor {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new WorkoutHistoryCursorError();
  const cursor = value as Record<string, unknown>;
  if (
    cursor.v !== 1 ||
    !Number.isSafeInteger(cursor.startedAt) ||
    Number(cursor.startedAt) <= 0 ||
    typeof cursor.id !== "string" ||
    cursor.id.length === 0 ||
    cursor.id.length > 128
  ) {
    throw new WorkoutHistoryCursorError();
  }
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string): string {
  if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/u.test(value))
    throw new WorkoutHistoryCursorError();
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    return new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  } catch {
    throw new WorkoutHistoryCursorError();
  }
}

export function encodeWorkoutHistoryCursor(
  cursor: WorkoutHistoryCursor,
): string {
  assertCursor(cursor);
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeWorkoutHistoryCursor(
  value: string,
): WorkoutHistoryCursor {
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    assertCursor(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof WorkoutHistoryCursorError) throw error;
    throw new WorkoutHistoryCursorError();
  }
}
