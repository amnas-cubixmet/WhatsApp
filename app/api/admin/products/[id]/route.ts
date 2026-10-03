import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

function authorized(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(ADMIN_COOKIE + "="))
    ?.slice(ADMIN_COOKIE.length + 1);
  return verifyAdminToken(token);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl ? String(body.imageUrl) : null } : {}),
      ...(body.pricePaise !== undefined ? { pricePaise: Number(body.pricePaise) } : {}),
      ...(body.stockQty !== undefined ? { stockQty: Number(body.stockQty) } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null } : {}),
    },
  });

  return NextResponse.json(product);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await prisma.product.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
