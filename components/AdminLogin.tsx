'use client'

import { useState, FormEvent } from 'react'
import s from './AdminLogin.module.css'

interface AdminLoginProps {
  onLoginSuccess: () => void
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [registerNume, setRegisterNume] = useState('')
  const [registerPrenume, setRegisterPrenume] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await response.json()
      if (data.success) {
        onLoginSuccess()
      } else {
        setError(data.message || 'Eroare la autentificare')
      }
    } catch {
      setError('Eroare la conectare. Vă rugăm să încercați din nou.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (registerPassword !== registerConfirmPassword) {
      setError('Parolele nu se potrivesc')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nume: registerNume,
          prenume: registerPrenume,
          email: registerEmail,
          password: registerPassword,
          confirmPassword: registerConfirmPassword,
        }),
      })
      const data = await response.json()
      if (data.success) {
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: registerEmail, password: registerPassword }),
        })
        const loginData = await loginResponse.json()
        if (loginData.success) {
          onLoginSuccess()
        } else {
          setError('Cont creat, dar autentificarea a eșuat. Conectează-te manual.')
        }
      } else {
        setError(data.message || 'Eroare la crearea contului')
      }
    } catch {
      setError('Eroare la conectare. Vă rugăm să încercați din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.shell}>
      <div className={s.card}>
        <h1 className={s.brand}>XPY</h1>
        <p className={s.subtitle}>
          {isLogin ? 'Autentifică-te în panoul de control' : 'Creează un cont nou'}
        </p>

        <div className={s.toggleRow}>
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(null) }}
            className={`${s.toggleBtn} ${isLogin ? s.toggleBtnActive : ''}`}
          >
            Conectare
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(null) }}
            className={`${s.toggleBtn} ${!isLogin ? s.toggleBtnActive : ''}`}
          >
            Înregistrare
          </button>
        </div>

        {error && <div className={s.error}>{error}</div>}

        {isLogin ? (
          <form onSubmit={handleLogin}>
            <div className={s.field}>
              <label htmlFor="login-email" className={s.label}>Email</label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                disabled={loading}
                className={s.input}
                autoComplete="email"
              />
            </div>

            <div className={s.field}>
              <label htmlFor="login-password" className={s.label}>Parolă</label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                disabled={loading}
                className={s.input}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" disabled={loading} className={s.submitBtn}>
              {loading ? 'Se conectează…' : 'Conectează-te'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className={s.fieldRow}>
              <div className={s.field}>
                <label htmlFor="r-nume" className={s.label}>Nume</label>
                <input
                  id="r-nume"
                  type="text"
                  value={registerNume}
                  onChange={(e) => setRegisterNume(e.target.value)}
                  required
                  disabled={loading}
                  className={s.input}
                />
              </div>
              <div className={s.field}>
                <label htmlFor="r-prenume" className={s.label}>Prenume</label>
                <input
                  id="r-prenume"
                  type="text"
                  value={registerPrenume}
                  onChange={(e) => setRegisterPrenume(e.target.value)}
                  required
                  disabled={loading}
                  className={s.input}
                />
              </div>
            </div>

            <div className={s.field}>
              <label htmlFor="r-email" className={s.label}>Email</label>
              <input
                id="r-email"
                type="email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                required
                disabled={loading}
                className={s.input}
                autoComplete="email"
              />
            </div>

            <div className={s.field}>
              <label htmlFor="r-pass" className={s.label}>Parolă</label>
              <input
                id="r-pass"
                type="password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                className={s.input}
                autoComplete="new-password"
              />
              <p className={s.hint}>Minim 6 caractere</p>
            </div>

            <div className={s.field}>
              <label htmlFor="r-pass2" className={s.label}>Confirmă parola</label>
              <input
                id="r-pass2"
                type="password"
                value={registerConfirmPassword}
                onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                className={s.input}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={loading} className={s.submitBtn}>
              {loading ? 'Se creează contul…' : 'Creează cont'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
