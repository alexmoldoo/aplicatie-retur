import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUserFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabaseUrl = (process.env.SUPABASE_URL || '').trim()
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

interface AdresaRetur {
  companie: string
  strada: string
  oras: string
  judet: string
  codPostal: string
  tara: string
  telefon: string
}

interface TransportCosts {
  curier: number
}

interface ReturnInfoBlob {
  adresaRetur?: AdresaRetur
  transportCosts?: TransportCosts
  branding?: { logo?: string | null }
}

const FALLBACK = {
  adresaRetur: {
    companie: 'Maxari',
    strada: 'Șoseaua Sibiului, nr. 11',
    oras: 'Mediaș',
    judet: 'Sibiu',
    codPostal: '551129',
    tara: 'România',
    telefon: '-',
  } as AdresaRetur,
  transportCosts: { curier: 19.99 } as TransportCosts,
  shopTitle: 'MAXARI.RO',
}

async function loadConfigRow() {
  if (!supabase) return null
  const { data } = await supabase
    .from('app_config')
    .select('id, shop_title, return_info')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

/**
 * GET — endpoint public pentru clientul de retur.
 */
export async function GET() {
  try {
    const row = await loadConfigRow()
    const blob: ReturnInfoBlob = row?.return_info || {}
    return NextResponse.json({
      success: true,
      adresaRetur: blob.adresaRetur || FALLBACK.adresaRetur,
      transportCosts: blob.transportCosts || FALLBACK.transportCosts,
      shopTitle: row?.shop_title || FALLBACK.shopTitle,
      logo: blob.branding?.logo || null,
    })
  } catch (error) {
    console.error('Error reading return info config:', error)
    return NextResponse.json({ success: true, ...FALLBACK, logo: null })
  }
}

/**
 * POST — actualizează adresaRetur, transportCosts și/sau logo. Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = await getCurrentUserFromCookies(cookieStore)
    if (!user) {
      return NextResponse.json({ success: false, message: 'Neautorizat' }, { status: 401 })
    }

    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Supabase nu este configurat în Vercel.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { adresaRetur, transportCosts, logo } = body || {}

    if (!adresaRetur && !transportCosts && logo === undefined) {
      return NextResponse.json({ success: false, message: 'Nimic de actualizat' }, { status: 400 })
    }

    const row = await loadConfigRow()
    const blob: ReturnInfoBlob = (row?.return_info as ReturnInfoBlob) || {}

    if (adresaRetur) {
      const required = ['companie', 'strada', 'oras', 'judet', 'codPostal', 'tara', 'telefon'] as const
      for (const k of required) {
        if (typeof adresaRetur[k] !== 'string') {
          return NextResponse.json({ success: false, message: `Câmp lipsă: ${k}` }, { status: 400 })
        }
      }
      blob.adresaRetur = {
        companie: adresaRetur.companie.trim() || 'Maxari',
        strada: adresaRetur.strada.trim(),
        oras: adresaRetur.oras.trim(),
        judet: adresaRetur.judet.trim(),
        codPostal: adresaRetur.codPostal.trim(),
        tara: adresaRetur.tara.trim() || 'România',
        telefon: adresaRetur.telefon.trim() || '-',
      }
    }

    if (transportCosts) {
      const c = Number(transportCosts.curier)
      if (Number.isFinite(c) && c >= 0) {
        blob.transportCosts = { ...(blob.transportCosts || { curier: 19.99 }), curier: c }
      }
    }

    if (logo !== undefined) {
      blob.branding = blob.branding || {}
      if (logo === null || logo === '') {
        blob.branding.logo = null
      } else if (typeof logo === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(logo)) {
        if (logo.length > 1_400_000) {
          return NextResponse.json({ success: false, message: 'Logo-ul depaseste 1 MB. Foloseste o imagine mai mica.' }, { status: 400 })
        }
        blob.branding.logo = logo
      } else {
        return NextResponse.json({ success: false, message: 'Format logo invalid (acceptate: PNG, JPG, WEBP).' }, { status: 400 })
      }
    }

    if (row?.id) {
      const { error } = await supabase
        .from('app_config')
        .update({ return_info: blob, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from('app_config')
        .insert({ return_info: blob })
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      adresaRetur: blob.adresaRetur,
      transportCosts: blob.transportCosts,
      logo: blob.branding?.logo || null,
    })
  } catch (error) {
    console.error('Error updating return info config:', error)
    return NextResponse.json({ success: false, message: 'Eroare la salvare' }, { status: 500 })
  }
}
