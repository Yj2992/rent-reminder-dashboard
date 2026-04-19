import type { NextApiRequest, NextApiResponse } from "next";

// Use dynamic import so it doesn't get bundled into client code
const Razorpay = require("razorpay");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, tenantId } = req.body;
  if (!amount || !tenantId) {
    return res.status(400).json({ error: "Missing tenantId or amount" });
  }

  const amountInPaise = Math.round(Number(amount) * 100);

  try {
    // Initialize Razorpay instance with server-side keys
    const razorpay = new Razorpay({
      key_id: process.env.RZP_KEY_ID!,
      key_secret: process.env.RZP_KEY_SECRET!,
    });

    // Create real Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rent_${tenantId}_${Date.now()}`,
    });

    // TODO: Persist order in your DB (Supabase/Postgres) as "PENDING"

    return res.status(200).json({ order });
  } catch (err: any) {
    console.error("Razorpay order creation failed:", err);
    return res.status(500).json({ error: "Unable to create order", details: err.message });
  }
}