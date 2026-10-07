'use client'

/**
 * Lista de retururi pentru admin, ținută în memorie pe durata sesiunii.
 *
 * - prima încărcare: lista „ușoară" (fără semnături / QR / poze) de la /api/returns
 * - la fiecare pagină următoare: apare instant din memorie, iar în fundal se cer
 *   DOAR retururile modificate de la ultima sincronizare (`?since=`)
 * - acțiunile din admin (status, ștergere, plăți) actualizează memoria pe loc
 *
 * Memoria e per tab (sessionStorage) și dispare la închiderea lui.
 */

import { useCallback, useEffect, useState } from 'react'
import type { ReturnLight } from '@/lib/db'

const KEY = 'admin:returns:v1'

const LIGHT_KEYS = [
  'idRetur', 'numarComanda', 'orderData', 'refundData', 'totalRefund', 'status', 'createdAt', 'awbNumber', 'updatedAt',
] as const

interface Cache {
  items: ReturnLight[]
  syncedAt: string | null
  supportsSince: boolean
}

interface ListResponse {
  success: boolean
  message?: string
  returns: ReturnLight[]
  serverTime: string
  supportsSince: boolean
  incremental: boolean
}

let memory: Cache | null = null
const listeners = new Set<(c: Cache) => void>()
let inflight: Promise<ReturnLight[]> | null = null

function readCache(): Cache | null {
  if (memory) return memory
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) memory = JSON.parse(raw) as Cache
  } catch {
    memory = null
  }
  return memory
}

function writeCache(c: Cache) {
  memory = c
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* memorie plină sau indisponibilă — rămâne doar în RAM */
  }
  listeners.forEach(l => l(c))
}

function sortDesc(items: ReturnLight[]): ReturnLight[] {
  return [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

function merge(base: ReturnLight[], changes: ReturnLight[]): ReturnLight[] {
  const map = new Map(base.map(r => [r.idRetur, r]))
  for (const c of changes) map.set(c.idRetur, c)
  return sortDesc(Array.from(map.values()))
}

async function fetchList(since?: string | null): Promise<ListResponse> {
  const url = since ? `/api/returns?since=${encodeURIComponent(since)}` : '/api/returns'
  const r = await fetch(url, { cache: 'no-store' })
  const d = (await r.json()) as ListResponse
  if (!r.ok || !d.success) throw new Error(d.message || 'Eroare la încărcarea retururilor')
  return d
}

/** Aduce lista la zi: incremental când se poate, altfel integral. */
export function refreshReturns(force = false): Promise<ReturnLight[]> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const cached = readCache()
      if (cached && !force && cached.supportsSince && cached.syncedAt) {
        const d = await fetchList(cached.syncedAt)
        const items = d.incremental ? merge(cached.items, d.returns) : sortDesc(d.returns)
        writeCache({ items, syncedAt: d.serverTime, supportsSince: d.supportsSince })
        return items
      }
      const d = await fetchList()
      const items = sortDesc(d.returns)
      writeCache({ items, syncedAt: d.serverTime, supportsSince: d.supportsSince })
      return items
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/**
 * Pune în memorie un retur proaspăt întors de server (după o acțiune din admin).
 * Păstrăm DOAR câmpurile listei — fără semnătură, QR, poze, produse.
 */
export function applyReturnToCache(ret: Partial<ReturnLight> & { idRetur: string }) {
  const cached = readCache()
  if (!cached) return
  const existing = cached.items.find(r => r.idRetur === ret.idRetur)
  const light: Partial<ReturnLight> = {}
  for (const k of LIGHT_KEYS) {
    if ((ret as any)[k] !== undefined) (light as any)[k] = (ret as any)[k]
  }
  const next = { ...(existing || {}), ...light } as ReturnLight
  writeCache({ ...cached, items: merge(cached.items, [next]) })
}

export function removeReturnFromCache(idRetur: string) {
  const cached = readCache()
  if (!cached) return
  writeCache({ ...cached, items: cached.items.filter(r => r.idRetur !== idRetur) })
}

/** Uită tot; următoarea pagină încarcă lista integral. */
export function invalidateReturnsCache() {
  memory = null
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function useReturnsList() {
  const [cache, setCache] = useState<Cache | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const listener = (c: Cache) => setCache(c)
    listeners.add(listener)
    // Întâi ce avem deja (instant), apoi aducem la zi în fundal.
    const cached = readCache()
    if (cached) {
      setCache(cached)
      setLoading(false)
    }
    refreshReturns()
      .then(() => setError(null))
      .catch(e => setError(e instanceof Error ? e.message : 'Eroare la încărcare'))
      .finally(() => setLoading(false))
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const refresh = useCallback(async (force = false) => {
    setLoading(true)
    try {
      await refreshReturns(force)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la încărcare')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    returns: cache?.items ?? [],
    loading,
    error,
    refresh,
    syncedAt: cache?.syncedAt ?? null,
  }
}
