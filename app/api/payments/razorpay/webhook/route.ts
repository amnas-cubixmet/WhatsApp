import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhook } from "@/lib/razorpay";
import { notifyOrderStatus } from "@/lib/order-notify";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhook(raw, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(raw);
  const event = String(payload?.event ?? "");
  const linkEntity = payload?.payload?.payment_link?.entity;
  const paymentEntity = payload?.payload?.payment?.entity;

  const orderNumber =
    linkEntity?.reference_id ??
    linkEntity?.notes?.orderNumber ??
    paymentEntity?.notes?.orderNumber ??
    null;

  if (!orderNumber) {
    return NextResponse.json({ received: true, ignored: "NO_ORDER_REFERENCE" });
  }

  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) {
    return NextResponse.json({ received: true, ignored: "ORDER_NOT_FOUND" });
  }

  const eventId = payload?.id ? String(payload.id) : null;
  if (eventId) {
    const duplicate = await prisma.paymentEvent.findUnique({ where: { eventId } });
    if (duplicate) return NextResponse.json({ received: true, duplicate: true });
  }

  await prisma.paymentEvent.create({
    data: {
      orderId: order.id,
      eventId,
      eventType: event,
      payload,
    },
  });

  if (["payment_link.paid", "payment.captured", "order.paid"].includes(event)) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID", status: "CONFIRMED" },
    });

    try {
      await notifyOrderStatus(order.id);
    } catch (error) {
      console.error("Payment confirmation WhatsApp notification failed", error);
    }
  }

  if (["payment.failed", "payment_link.cancelled"].includes(event)) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
  }

  return NextResponse.json({ received: true });
}
