# WhatsApp Commerce

WhatsApp-first commerce starter built with Next.js App Router, Prisma/PostgreSQL and the official Meta WhatsApp Cloud API.

## Safety guardrails

- Customer records are created from inbound WhatsApp webhook traffic.
- STOP / UNSUBSCRIBE / CANCEL / END / QUIT / OPT OUT is stored as an opt-out.
- Outbound sends to opted-out contacts are blocked.
- Free-form outbound messages are blocked outside the 24-hour customer-service window.
- Outside that window, use an approved WhatsApp template.
- App-level per-contact rate limiting is included.
- Incoming/outgoing messages and delivery status are logged.
- Webhook POST requests are verified with Meta's app-secret signature.

These controls reduce policy risk but cannot guarantee that Meta will never restrict an account. Business behavior, message content, user reports/blocks, approved template usage and current WhatsApp policies still matter.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Add PostgreSQL URL and Meta Cloud API credentials.

4. Create database tables:
   ```bash
   npx prisma db push
   ```

5. Run:
   ```bash
   npm run dev
   ```

## Meta webhook

Set callback URL to:

```
https://YOUR-VERCEL-APP.vercel.app/api/whatsapp/webhook
```

Use the same value as `WHATSAPP_VERIFY_TOKEN` when Meta asks for the verify token.

## Sending

Within 24 hours of the customer's latest message:

```json
POST /api/whatsapp/send
{
  "to": "919999999999",
  "kind": "freeform",
  "text": "Your cart is ready."
}
```

Outside 24 hours:

```json
POST /api/whatsapp/send
{
  "to": "919999999999",
  "kind": "template",
  "templateName": "order_update",
  "languageCode": "en"
}
```

Do not use purchased/random phone lists. Collect valid WhatsApp opt-in where required and honor opt-out requests.
