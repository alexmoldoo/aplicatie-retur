import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import fs from 'fs'
import path from 'path'
import { getCurrentUserFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CONFIG_FILE = path.join(process.cwd(), 'data', 'config.json')

interface ReturnInfo {
  adresaRetur: {
    companie: string
    strada: string
    oras: string
    judet: string
    codPostal: string
    tara: string
    telefon: string
  }
  transportCosts: {
    curier: number
  }
  shopTitle: string
  logo?: string | null
}

const FALLBACK: ReturnInfo = {
  adresaRetur: {
    companie: 'Maxari',
    strada: 'Șoseaua Sibiului, nr. 11',
    oras: 'Mediaș',
    judet: 'Sibiu',
    codPostal: '551129',
    tara: 'România',
    telefon: '-',
  },
  transportCosts: { curier: 19.99 },
  shopTitle: 'MAXARI.RO',
}

/**
 * GET — endpoint public pentru clientul de retur.
 * Returnează adresa de retur a magazinului, costurile de transport și titlul magazinului.
 */
export async function GET() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const cfg = JSON.parse(raw) as Partial<{
      adresaRetur: ReturnInfo['adresaRetur']
      transportCosts: ReturnInfo['transportCosts']
      shopify: { shopTitle?: string }
      branding: { logo?: string | null }
    }>

    return NextResponse.json({
      success: true,
      adresaRetur: cfg.adresaRetur || FALLBACK.adresaRetur,
      transportCosts: cfg.transportCosts || FALLBACK.transportCosts,
      shopTitle: cfg.shopify?.shopTitle || FALLBACK.shopTitle,
      logo: cfg.branding?.logo || null,
    })
  } catch (error) {
    console.error('Error reading return info config:', error)
    return NextResponse.json({
      success: true,
      ...FALLBACK,
    })
  }
}

/**
 * POST — actualizează adresaRetur și/sau transportCosts. Necesită admin.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = await getCurrentUserFromCookies(cookieStore)
    if (!user) {
      return NextResponse.json({ success: false, message: 'Neautorizat' }, { status: 401 })
    }

    const body = await request.json()
    const { adresaRetur, transportCosts, logo } = body || {}

    if (!adresaRetur && !transportCosts && logo === undefined) {
      return NextResponse.json({ success: false, message: 'Nimic de actualizat' }, { status: 400 })
    }

    let cfg: any = {}
    try {
      cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    } catch {
      cfg = {}
    }

    if (adresaRetur) {
      const required = ['companie', 'strada', 'oras', 'judet', 'codPostal', 'tara', 'telefon'] as const
      for (const k of required) {
        if (typeof adresaRetur[k] !== 'string') {
          return NextResponse.json({ success: false, message: `Câmp lipsă: ${k}` }, { status: 400 })
        }
      }
      cfg.adresaRetur = {
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
        cfg.transportCosts = { ...(cfg.transportCosts || {}), curier: c }
      }
    }

    if (logo !== undefined) {
      cfg.branding = cfg.branding || {}
      if (logo === null || logo === '') {
        cfg.branding.logo = null
      } else if (typeof logo === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(logo)) {
        // limita ~1MB pe data URL ca să nu se umfle config.json
        if (logo.length > 1_400_000) {
          return NextResponse.json({ success: false, message: 'Logo-ul depaseste 1 MB. Foloseste o imagine mai mica.' }, { status: 400 })
        }
        cfg.branding.logo = logo
      } else {
        return NextResponse.json({ success: false, message: 'Format logo invalid (acceptate: PNG, JPG, WEBP).' }, { status: 400 })
      }
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2))

    return NextResponse.json({
      success: true,
      adresaRetur: cfg.adresaRetur,
      transportCosts: cfg.transportCosts,
      logo: cfg.branding?.logo || null,
    })
  } catch (error) {
    console.error('Error updating return info config:', error)
    return NextResponse.json({ success: false, message: 'Eroare la salvare' }, { status: 500 })
  }
}
