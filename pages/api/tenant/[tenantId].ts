import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { tenantId } = req.query as { tenantId?: string }
  // In production, fetch tenant + invoice from DB by tenantId
  return res.status(200).json({ name: 'Demo Tenant', amount: 8000, currency: 'INR', dueDate: '2025-10-05', tenantId })
}