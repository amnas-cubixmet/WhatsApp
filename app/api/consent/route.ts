import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertInternalApiKey } from "@/lib/internal-auth";

export async function POST(req: Request) {
  try {
    assertInternalApiKey(req);

    const body = await req.json();
    const waId = String(body.waId ?? "");
    const action = String(body.action ?? "");
    const source = String(body.source ?? "explicit_opt_in");

    if (!/^\d{8,15}$/.test(waId)) {
      return NextResponse.json({ error: "Invalid WhatsApp number" }, { status: 400 });
    }

    if (!["opt_in", "opt_out"].includes(action)) {
      return NextResponse.json({ error: "action must be opt_in or opt_out" }, { status: 400 });
    }

    const now = new Date();

    const contact = await prisma.contact.upsert({
      where: { waId },
      create: {
        waId,
        consentStatus: action === "opt_in" ? "OPTED_IN" : "OPTED_OUT",
        consentSource: source,
        consentAt: action === "opt_in" ? now : null,
        optedOutAt: action === "opt_out" ? now : null,
      },
      update: {
        consentStatus: action === "opt_in" ? "OPTED_IN" : "OPTED_OUT",
        consentSource: source,
        consentAt: action === "opt_in" ? now : null,
        optedOutAt: action === "opt_out" ? now : null,
      },
    });

    return NextResponse.json({
      ok: true,
      waId: contact.waId,
      consentStatus: contact.consentStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
