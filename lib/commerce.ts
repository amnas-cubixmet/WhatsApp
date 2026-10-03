import { prisma } from "@/lib/prisma";
import { makeOrderNumber } from "@/lib/money";
import { createPaymentLink } from "@/lib/razorpay";

export async function getOrCreateCart(contactId: string) {
  return prisma.cart.upsert({
    where: { contactId },
    create: { contactId },
    update: {},
    include: { items: { include: { product: true } } },
  });
}

export async function addToCart(contactId: string, productId: string, quantity: number) {
  const cart = await getOrCreateCart(contactId);
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product || !product.active) throw new Error("PRODUCT_NOT_FOUND");
  if (quantity < 1 || quantity > 99) throw new Error("INVALID_QUANTITY");
  if (product.stockQty < quantity) throw new Error("INSUFFICIENT_STOCK");

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity },
    update: { quantity: { increment: quantity } },
  });

  return getOrCreateCart(contactId);
}

export async function cartSummary(contactId: string) {
  const cart = await getOrCreateCart(contactId);
  const subtotalPaise = cart.items.reduce(
    (sum, item) => sum + item.product.pricePaise * item.quantity,
    0
  );
  return { cart, subtotalPaise };
}

export async function clearCart(contactId: string) {
  const cart = await prisma.cart.findUnique({ where: { contactId } });
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}

export async function createOrderFromCart(input: {
  contactId: string;
  customerName: string;
  phone: string;
  addressLine: string;
  pincode: string;
}) {
  const { cart, subtotalPaise } = await cartSummary(input.contactId);
  if (!cart.items.length) throw new Error("CART_EMPTY");

  const deliveryPaise = Number(process.env.DELIVERY_FEE_PAISE ?? "0");
  const totalPaise = subtotalPaise + deliveryPaise;

  const order = await prisma.$transaction(async (tx) => {
    for (const item of cart.items) {
      if (!item.product.active || item.product.stockQty < item.quantity) {
        throw new Error(`OUT_OF_STOCK:${item.product.name}`);
      }
    }

    const created = await tx.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        contactId: input.contactId,
        subtotalPaise,
        deliveryPaise,
        totalPaise,
        customerName: input.customerName,
        phone: input.phone,
        addressLine: input.addressLine,
        pincode: input.pincode,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            productName: item.product.name,
            sku: item.product.sku,
            pricePaise: item.product.pricePaise,
            quantity: item.quantity,
            lineTotalPaise: item.product.pricePaise * item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { decrement: item.quantity } },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  });

  try {
    const link = await createPaymentLink({
      orderNumber: order.orderNumber,
      amountPaise: order.totalPaise,
      customerName: order.customerName,
      phone: order.phone,
    });

    return prisma.order.update({
      where: { id: order.id },
      data: {
        razorpayLinkId: link.id,
        razorpayLinkUrl: link.short_url,
      },
      include: { items: true },
    });
  } catch (error) {
    return { ...order, razorpayLinkId: null, razorpayLinkUrl: null, paymentError: String(error) };
  }
}
