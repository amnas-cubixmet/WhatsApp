# WhatsApp Commerce — Full MVP

A WhatsApp-first store built with Next.js App Router, Prisma/PostgreSQL, Meta WhatsApp Cloud API and Razorpay.

Customer shopping happens inside WhatsApp. The web app is used for the bot backend, webhooks, database and admin panel.

## Customer flow

```
Hi
→ Main menu
→ Shop products
→ Choose category
→ Choose product
→ Quantity
→ Cart
→ Checkout
→ Name
→ Delivery address
→ Pincode
→ Review
→ CONFIRM
→ Razorpay payment link
→ Payment webhook
→ Order confirmed
→ Admin status updates
→ WhatsApp delivery updates
```

Customers can also use:

- MENU
- SHOP
- CART
- ORDERS / MY ORDERS
- STOP / UNSUBSCRIBE / CANCEL / END / QUIT / OPT OUT

## Admin

Open:

```
/admin
```

Features:

- Password-protected admin
- Dashboard KPIs
- Categories
- Product creation
- Stock
- Product visibility
- Orders
- Order status updates
- Customers
- Consent status
- Message audit log

## Safety guardrails

The project is intentionally designed around the official Meta WhatsApp Cloud API.

- Incoming webhook signature verification
- Customer service 24-hour window enforcement
- Free-form messages blocked outside the customer service window
- Explicit proactive opt-in tracking
- Approved template-only outbound flow outside 24 hours
- STOP / unsubscribe handling
- Opted-out contacts blocked from outbound sending
- Per-contact rate limiting
- Public send API protected with an internal API key
- Incoming/outgoing message audit log
- Duplicate inbound webhook protection

These controls reduce policy risk. They do not guarantee that Meta will never restrict an account. Message quality, user blocks/reports, content, template approval and current Meta policies still apply.

## Stack

- Next.js 16
- React 19
- TypeScript
- Prisma
- PostgreSQL
- Meta WhatsApp Cloud API
- Razorpay Payment Links
- Vercel-compatible deployment

## Local setup

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Fill all required values.

Create/update database tables:

```bash
npm run db:push
```

Start:

```bash
npm run dev
```

Admin:

```
http://localhost:3000/admin
```

## Database

Use any PostgreSQL database. Supabase PostgreSQL is suitable for the MVP.

Set:

```
DATABASE_URL=...
```

Then run:

```bash
npx prisma db push
```

## Meta WhatsApp setup

Create a Meta app with WhatsApp Cloud API and configure these values:

```
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_GRAPH_VERSION
```

Webhook callback:

```
https://YOUR-VERCEL-APP.vercel.app/api/whatsapp/webhook
```

Subscribe the WhatsApp webhook to message events.

The verify token entered in Meta must match `WHATSAPP_VERIFY_TOKEN`.

## Explicit opt-in

Inbound chat opens the customer service conversation window but is not automatically stored as permission for future proactive marketing.

For explicit opt-in you can record consent through:

```
POST /api/consent
x-internal-api-key: YOUR_INTERNAL_API_KEY
```

Body:

```json
{
  "waId": "919999999999",
  "action": "opt_in",
  "source": "checkout_consent"
}
```

The customer can also send:

```
OPT IN
```

or:

```
YES UPDATES
```

after being shown appropriate consent wording.

## Approved WhatsApp templates

Create approved utility templates in WhatsApp Manager and place the approved template names in:

```
WHATSAPP_TEMPLATE_ORDER_CONFIRMED
WHATSAPP_TEMPLATE_ORDER_PROCESSING
WHATSAPP_TEMPLATE_ORDER_PACKED
WHATSAPP_TEMPLATE_ORDER_SHIPPED
WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY
WHATSAPP_TEMPLATE_ORDER_DELIVERED
```

If the customer's 24-hour service window is still open, the app can send a normal status message.

Outside that window, it will send only an approved configured template and only where proactive messaging consent has been recorded.

## Razorpay

Set:

```
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

Webhook URL:

```
https://YOUR-VERCEL-APP.vercel.app/api/payments/razorpay/webhook
```

Configure Razorpay to deliver payment-link/payment events.

When a successful payment event is received, the app changes:

```
paymentStatus → PAID
order status → CONFIRMED
```

and attempts a compliant WhatsApp confirmation.

## Vercel

1. Import the GitHub repo into Vercel.
2. Add every production environment variable from `.env.example`.
3. Deploy.
4. Run `prisma db push` against the production database once.
5. Configure the deployed Meta webhook URL.
6. Configure the deployed Razorpay webhook URL.

No custom domain is required. A Vercel URL is enough for the MVP.

## Environment variables

See `.env.example`.

Important secrets:

- Never commit a real Meta access token.
- Never commit Razorpay secrets.
- Never commit admin passwords/session secrets.
- Never expose `INTERNAL_API_KEY` in client-side code.

## Health check

```
GET /api/health
```

Returns database connection status.

## Repository

`amnas-cubixmet/WhatsApp`
