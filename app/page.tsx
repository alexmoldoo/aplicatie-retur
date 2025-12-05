'use client'

import { useState } from 'react'
import ReturnProcess from '@/components/ReturnProcess'
import Link from 'next/link'

export default function Home() {
  return (
    <main>
      <ReturnProcess />
      <footer style={{
        textAlign: 'center',
        marginTop: '30px',
        display: 'flex',
        justifyContent: 'center',
        gap: '30px',
        flexWrap: 'wrap'
      }}>
        <Link href="/termeni-conditii" style={{ color: '#000', textDecoration: 'none' }}>
          Termeni & Condiții
        </Link>
        <Link href="/politica-retur" style={{ color: '#000', textDecoration: 'none' }}>
          Politica de retur
        </Link>
        <Link href="/contact" style={{ color: '#000', textDecoration: 'none' }}>
          Contact
        </Link>
      </footer>
    </main>
  )
}

