import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "wa_admin_session";

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("ADMIN_SESSION_SECRET_MISSING");
  return value;
}

export function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({
    role: "admin",
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  })).toString("base64url");

  const sig = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${sig}`;
}

export function verifyAdminToken(token?: string | null) {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data?.role === "admin" && Number(data?.exp) > Date.now();
  } catch {
    return false;
  }
}

export async function requireAdminPage() {
  const store = await cookies();
  return verifyAdminToken(store.get(COOKIE)?.value);
}

export const ADMIN_COOKIE = COOKIE;
