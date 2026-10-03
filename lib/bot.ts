import { prisma } from "@/lib/prisma";
import { addToCart, cartSummary, createOrderFromCart } from "@/lib/commerce";
import { formatInr } from "@/lib/money";
import { assertOutboundAllowed, normalizeText } from "@/lib/whatsapp-safety";
import { sendText } from "@/lib/whatsapp";

type SessionData = {
  categoryIds?: string[];
  productIds?: string[];
  selectedProductId?: string;
  customerName?: string;
  addressLine?: string;
  pincode?: string;
};

async function reply(contactId: string, waId: string, body: string) {
  await assertOutboundAllowed({ waId, kind: "FREEFORM" });
  const result = await sendText({ to: waId, type: "text", text: { body } });

  await prisma.messageAudit.create({
    data: {
      contactId,
      direction: "OUTBOUND",
      kind: "FREEFORM",
      metaMessageId: result?.messages?.[0]?.id ?? null,
      payload: { text: body },
      status: "submitted",
    },
  });
}

async function setSession(contactId: string, state: string, data: SessionData = {}) {
  return prisma.conversationSession.upsert({
    where: { contactId },
    create: { contactId, state, data },
    update: { state, data },
  });
}

async function showMenu(contactId: string, waId: string) {
  await setSession(contactId, "MENU", {});
  await reply(
    contactId,
    waId,
    `Welcome to ${process.env.BUSINESS_NAME ?? "our store"} 👋

Reply with:
1️⃣ Shop products
2️⃣ My orders
3️⃣ Support
4️⃣ View cart

You can type MENU anytime.`
  );
}

