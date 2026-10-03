import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const STOP_WORDS = new Set([
  "stop",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "opt out",
  "optout",
  "do not message",
  "dont message",
  "don't message",
]);

export function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isStopRequest(value: string) {
  return STOP_WORDS.has(normalizeText(value));
}

export function withinCustomerServiceWindow(lastInboundAt?: Date | null) {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() <= 24 * 60 * 60 * 1000;
}

export function verifyMetaSignature(rawBody: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function assertOutboundAllowed(input: {
  waId: string;
  kind: "FREEFORM" | "TEMPLATE";
}) {
  const contact = await prisma.contact.findUnique({ where: { waId: input.waId } });
  if (!contact) throw new Error("CONTACT_NOT_FOUND");
  if (contact.consentStatus === "OPTED_OUT") throw new Error("CONTACT_OPTED_OUT");

  const inside24h = withinCustomerServiceWindow(contact.lastInboundAt);

  // A normal reply is allowed only inside the customer-service window.
  if (input.kind === "FREEFORM" && !inside24h) {
    throw new Error("TEMPLATE_REQUIRED_OUTSIDE_24H");
  }

  // Proactive messaging outside the service window requires a recorded explicit opt-in.
  if (input.kind === "TEMPLATE" && !inside24h && contact.consentStatus !== "OPTED_IN") {
    throw new Error("EXPLICIT_OPT_IN_REQUIRED");
  }

  // Conservative app-level throttle: max 20 outbound attempts/contact/hour.
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.rateEvent.count({
    where: { contactId: contact.id, createdAt: { gte: since } },
  });
  if (recentCount >= 20) throw new Error("RATE_LIMITED");

  await prisma.rateEvent.create({ data: { contactId: contact.id } });
  return contact;
}
