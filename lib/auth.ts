/**
 * Utilitare pentru autentificare și sesiuni
 */

import { cookies } from 'next/headers'
import { findUserByEmail, verifyPassword, findUserById, User } from './db'

const SESSION_COOKIE_NAME = 'admin_session'
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 zile

export interface Session {
  userId: string
  email: string
  expiresAt: number
}

/**
 * Creează o sesiune pentru utilizator
 */
export async function createSession(userId: string, email: string): Promise<string> {
  const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const expiresAt = Date.now() + SESSION_DURATION
  
  const session: Session = {
    userId,
    email,
    expiresAt,
  }
  
  // În producție, ar trebui să stochezi sesiunile într-o bază de date
  // Pentru simplitate, folosim un cookie criptat
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  })
  
  return sessionId
}

/**
 * Obține sesiunea curentă
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
    
    if (!sessionCookie) {
      return null
    }
    
    const session: Session = JSON.parse(sessionCookie.value)
    
    // Verifică dacă sesiunea a expirat
    if (session.expiresAt < Date.now()) {
      await destroySession()
      return null
    }
    
    return session
  } catch (error) {
    return null
  }
}

/**
 * Distruge sesiunea curentă
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Obține utilizatorul curent autentificat
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession()
  if (!session) {
    return null
  }
  
  return await findUserById(session.userId)
}

/**
 * Verifică dacă utilizatorul este autentificat
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

/**
 * Autentifică un utilizator
 */
export async function authenticate(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email)
  
  if (!user) {
    return null
  }
  
  if (!verifyPassword(password, user.passwordHash)) {
    return null
  }
  
  await createSession(user.id, user.email)
  
  return user
}

