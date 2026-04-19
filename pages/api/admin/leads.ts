import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'

type LeadRow = {
  id: string
  name: string
  email: string | null
  whatsapp: string | null
  industry: string | null
  city: string | null
  status: string
  created_at: string
}

type LeadsResponse = {
  page: number
  pageSize: number
  total: number
  leads: LeadRow[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LeadsResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.ADMIN_API_SECRET
  const headerSecret = req.headers['x-admin-secret']
  if (!secret || headerSecret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const page = Math.max(1, Number(req.query.page || 1))
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 25)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = getServiceClient()
  const { data, count, error } = await supabase
    .from('leads')
    .select('id, name, email, whatsapp, industry, city, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch leads' })
  }

  return res.status(200).json({
    page,
    pageSize,
    total: count || 0,
    leads: (data || []) as LeadRow[],
  })
}
