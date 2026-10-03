import { prisma } from "@/lib/prisma";
import { formatInr } from "@/lib/money";
import { sendTemplate, sendText } from "@/lib/whatsapp";
import { withinCustomerServiceWindow } from "@/lib/whatsapp-safety";

const templateEnv: Record<string, string> = {
  CONFIRMED: "WHATSAPP_TEMPLATE_ORDER_CONFIRMED",
  PROCESSING: "WHATSAPP_TEMPLATE_ORDER_PROCESSING",
  PACKED: "WHATSAPP_TEMPLATE_ORDER_PACKED",
  SHIPPED: "WHATSAPP_TEMPLATE_ORDER_SHIPPED",
  OUT_FOR_DELIVERY: "WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY",
  DELIVERED: "WHATSAPP_TEMPLATE_ORDER_DELIVERED",
};

export async function notifyOrderStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { contact: true },
  });
  if (!order) return { sent: false, reason: "ORDER_NOT_FOUND" };

  const body =
    `Order update ✅\n\n` +
    `Order: ${order.orderNumber}\n` +
    `Status: ${order.status}\n` +
    `Payment: ${order.paymentStatus}\n` +
    `Total: ${formatInr(order.totalPaise)}`;

  if (withinCustomerServiceWindow(order.contact.lastInboundAt)) {
    const result = await sendText({
      to: order.contact.waId,
      type: "text",
      text: { body },
    });

    await prisma.messageAudit.create({
      data: {
        contactId: order.contact.id,
        direction: "OUTBOUND",
        kind: "FREEFORM",
        metaMessageId: result?.messages?.[0]?.id ?? null,
        payload: { text: body, orderId },
        status: "submitted",
      },
    });

    return { sent: true, mode: "freeform" };
  }

  if (order.contact.consentStatus !== "OPTED_IN") {
    return { sent: false, reason: "EXPLICIT_OPT_IN_REQUIRED" };
  }

  const envName = templateEnv[order.status];
  const templateName = envName ? process.env[envName] : undefined;
  if (!templateName) return { sent: false, reason: "TEMPLATE_NOT_CONFIGURED" };

  const result = await sendTemplate({
    to: order.contact.waId,
    type: "template",
    template: {
      name: templateName,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en" },
    },
  });

  await prisma.messageAudit.create({
    data: {
      contactId: order.contact.id,
      direction: "OUTBOUND",
      kind: "TEMPLATE",
      templateName,
      metaMessageId: result?.messages?.[0]?.id ?? null,
      payload: { orderId, status: order.status },
      status: "submitted",
    },
  });

  return { sent: true, mode: "template" };
}
