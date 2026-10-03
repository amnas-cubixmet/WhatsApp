import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertInternalApiKey } from "@/lib/internal-auth";
import { assertOutboundAllowed } from "@/lib/whatsapp-safety";
import { sendTemplate, sendText } from "@/lib/whatsapp";

export async function POST(req: Request) {
  try {
    assertInternalApiKey(req);

    const body = await req.json();
    const to = String(body.to ?? "");
    const kind = body.kind === "template" ? "TEMPLATE" : "FREEFORM";

    if (!/^\d{8,15}$/.test(to)) {
      return NextResponse.json({ error: "Invalid WhatsApp number" }, { status: 400 });
    }

    const contact = await assertOutboundAllowed({ waId: to, kind });

    let result;
    if (kind === "TEMPLATE") {
      if (!body.templateName || !body.languageCode) {
        return NextResponse.json(
          { error: "templateName and languageCode required" },
          { status: 400 }
        );
      }

      result = await sendTemplate({
        to,
        type: "template",
        template: {
          name: body.templateName,
          language: { code: body.languageCode },
          components: body.components,
        },
      });
    } else {
      const text = String(body.text ?? "").trim();
      if (!text) {
        return NextResponse.json({ error: "text required" }, { status: 400 });
      }

      result = await sendText({
        to,
        type: "text",
        text: { body: text },
      });
    }

    await prisma.messageAudit.create({
      data: {
        contactId: contact.id,
        direction: "OUTBOUND",
        kind,
        templateName: kind === "TEMPLATE" ? body.templateName : null,
        metaMessageId: result?.messages?.[0]?.id ?? null,
        payload: body,
        status: "submitted",
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    const status =
      message === "UNAUTHORIZED" ? 401 :
      message === "CONTACT_OPTED_OUT" ? 403 :
      message === "EXPLICIT_OPT_IN_REQUIRED" ? 403 :
      message === "TEMPLATE_REQUIRED_OUTSIDE_24H" ? 409 :
      message === "RATE_LIMITED" ? 429 :
      message === "CONTACT_NOT_FOUND" ? 404 :
      500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
