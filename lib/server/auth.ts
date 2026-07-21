import { env } from "cloudflare:workers";
import { ensureDatabase, getD1 } from "@/db";

const sessionCookie = "lianji_session";
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;
// Cloudflare Workers WebCrypto currently caps PBKDF2 at 100,000 iterations.
const passwordIterations = 100_000;

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  createdAt: number;
};

type SessionUserRow = {
  id: string;
  username: string;
  display_name: string;
  created_at: number;
  session_id: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: passwordIterations },
    key,
    256,
  );
  return `pbkdf2_sha256$${passwordIterations}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(result))}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, expectedText] = encoded.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2_sha256" || !Number.isInteger(iterations) || iterations < 100_000 || !saltText || !expectedText) return false;

  const salt = new Uint8Array(base64UrlToBytes(saltText));
  const expected = base64UrlToBytes(expectedText);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, expected.length * 8));
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim().toLocaleLowerCase("zh-CN");
  if (!/^(?=.{3,24}$)[\p{L}\p{N}_]+$/u.test(username)) return null;
  return username;
}

export function validatePassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase().replaceAll(" ", "");
  return code.length >= 8 && code.length <= 64 ? code : null;
}

export function publicUser(row: { id: string; username: string; display_name: string; created_at: number }): AuthUser {
  return { id: row.id, username: row.username, displayName: row.display_name, createdAt: row.created_at };
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const segment of header.split(";")) {
    const [key, ...parts] = segment.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return null;
}

function cookieHeader(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionDurationMs / 1000}${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function createSession(userId: string, request: Request): Promise<string> {
  await ensureDatabase();
  const database = getD1();
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = Date.now();
  await database.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), userId, tokenHash, now + sessionDurationMs, now, now).run();
  return cookieHeader(token, request);
}

export async function getSessionUser(request: Request): Promise<AuthUser | null> {
  const token = readCookie(request, sessionCookie);
  if (!token) return null;

  await ensureDatabase();
  const database = getD1();
  const tokenHash = await sha256(token);
  const now = Date.now();
  const row = await database.prepare(
    `SELECT users.id, users.username, users.display_name, users.created_at, sessions.id AS session_id
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
  ).bind(tokenHash, now).first<SessionUserRow>();
  if (!row) return null;

  await database.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(now, row.session_id).run();
  return publicUser(row);
}

export async function deleteSession(request: Request): Promise<void> {
  const token = readCookie(request, sessionCookie);
  if (!token) return;
  await ensureDatabase();
  await getD1().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export function bootstrapInviteCode(): string | null {
  const runtimeEnv = env as unknown as { LIANJI_BOOTSTRAP_INVITE_CODE?: string };
  return normalizeInviteCode(runtimeEnv.LIANJI_BOOTSTRAP_INVITE_CODE);
}

export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let value = "LJ-";
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return `${value.slice(0, 7)}-${value.slice(7)}`;
}
