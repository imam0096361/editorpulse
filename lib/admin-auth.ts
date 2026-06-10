import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "editorpulse_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export function getAdminCredentials() {
  return {
    username: getRequiredEnv("ADMIN_USERNAME"),
    password: getRequiredEnv("ADMIN_PASSWORD"),
    secret: getRequiredEnv("ADMIN_SESSION_SECRET"),
  };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(input: string) {
  const bytes = encoder.encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = globalThis.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return decoder.decode(bytes);
}

async function signPayload(payload: string, secret: string) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function timingSafeEqualAsync(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createAdminSessionToken(username: string) {
  const { secret } = getAdminCredentials();
  const issuedAt = Date.now().toString();
  const payload = base64UrlEncode(`${username}:${issuedAt}`);
  const signature = await signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifyAdminSessionToken(token?: string | null) {
  if (!token) return false;

  const { username, secret } = getAdminCredentials();
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = await signPayload(payload, secret);
  if (!(await timingSafeEqualAsync(signature, expected))) return false;

  try {
    const decoded = base64UrlDecode(payload);
    const [tokenUser, issuedAtRaw] = decoded.split(":");
    const issuedAt = Number(issuedAtRaw);
    if (!tokenUser || !Number.isFinite(issuedAt)) return false;
    if (tokenUser !== username) return false;
    if (Date.now() - issuedAt > SESSION_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

export function getAdminSessionCookieValue() {
  return cookies().get(ADMIN_SESSION_COOKIE)?.value || null;
}

export async function isAdminRequestAuthorized(req: NextRequest) {
  return verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function buildAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
