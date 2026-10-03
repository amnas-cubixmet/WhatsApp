import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const body = await req.json();
  const product = await prisma.product.create({
    data: {
      name: String(body.name),
      description: body.description ? String(body.description) : null,
      pricePaise: Number(body.pricePaise),
    },
  });
  return NextResponse.json(product, { status: 201 });
}
