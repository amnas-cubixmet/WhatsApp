import crypto from "crypto";

function authHeader() {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new Error("RAZORPAY_ENV_MISSING");
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

export async function createPaymentLink(input: {
  orderNumber: string;
  amountPaise: number;
  customerName: string;
  phone: string;
  description?: string;
}) {
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      accept_partial: false,
      description: input.description ?? `Payment for ${input.orderNumber}`,
      customer: {
        name: input.customerName,
        contact: input.phone.startsWith("+") ? input.phone : `+${input.phone}`,
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      reference_id: input.orderNumber,
      notes: { orderNumber: input.orderNumber },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`RAZORPAY_ERROR:${JSON.stringify(data)}`);
  return data as { id: string; short_url: string; status: string };
}

export function verifyRazorpayWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
