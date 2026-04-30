import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

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
}

const FALLBACK: ReturnInfo = {
  adresaRetur: {
    companie: 'RED MAXARI',
    strada: 'Șoseaua Sibiului, nr. 11',
    oras: 'Mediaș',
    judet: 'Sibiu',
    codPostal: '551129',
    tara: 'România',
    telefon: '+40770404859',
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
    }>

    return NextResponse.json({
      success: true,
      adresaRetur: cfg.adresaRetur || FALLBACK.adresaRetur,
      transportCosts: cfg.transportCosts || FALLBACK.transportCosts,
      shopTitle: cfg.shopify?.shopTitle || FALLBACK.shopTitle,
    })
  } catch (error) {
    console.error('Error reading return info config:', error)
    return NextResponse.json({
      success: true,
      ...FALLBACK,
    })
  }
}
