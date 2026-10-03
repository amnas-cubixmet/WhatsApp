import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/bot";
import {
  isStopRequest,
  normalizeText,
  verifyMetaSignature,
} from "@/lib/whatsapp-safety";

function extractText(message: any) {
  if (message?.type === "text") return String(message?.text?.body ?? "");
  if (message?.type === "interactive") {
    return String(
      message?.interactive?.button_reply?.id ??
        message?.interactive?.button_reply?.title ??
        message?.interactive?.list_reply?.id ??
        message?.interactive?.list_reply?.title ??
        ""
    );
  }
  return "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();

  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(raw);
  const changes = payload?.entry?.flatMap((e: any) => e?.changes ?? []) ?? [];

  for (const change of changes) {
    const value = change?.value;
    const messages = value?.messages ?? [];
    const contacts = value?.contacts ?? [];

    for (const message of messages) {
      const waId = String(message?.from ?? "");
      const metaMessageId = message?.id ? String(message.id) : null;
      if (!waId) continue;

      if (metaMessageId) {
        const duplicate = await prisma.messageAudit.findUnique({
          where: { metaMessageId },
        });
        if (duplicate) continue;
      }

      const displayName =
        contacts.find((c: any) => c?.wa_id === waId)?.profile?.name ?? null;

      const text = extractText(message);
      const normalized = normalizeText(text);
      const stop = text ? isStopRequest(text) : false;
      const explicitOptIn = ["opt in", "yes updates", "yes, updates"].includes(normalized);
      const now = new Date();

      const contact = await prisma.contact.upsert({
        where: { waId },
        create: {
          waId,
          displayName,
          lastInboundAt: now,
          consentStatus: stop ? "OPTED_OUT" : explicitOptIn ? "OPTED_IN" : "PENDING",
          consentSource: explicitOptIn ? "whatsapp_explicit_keyword" : null,
          consentAt: explicitOptIn ? now : null,
          optedOutAt: stop ? now : null,
        },
        update: {
          displayName,
          lastInboundAt: now,
          ...(stop
            ? {
                consentStatus: "OPTED_OUT",
                optedOutAt: now,
              }
            : explicitOptIn
              ? {
                  consentStatus: "OPTED_IN",
                  consentSource: "whatsapp_explicit_keyword",
                  consentAt: now,
                  optedOutAt: null,
                }
              : {}),
        },
      });

      await prisma.messageAudit.create({
        data: {
          contactId: contact.id,
          direction: "INBOUND",
          kind: "FREEFORM",
          metaMessageId,
          payload: message,
          status: "received",
        },
      });

      if (stop) {
        await prisma.conversationSession.upsert({
          where: { contactId: contact.id },
          create: { contactId: contact.id, state: "MENU", data: {} },
          update: { state: "MENU", data: {} },
        });
        continue;
      }

      try {
        await handleIncomingMessage({
          contactId: contact.id,
          waId,
          text,
        });
      } catch (error) {
        console.error("Bot handling failed", error);
      }
    }

    for (const status of value?.statuses ?? []) {
      const metaMessageId = status?.id ? String(status.id) : "";
      if (!metaMessageId) continue;

      const audit = await prisma.messageAudit.findUnique({
        where: { metaMessageId },
      });

      if (audit) {
        await prisma.messageAudit.update({
          where: { id: audit.id },
          data: { status: String(status?.status ?? "unknown") },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
