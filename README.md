# Rentomatic Tenant Portal

This portal is the public payment surface for tenant invoice links.

## What it does

- Opens public invoice links from the backend
- Starts Razorpay checkout through backend-generated orders
- Redirects tenants to success and failure states
- Shows the latest invoice PDF after payment verification finishes

## Environment

Set this in Render:

- `NEXT_PUBLIC_BACKEND_BASE_URL=https://ktor-sendgrid-backend.onrender.com`

## Important architecture note

This portal does not own payment verification or webhooks.

Those server-side responsibilities live in the Ktor backend:

- create Razorpay order
- verify payment signature
- process Razorpay webhook
- mark invoice as paid
- generate the paid invoice PDF
- send receipt email

## Render

The included [`render.yaml`](/Users/nonijoysar/Rentomatic-tenant-portal/render.yaml) is ready for deployment as a Node web service.

Use:

- Build command: `npm ci && npm run build`
- Start command: `npm run start -- -p $PORT`

## Local run

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Payment entry

The home page accepts either:

- the full invoice link from email
- only the token after `/pay/`

Both routes forward to the same live payment page.
