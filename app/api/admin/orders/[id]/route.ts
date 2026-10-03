import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { notifyOrderStatus } from "@/lib/order-notify";

function cookieValue(req: Request, name: string) {
  const cookie = req.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminToken(cookieValue(req, ADMIN_COOKIE))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  const allowed = new Set([
    "PENDING_PAYMENT",
    "CONFIRMED",
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ]);

  if (!allowed.has(String(body.status))) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status: body.status },
  });

  let notification;
  try {
    notification = await notifyOrderStatus(order.id);
  } catch (error) {
    notification = { sent: false, reason: String(error) };
  }

  return NextResponse.json({ order, notification });
}
