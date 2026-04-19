import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, tenantId } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment fields" });
  }

  const secret = process.env.RZP_KEY_SECRET;
  if (!secret) {
    return res.status(200).json({
      ok: true,
      warning: "RZP_KEY_SECRET not configured - demo mode, signature not verified.",
    });
  }

  const message = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(message).digest("hex");

  // Timing-safe compare (recommended)
  const valid = crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature));

  if (!valid) {
    return res.status(400).json({ ok: false, message: "Invalid signature" });
  }

  // ✅ TODO: Mark order as PAID in DB
  // Example: await db.orders.update({ id: razorpay_order_id, status: "PAID" });

  // ✅ TODO: Generate & send receipt email (e.g. via SendGrid)

  return res.status(200).json({ ok: true, tenantId, razorpay_payment_id });
}