import React from 'react'
import { useAuth } from '../hooks/useAuth'

type AuthGuardProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback = null }) => {
  const { session, loading } = useAuth()
  if (loading) return <div>Chargement de l’auth…</div>
  if (!session) return <>{fallback ?? <div>Veuillez vous connecter pour accéder à cette section.</div>}</>
  return <>{children}</>
}
