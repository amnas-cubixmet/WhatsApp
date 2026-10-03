import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertInternalApiKey } from "@/lib/internal-auth";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  try {
    assertInternalApiKey(req);

    const body = await req.json();
    const product = await prisma.product.create({
      data: {
        name: String(body.name),
        description: body.description ? String(body.description) : null,
        pricePaise: Number(body.pricePaise),
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
