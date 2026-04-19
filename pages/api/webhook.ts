import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // In production: verify X-Razorpay-Signature with your RZP_WEBHOOK_SECRET (server-only) then process events.
  // For demo purposes, just respond OK.
  return res.status(200).json({ ok: true })
}