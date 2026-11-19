export interface PasswordValidation {
  isValid: boolean
  errors: string[]
}

export function validatePassword(password: string, language: 'fr' | 'en' | 'es' = 'fr'): PasswordValidation {
  const errors: string[] = []
  
  const messages = {
    fr: {
      minLength: 'Le mot de passe doit contenir au moins 8 caractères',
      uppercase: 'Le mot de passe doit contenir au moins une majuscule',
      lowercase: 'Le mot de passe doit contenir au moins une minuscule',
      number: 'Le mot de passe doit contenir au moins un chiffre',
      special: 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*)',
    },
    en: {
      minLength: 'Password must be at least 8 characters long',
      uppercase: 'Password must contain at least one uppercase letter',
      lowercase: 'Password must contain at least one lowercase letter',
      number: 'Password must contain at least one number',
      special: 'Password must contain at least one special character (!@#$%^&*)',
    },
    es: {
      minLength: 'La contraseña debe tener al menos 8 caracteres',
      uppercase: 'La contraseña debe contener al menos una letra mayúscula',
      lowercase: 'La contraseña debe contener al menos una letra minúscula',
      number: 'La contraseña debe contener al menos un número',
      special: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*)',
    }
  }
  
  const msg = messages[language]
  
  if (password.length < 8) {
    errors.push(msg.minLength)
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push(msg.uppercase)
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push(msg.lowercase)
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push(msg.number)
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push(msg.special)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export async function hashPassword(password: string): Promise<string> {
  // Use server-side bcrypt hashing via Netlify Function
  try {
    const resp = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hash', password }),
    })
    if (!resp.ok) throw new Error('Server hash failed')
    const data = await resp.json()
    return data.hash
  } catch {
    // Fallback: client-side SHA-256 (weaker, for offline/dev only)
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hash))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // Detect bcrypt hash (starts with $2a$ or $2b$)
  if (hashedPassword.startsWith('$2')) {
    try {
      const resp = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', password, hash: hashedPassword }),
      })
      if (!resp.ok) throw new Error('Server verify failed')
      const data = await resp.json()
      return data.match
    } catch {
      return false
    }
  }
  // Legacy SHA-256 comparison for existing accounts
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hash))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex === hashedPassword
}

export function getPasswordStrength(password: string): {
  strength: 'weak' | 'medium' | 'strong' | 'very-strong'
  score: number
} {
  let score = 0
  
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1
  
  if (/[a-z].*[a-z].*[a-z]/.test(password)) score += 0.5
  if (/[A-Z].*[A-Z]/.test(password)) score += 0.5
  if (/[0-9].*[0-9]/.test(password)) score += 0.5
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?].*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 0.5
  
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong'
  if (score < 4) {
    strength = 'weak'
  } else if (score < 6) {
    strength = 'medium'
  } else if (score < 8) {
    strength = 'strong'
  } else {
    strength = 'very-strong'
  }
  
  return { strength, score: Math.min(score / 10 * 100, 100) }
}
