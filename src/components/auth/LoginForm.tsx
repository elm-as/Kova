import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SignIn, Building, Eye, EyeSlash, GoogleLogo, MicrosoftOutlookLogo } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Company, User, Language } from '@/lib/types'
import { verifyPassword } from '@/lib/password'
import * as db from '@/lib/db'

interface LoginFormProps {
  onLogin: (company: Company, user: User) => void
  onCreateAccount: () => void
  onForgotPassword: () => void
  language: Language
}

export function LoginForm({ onLogin, onCreateAccount, onForgotPassword, language }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const t = {
    fr: {
      title: 'Connexion',
      subtitle: 'Accédez à votre compte entreprise',
      emailLabel: 'Email professionnel',
      emailPlaceholder: 'votre.email@entreprise.com',
      passwordLabel: 'Mot de passe',
      passwordPlaceholder: 'Entrez votre mot de passe',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      loginButton: 'Se connecter',
      noAccount: "Pas encore de compte ?",
      createAccount: 'Créer un compte entreprise',
      forgotPassword: 'Mot de passe oublié ?',
      emailRequired: 'Email requis',
      passwordRequired: 'Mot de passe requis',
      invalidEmail: 'Email invalide',
      loginError: 'Email ou mot de passe incorrect',
      loginSuccess: 'Connexion réussie',
      licenseExpired: 'Licence expirée',
      orContinueWith: 'Ou continuer avec',
      ssoComingSoon: 'Bientôt disponible',
    },
    en: {
      title: 'Login',
      subtitle: 'Access your company account',
      emailLabel: 'Professional Email',
      emailPlaceholder: 'your.email@company.com',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      loginButton: 'Sign In',
      noAccount: "Don't have an account?",
      createAccount: 'Create company account',
      forgotPassword: 'Forgot password?',
      emailRequired: 'Email required',
      passwordRequired: 'Password required',
      invalidEmail: 'Invalid email',
      loginError: 'Incorrect email or password',
      loginSuccess: 'Login successful',
      licenseExpired: 'License expired',
      orContinueWith: 'Or continue with',
      ssoComingSoon: 'Coming soon',
    },
    es: {
      title: 'Iniciar sesión',
      subtitle: 'Accede a tu cuenta de empresa',
      emailLabel: 'Email profesional',
      emailPlaceholder: 'tu.email@empresa.com',
      passwordLabel: 'Contraseña',
      passwordPlaceholder: 'Ingresa tu contraseña',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      loginButton: 'Iniciar sesión',
      noAccount: '¿No tienes cuenta?',
      createAccount: 'Crear cuenta de empresa',
      forgotPassword: '¿Olvidaste tu contraseña?',
      emailRequired: 'Email requerido',
      passwordRequired: 'Contraseña requerida',
      invalidEmail: 'Email inválido',
      loginError: 'Email o contraseña incorrectos',
      loginSuccess: 'Inicio de sesión exitoso',
      licenseExpired: 'Licencia expirada',
      orContinueWith: 'O continuar con',
      ssoComingSoon: 'Próximamente',
    }
  }

  const texts = t[language]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      toast.error(texts.emailRequired)
      return
    }

    if (!email.includes('@')) {
      toast.error(texts.invalidEmail)
      return
    }

    if (!password) {
      toast.error(texts.passwordRequired)
      return
    }

    setIsLoading(true)

    try {
      const user = await db.getUserByEmail(email)

      if (!user) {
        toast.error(texts.loginError)
        setIsLoading(false)
        return
      }

      const isPasswordValid = await verifyPassword(password, user.passwordHash)

      if (!isPasswordValid) {
        toast.error(texts.loginError)
        setIsLoading(false)
        return
      }

      const company = await db.getCompanyById(user.companyId)

      if (!company) {
        toast.error(texts.loginError)
        setIsLoading(false)
        return
      }

      if (!company.license.isActive) {
        toast.error(texts.licenseExpired)
        setIsLoading(false)
        return
      }

      await db.updateUser(user.id, { lastLoginAt: Date.now() })

      toast.success(texts.loginSuccess)
      onLogin(company, { ...user, lastLoginAt: Date.now() })
    } catch (error) {
      toast.error(texts.loginError)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md bg-[#FFFFFF] border border-[#0F1419]/12 shadow-sm rounded-none">
      <CardHeader className="space-y-1.5 border-b border-[#0F1419]/10 pb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-8 h-8 bg-[#0F1419] text-[#F6F5F0] font-mono text-sm font-semibold flex items-center justify-center">
            K
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#525866]">
            Kova · Accès Recruteur
          </span>
        </div>
        <CardTitle className="font-editorial text-3xl text-[#0F1419] font-normal">{texts.title}</CardTitle>
        <CardDescription className="text-[#525866]">{texts.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="font-mono text-[11px] text-[#525866]">{texts.emailLabel}</Label>
            <Input
              id="email"
              type="email"
              placeholder={texts.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              className="rounded-none bg-[#F6F5F0] border-[#0F1419]/15 text-[#0F1419]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="font-mono text-[11px] text-[#525866]">{texts.passwordLabel}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={texts.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                className="pr-10 rounded-none bg-[#F6F5F0] border-[#0F1419]/15 text-[#0F1419]"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? texts.hidePassword : texts.showPassword}
              >
                {showPassword ? (
                  <EyeSlash size={18} className="text-[#525866]" />
                ) : (
                  <Eye size={18} className="text-[#525866]" />
                )}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full rounded-none bg-[#0F1419] text-[#F6F5F0] hover:bg-[#272D36] cursor-pointer"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                {texts.loginButton}...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <SignIn size={18} weight="bold" />
                {texts.loginButton}
              </span>
            )}
          </Button>

          <div className="text-center pt-1">
            <Button
              type="button"
              variant="link"
              className="text-xs text-[#525866] hover:text-[#0F1419] cursor-pointer"
              onClick={onForgotPassword}
            >
              {texts.forgotPassword}
            </Button>
          </div>

          <div className="text-center space-y-2 pt-3 border-t border-[#0F1419]/10">
            <p className="text-xs text-[#525866]">{texts.noAccount}</p>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none border-[#0F1419]/20 text-[#0F1419] hover:bg-[#F6F5F0] cursor-pointer"
              onClick={onCreateAccount}
            >
              {texts.createAccount}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
