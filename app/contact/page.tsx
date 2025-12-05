'use client'

import { useState, FormEvent, useEffect } from 'react'
import Link from 'next/link'

export default function Contact() {
  const [formData, setFormData] = useState({
    nume: '',
    email: '',
    telefon: '',
    mesaj: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    // Verifică dacă există parametru pentru mesaj de eroare (din URL)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const error = urlParams.get('error')
      if (error === 'order_not_found') {
        setShowError(true)
      }
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    // Aici ar fi trimis mesajul la Shopify Contact API
    // Pentru moment, simulăm trimiterea
    try {
      // TODO: Integrare cu Shopify Contact API
      // const response = await fetch('/api/contact', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData)
      // })
      
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setFormData({ nume: '', email: '', telefon: '', mesaj: '' })
        setShowError(false)
      }, 3000)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '16px',
      padding: '40px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      maxWidth: '800px',
      margin: '0 auto',
      minHeight: '60vh'
    }}>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '30px'
      }}>
        Contact
      </h1>

      {showError && (
        <div style={{
          padding: '16px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '8px',
          marginBottom: '24px',
          color: '#c62828'
        }}>
          <strong>Datele introduse până acum nu au fost găsite pe platforma noastră.</strong>
          <br />
          Vă rugăm să ne contactați pentru a remedia problema. Vă vom răspunde în cel mai scurt timp.
        </div>
      )}

      {submitted ? (
        <div style={{
          padding: '20px',
          backgroundColor: '#4CAF50',
          color: '#fff',
          borderRadius: '8px',
          marginBottom: '30px',
          textAlign: 'center'
        }}>
          Mesajul a fost trimis cu succes! Vă vom contacta în cel mai scurt timp.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>
              Informații de contact
            </h2>
            <div style={{ lineHeight: '2' }}>
              <p><strong>Email:</strong> contact@maxari.ro</p>
              <p><strong>Telefon:</strong> +40 123 456 789</p>
              <p><strong>Program:</strong> Luni - Vineri: 9:00 - 18:00</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                Nume complet *
              </label>
              <input
                type="text"
                value={formData.nume}
                onChange={(e) => setFormData({ ...formData, nume: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                Telefon
              </label>
              <input
                type="tel"
                value={formData.telefon}
                onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                Mesaj *
              </label>
              <textarea
                value={formData.mesaj}
                onChange={(e) => setFormData({ ...formData, mesaj: e.target.value })}
                required
                rows={6}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '8px',
                background: 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)',
                color: '#fff',
                border: 'none',
                fontSize: '16px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Trimite mesaj
            </button>
          </form>
        </>
      )}

      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <Link href="/" style={{
          color: '#26a69a',
          textDecoration: 'none',
          fontWeight: 'bold'
        }}>
          ← Înapoi la procesul de retur
        </Link>
      </div>
    </div>
  )
}

