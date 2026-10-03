import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStopRequest, verifyMetaSignature } from "@/lib/whatsapp-safety";

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
      if (!waId) continue;

      const displayName =
        contacts.find((c: any) => c?.wa_id === waId)?.profile?.name ?? null;

      const text =
        message?.type === "text" ? String(message?.text?.body ?? "") : "";

      const stop = text ? isStopRequest(text) : false;

      const contact = await prisma.contact.upsert({
        where: { waId },
        create: {
          waId,
          displayName,
          lastInboundAt: new Date(),
          consentStatus: stop ? "OPTED_OUT" : "OPTED_IN",
          consentSource: "customer_initiated_whatsapp",
          consentAt: stop ? null : new Date(),
          optedOutAt: stop ? new Date() : null,
        },
        update: {
          displayName,
          lastInboundAt: new Date(),
          ...(stop
            ? { consentStatus: "OPTED_OUT", optedOutAt: new Date() }
            : {}),
        },
      });

      await prisma.messageAudit.create({
        data: {
          contactId: contact.id,
          direction: "INBOUND",
          kind: "FREEFORM",
          metaMessageId: message?.id ?? null,
          payload: message,
          status: "received",
        },
      });
    }

    for (const status of value?.statuses ?? []) {
      const audit = await prisma.messageAudit.findFirst({
        where: { metaMessageId: status?.id },
        orderBy: { createdAt: "desc" },
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