async function showCategories(contactId: string, waId: string) {
  const categories = await prisma.category.findMany({
    where: { active: true, products: { some: { active: true, stockQty: { gt: 0 } } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (!categories.length) {
    await reply(contactId, waId, "No products are available right now. Please try again later.");
    return showMenu(contactId, waId);
  }

  await setSession(contactId, "SELECT_CATEGORY", {
    categoryIds: categories.map((c) => c.id),
  });

  await reply(
    contactId,
    waId,
    "Choose a category:\n\n" +
      categories.map((c, i) => `${i + 1}. ${c.name}`).join("\n") +
      "\n\nReply with the number."
  );
}

async function showProducts(contactId: string, waId: string, categoryId: string) {
  const products = await prisma.product.findMany({
    where: { categoryId, active: true, stockQty: { gt: 0 } },
    orderBy: { name: "asc" },
    take: 20,
  });

  if (!products.length) {
    await reply(contactId, waId, "No in-stock products in this category.");
    return showCategories(contactId, waId);
  }

  await setSession(contactId, "SELECT_PRODUCT", {
    productIds: products.map((p) => p.id),
  });

  await reply(
    contactId,
    waId,
    "Choose a product:\n\n" +
      products
        .map((p, i) => `${i + 1}. ${p.name} — ${formatInr(p.pricePaise)}`)
        .join("\n") +
      "\n\nReply with the number."
  );
}

async function showCart(contactId: string, waId: string) {
  const { cart, subtotalPaise } = await cartSummary(contactId);

  if (!cart.items.length) {
    await reply(contactId, waId, "Your cart is empty.");
    return showMenu(contactId, waId);
  }

  const lines = cart.items.map(
    (item, i) =>
      `${i + 1}. ${item.product.name} × ${item.quantity} = ${formatInr(
        item.product.pricePaise * item.quantity
      )}`
  );

  await setSession(contactId, "CART", {});
  await reply(
    contactId,
    waId,
    `🛒 Your cart

${lines.join("\n")}

Subtotal: ${formatInr(subtotalPaise)}

Reply:
1 — Checkout
2 — Continue shopping
3 — Clear cart
MENU — Main menu`
  );
}

async function showOrders(contactId: string, waId: string) {
  const orders = await prisma.order.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (!orders.length) {
    await reply(contactId, waId, "You do not have any orders yet.");
    return showMenu(contactId, waId);
  }

  await reply(
    contactId,
    waId,
    "Your recent orders:\n\n" +
      orders
        .map(
          (o) =>
            `${o.orderNumber}\n${formatInr(o.totalPaise)} • ${o.paymentStatus} • ${o.status}`
        )
        .join("\n\n") +
      "\n\nType MENU to return."
  );
  await setSession(contactId, "MENU", {});
}

function numberChoice(text: string, max: number) {
  const n = Number(text.trim());
  return Number.isInteger(n) && n >= 1 && n <= max ? n - 1 : -1;
}

export async function handleIncomingMessage(input: {
  contactId: string;
  waId: string;
  text: string;
}) {
  const raw = input.text.trim();
  const text = normalizeText(raw);

  if (!raw) {
    await reply(input.contactId, input.waId, "Please send a text message. Type MENU to start.");
    return;
  }

  if (["hi", "hello", "hey", "start", "menu"].includes(text)) {
    await showMenu(input.contactId, input.waId);
    return;
  }

  if (text === "shop") {
    await showCategories(input.contactId, input.waId);
    return;
  }

  if (text === "cart") {
    await showCart(input.contactId, input.waId);
    return;
  }

  if (text === "orders" || text === "my orders") {
    await showOrders(input.contactId, input.waId);
    return;
  }

  const session = await prisma.conversationSession.upsert({
    where: { contactId: input.contactId },
    create: { contactId: input.contactId, state: "MENU", data: {} },
    update: {},
  });

  const data = (session.data ?? {}) as SessionData;

  switch (session.state) {
    case "MENU": {
      if (text === "1") return showCategories(input.contactId, input.waId);
      if (text === "2") return showOrders(input.contactId, input.waId);
      if (text === "3") {
        await setSession(input.contactId, "MENU", {});
        return reply(
          input.contactId,
          input.waId,
          `Human support requested ✅\nPlease describe your issue. Our team can review it in the admin panel.\n\nType MENU to return.`
        );
      }
      if (text === "4") return showCart(input.contactId, input.waId);
      return showMenu(input.contactId, input.waId);
    }

    case "SELECT_CATEGORY": {
      const ids = data.categoryIds ?? [];
      const index = numberChoice(raw, ids.length);
      if (index < 0) {
        await reply(input.contactId, input.waId, "Please reply with a valid category number.");
        return;
      }
      return showProducts(input.contactId, input.waId, ids[index]);
    }

    case "SELECT_PRODUCT": {
      const ids = data.productIds ?? [];
      const index = numberChoice(raw, ids.length);
      if (index < 0) {
        await reply(input.contactId, input.waId, "Please reply with a valid product number.");
        return;
      }

      const product = await prisma.product.findUnique({ where: { id: ids[index] } });
      if (!product || !product.active || product.stockQty <= 0) {
        await reply(input.contactId, input.waId, "That product is no longer available.");
        return showCategories(input.contactId, input.waId);
      }

      await setSession(input.contactId, "SELECT_QUANTITY", {
        selectedProductId: product.id,
      });

      return reply(
        input.contactId,
        input.waId,
        `${product.name}\nPrice: ${formatInr(product.pricePaise)}\nAvailable: ${product.stockQty}\n\nHow many do you want? Reply with quantity.`
      );
    }

    case "SELECT_QUANTITY": {
      const quantity = Number(raw);
      const productId = data.selectedProductId;
      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        await reply(input.contactId, input.waId, "Please send a valid quantity, for example 1 or 2.");
        return;
      }

      try {
        await addToCart(input.contactId, productId, quantity);
      } catch (error) {
        await reply(input.contactId, input.waId, `Could not add item: ${String(error)}`);
        return showCategories(input.contactId, input.waId);
      }

      return showCart(input.contactId, input.waId);
    }

    case "CART": {
      if (text === "1" || text === "checkout") {
        const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
        await setSession(input.contactId, "CHECKOUT_NAME", {});
        return reply(
          input.contactId,
          input.waId,
          `Checkout started ✅\nPlease send your full name.${
            contact?.displayName ? `\nWhatsApp name: ${contact.displayName}` : ""
          }`
        );
      }

      if (text === "2") return showCategories(input.contactId, input.waId);

      if (text === "3") {
        const cart = await prisma.cart.findUnique({ where: { contactId: input.contactId } });
        if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
        await reply(input.contactId, input.waId, "Cart cleared.");
        return showMenu(input.contactId, input.waId);
      }

      return showCart(input.contactId, input.waId);
    }

    case "CHECKOUT_NAME": {
      if (raw.length < 2 || raw.length > 100) {
        await reply(input.contactId, input.waId, "Please send a valid full name.");
        return;
      }
      await setSession(input.contactId, "CHECKOUT_ADDRESS", { customerName: raw });
      return reply(input.contactId, input.waId, "Send your full delivery address.");
    }

    case "CHECKOUT_ADDRESS": {
      if (raw.length < 8 || raw.length > 500) {
        await reply(input.contactId, input.waId, "Please send a complete delivery address.");
        return;
      }
      await setSession(input.contactId, "CHECKOUT_PINCODE", {
        ...data,
        addressLine: raw,
      });
      return reply(input.contactId, input.waId, "Send your 6-digit pincode.");
    }

    case "CHECKOUT_PINCODE": {
      if (!/^\d{6}$/.test(raw)) {
        await reply(input.contactId, input.waId, "Please send a valid 6-digit pincode.");
        return;
      }

      const next = { ...data, pincode: raw };
      const { cart, subtotalPaise } = await cartSummary(input.contactId);

      if (!cart.items.length) {
        await reply(input.contactId, input.waId, "Your cart is empty.");
        return showMenu(input.contactId, input.waId);
      }

      const deliveryPaise = Number(process.env.DELIVERY_FEE_PAISE ?? "0");
      await setSession(input.contactId, "ORDER_REVIEW", next);

      return reply(
        input.contactId,
        input.waId,
        `Review your order:

${cart.items
  .map(
    (item) =>
      `${item.product.name} × ${item.quantity} — ${formatInr(
        item.product.pricePaise * item.quantity
      )}`
  )
  .join("\n")}

Subtotal: ${formatInr(subtotalPaise)}
Delivery: ${formatInr(deliveryPaise)}
Total: ${formatInr(subtotalPaise + deliveryPaise)}

Name: ${next.customerName}
Address: ${next.addressLine}
Pincode: ${next.pincode}

Reply CONFIRM to place order or CANCEL to stop.`
      );
    }

    case "ORDER_REVIEW": {
      if (text === "cancel") {
        await setSession(input.contactId, "MENU", {});
        await reply(input.contactId, input.waId, "Checkout cancelled. Your cart is still saved.");
        return showMenu(input.contactId, input.waId);
      }

      if (text !== "confirm") {
        await reply(input.contactId, input.waId, "Reply CONFIRM to place the order or CANCEL.");
        return;
      }

      if (!data.customerName || !data.addressLine || !data.pincode) {
        await reply(input.contactId, input.waId, "Checkout data expired. Please start checkout again.");
        return showCart(input.contactId, input.waId);
      }

      const order = await createOrderFromCart({
        contactId: input.contactId,
        customerName: data.customerName,
        phone: input.waId,
        addressLine: data.addressLine,
        pincode: data.pincode,
      });

      await setSession(input.contactId, "MENU", {});

      if (order.razorpayLinkUrl) {
        await reply(
          input.contactId,
          input.waId,
          `Order created ✅

Order: ${order.orderNumber}
Total: ${formatInr(order.totalPaise)}

Pay securely here:
${order.razorpayLinkUrl}

After successful payment, your order will be confirmed automatically.`
        );
      } else {
        await reply(
          input.contactId,
          input.waId,
          `Order ${order.orderNumber} was created, but the payment link could not be generated. Please contact support before paying.`
        );
      }
      return;
    }

    default:
      return showMenu(input.contactId, input.waId);
  }
}
