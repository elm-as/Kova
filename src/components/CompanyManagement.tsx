import { Company, User, LicenseType, UserRole, Language, WebhookEventType } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Building, 
  Users, 
  Briefcase, 
  UserPlus,
  Calendar,
  CheckCircle,
  WarningCircle,
  Crown,
  Trash,
  PencilSimple
} from '@phosphor-icons/react'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'
import { toast } from 'sonner'
import { SubscriptionSection } from '@/components/SubscriptionSection'
import { PaymentPage } from '@/components/PaymentPage'
import { SubscriptionDebug } from '@/components/SubscriptionDebug'
import { kvGet } from '@/lib/kv'
import { getWebhooksByCompany, addWebhook, removeWebhook, toggleWebhook } from '@/lib/webhooks'
import { t as translate } from '@/lib/translations'
import { Clipboard, Link as LinkIcon } from '@phosphor-icons/react'

interface CompanyManagementProps {
  company: Company
  currentUser: User
  allUsers: User[]
  positionsCount: number
  candidatesCount: number
  language: Language
  onUpdateCompany: (company: Company) => void
  onAddUser: (user: User) => void
  onDeleteUser?: (userId: string) => void
  onUpdateUserRole?: (userId: string, newRole: UserRole) => void
}

const ALL_WEBHOOK_EVENTS: WebhookEventType[] = [
  'candidate.analyzed', 'candidate.created', 'candidate.deleted',
  'position.created', 'position.updated', 'position.deleted',
  'subscription.changed',
]

export function CompanyManagement({
  company,
  currentUser,
  allUsers,
  positionsCount,
  candidatesCount,
  language,
  onUpdateCompany,
  onAddUser,
  onDeleteUser,
  onUpdateUserRole,
}: CompanyManagementProps) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'recruiter' | 'viewer'>('recruiter')
  const [isLoading, setIsLoading] = useState(false)
  const [showPaymentPage, setShowPaymentPage] = useState(false)
  const [webhooks, setWebhooks] = useState(() => getWebhooksByCompany(company.id))
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [newWebhookEvents, setNewWebhookEvents] = useState<WebhookEventType[]>([])
  const [isAddWebhookOpen, setIsAddWebhookOpen] = useState(false)

  const t = {
    fr: {
      title: 'Gestion de l\'entreprise',
      licenseInfo: 'Informations de licence',
      usageStats: 'Statistiques d\'utilisation',
      teamMembers: 'Membres de l\'équipe',
      licenseType: 'Type de licence',
      status: 'Statut',
      active: 'Active',
      expired: 'Expirée',
      expiresOn: 'Expire le',
      users: 'Utilisateurs',
      positions: 'Postes',
      candidates: 'Candidats',
      unlimited: 'Illimité',
      features: 'Fonctionnalités',
      bulkOps: 'Opérations groupées',
      analytics: 'Analyses avancées',
      emails: 'Modèles d\'emails',
      api: 'Accès API',
      branding: 'Personnalisation',
      enabled: 'Activé',
      disabled: 'Désactivé',
      addUser: 'Ajouter un utilisateur',
      userName: 'Nom complet',
      userEmail: 'Email',
      role: 'Rôle',
      owner: 'Propriétaire',
      admin: 'Administrateur',
      recruiter: 'Recruteur',
      viewer: 'Observateur',
      cancel: 'Annuler',
      add: 'Ajouter',
      userAdded: 'Utilisateur ajouté avec succès',
      limitReached: 'Limite d\'utilisateurs atteinte',
      emailExists: 'Cet email est déjà utilisé',
      allFieldsRequired: 'Tous les champs sont requis',
      invalidEmail: 'Email invalide'
    },
    en: {
      title: 'Company Management',
      licenseInfo: 'License Information',
      usageStats: 'Usage Statistics',
      teamMembers: 'Team Members',
      licenseType: 'License Type',
      status: 'Status',
      active: 'Active',
      expired: 'Expired',
      expiresOn: 'Expires on',
      users: 'Users',
      positions: 'Positions',
      candidates: 'Candidates',
      unlimited: 'Unlimited',
      features: 'Features',
      bulkOps: 'Bulk Operations',
      analytics: 'Advanced Analytics',
      emails: 'Email Templates',
      api: 'API Access',
      branding: 'Custom Branding',
      enabled: 'Enabled',
      disabled: 'Disabled',
      addUser: 'Add User',
      userName: 'Full Name',
      userEmail: 'Email',
      role: 'Role',
      owner: 'Owner',
      admin: 'Administrator',
      recruiter: 'Recruiter',
      viewer: 'Viewer',
      cancel: 'Cancel',
      add: 'Add',
      userAdded: 'User added successfully',
      limitReached: 'User limit reached',
      emailExists: 'This email is already in use',
      allFieldsRequired: 'All fields are required',
      invalidEmail: 'Invalid email'
    },
    es: {
      title: 'Gestión de la empresa',
      licenseInfo: 'Información de licencia',
      usageStats: 'Estadísticas de uso',
      teamMembers: 'Miembros del equipo',
      licenseType: 'Tipo de licencia',
      status: 'Estado',
      active: 'Activa',
      expired: 'Expirada',
      expiresOn: 'Expira el',
      users: 'Usuarios',
      positions: 'Puestos',
      candidates: 'Candidatos',
      unlimited: 'Ilimitado',
      features: 'Funcionalidades',
      bulkOps: 'Operaciones masivas',
      analytics: 'Análisis avanzados',
      emails: 'Plantillas de email',
      api: 'Acceso API',
      branding: 'Personalización',
      enabled: 'Activado',
      disabled: 'Desactivado',
      addUser: 'Agregar usuario',
      userName: 'Nombre completo',
      userEmail: 'Email',
      role: 'Rol',
      owner: 'Propietario',
      admin: 'Administrador',
      recruiter: 'Reclutador',
      viewer: 'Observador',
      cancel: 'Cancelar',
      add: 'Agregar',
      userAdded: 'Usuario agregado con éxito',
      limitReached: 'Límite de usuarios alcanzado',
      emailExists: 'Este email ya está en uso',
      allFieldsRequired: 'Todos los campos son obligatorios',
      invalidEmail: 'Email inválido'
    }
  }

  const texts = t[language]

  const companyUsers = allUsers.filter(u => u.companyId === company.id)
  const daysUntilExpiry = Math.ceil((company.license.expiryDate - Date.now()) / (1000 * 60 * 60 * 24))
  const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0

  const usersPercentage = company.license.maxUsers === -1 
    ? 0 
    : (companyUsers.length / company.license.maxUsers) * 100

  const positionsPercentage = company.license.maxPositions === -1 
    ? 0 
    : (positionsCount / company.license.maxPositions) * 100

  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail) {
      toast.error(texts.allFieldsRequired)
      return
    }

    if (!newUserEmail.includes('@')) {
      toast.error(texts.invalidEmail)
      return
    }

    if (company.license.maxUsers !== -1 && companyUsers.length >= company.license.maxUsers) {
      toast.error(texts.limitReached)
      return
    }

    if (allUsers.some(u => u.email.toLowerCase() === newUserEmail.toLowerCase())) {
      toast.error(texts.emailExists)
      return
    }

    setIsLoading(true)

    const temporaryPassword = (await kvGet<string>('temp-password')) || 'ChangeMe123!'
    const { hashPassword } = await import('@/lib/password')
    const passwordHash = await hashPassword(temporaryPassword)

    const newUser: User = {
      id: `user-${Date.now()}`,
      companyId: company.id,
      name: newUserName,
      email: newUserEmail,
      passwordHash,
      role: newUserRole,
      createdAt: Date.now()
    }

    await onAddUser(newUser)
    
    setNewUserName('')
    setNewUserEmail('')
    setNewUserRole('recruiter')
    setIsAddUserOpen(false)
    setIsLoading(false)
    toast.success(texts.userAdded)
  }

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown size={16} weight="fill" className="text-yellow-500" />
    return null
  }

  const getLicenseTypeBadge = (type: LicenseType) => {
    const variants: Record<LicenseType, 'default' | 'secondary' | 'outline'> = {
      trial: 'outline',
      starter: 'secondary',
      professional: 'default',
      enterprise: 'default'
    }
    return variants[type]
  }

  if (showPaymentPage) {
    return (
      <PaymentPage
        company={company}
        language={language}
        onUpdateCompany={onUpdateCompany}
        onCancel={() => setShowPaymentPage(false)}
      />
    )
  }

  const handleExpireSubscription = () => {
    const expiredCompany: Company = {
      ...company,
      license: {
        ...company.license,
        expiryDate: Date.now() - 1000,
        isActive: false,
      },
      subscription: {
        ...company.subscription,
        status: 'expired',
      },
    }
    onUpdateCompany(expiredCompany)
    toast.info(language === 'fr' ? 'Abonnement expiré (test)' : 'Subscription expired (test)')
  }

  const handleRestoreSubscription = () => {
    const restoredCompany: Company = {
      ...company,
      license: {
        ...company.license,
        expiryDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
      subscription: {
        ...company.subscription,
        status: 'active',
        currentPeriodEnd: Date.now() + (365 * 24 * 60 * 60 * 1000),
        nextPaymentDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
      },
    }
    onUpdateCompany(restoredCompany)
    toast.success(language === 'fr' ? 'Abonnement restauré' : 'Subscription restored')
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {currentUser.role === 'owner' && import.meta.env.DEV && (
        <SubscriptionDebug
          company={company}
          onExpireSubscription={handleExpireSubscription}
          onRestoreSubscription={handleRestoreSubscription}
        />
      )}
      
      <SubscriptionSection
        company={company}
        language={language}
        onManageSubscription={() => setShowPaymentPage(true)}
      />
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold">{texts.title}</h2>
        {(currentUser.role === 'owner' || currentUser.role === 'admin') && (
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus size={16} weight="bold" />
                <span className="hidden sm:inline">{texts.addUser}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{texts.addUser}</DialogTitle>
                <DialogDescription>
                  {language === 'fr' 
                    ? 'Ajoutez un nouveau membre à votre équipe'
                    : 'Add a new member to your team'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="new-user-name">{texts.userName}</Label>
                  <Input
                    id="new-user-name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-email">{texts.userEmail}</Label>
                  <Input
                    id="new-user-email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-role">{texts.role}</Label>
                  <Select value={newUserRole} onValueChange={(v: any) => setNewUserRole(v)}>
                    <SelectTrigger id="new-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">{texts.admin}</SelectItem>
                      <SelectItem value="recruiter">{texts.recruiter}</SelectItem>
                      <SelectItem value="viewer">{texts.viewer}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsAddUserOpen(false)}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    {texts.cancel}
                  </Button>
                  <Button 
                    onClick={handleAddUser} 
                    className="flex-1"
                    disabled={isLoading}
                  >
                    {texts.add}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Building size={20} weight="duotone" />
              {company.name}
            </CardTitle>
            <CardDescription className="break-all">{company.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{texts.licenseType}</span>
                <Badge variant={getLicenseTypeBadge(company.license.type)}>
                  {company.license.type.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{texts.status}</span>
                <div className="flex items-center gap-1">
                  {company.license.isActive ? (
                    <>
                      <CheckCircle size={16} weight="fill" className="text-green-500" />
                      <span className="text-sm text-green-600">{texts.active}</span>
                    </>
                  ) : (
                    <>
                      <WarningCircle size={16} weight="fill" className="text-red-500" />
                      <span className="text-sm text-red-600">{texts.expired}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {company.license.isActive && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">{texts.expiresOn}</span>
                  <span className={isExpiringSoon ? 'text-orange-600 font-medium' : ''}>
                    {new Date(company.license.expiryDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                  </span>
                </div>
                {isExpiringSoon && (
                  <p className="text-xs text-orange-600">
                    {language === 'fr' 
                      ? `⚠️ Expire dans ${daysUntilExpiry} jours`
                      : `⚠️ Expires in ${daysUntilExpiry} days`}
                  </p>
                )}
              </div>
            )}

            <div className="pt-2 border-t space-y-2">
              <p className="text-sm font-semibold">{texts.features}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className={company.license.features.bulkOperations ? 'text-green-600' : 'text-muted-foreground'}>
                    {company.license.features.bulkOperations ? '✓' : '✗'}
                  </span>
                  <span>{texts.bulkOps}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={company.license.features.advancedAnalytics ? 'text-green-600' : 'text-muted-foreground'}>
                    {company.license.features.advancedAnalytics ? '✓' : '✗'}
                  </span>
                  <span>{texts.analytics}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={company.license.features.emailTemplates ? 'text-green-600' : 'text-muted-foreground'}>
                    {company.license.features.emailTemplates ? '✓' : '✗'}
                  </span>
                  <span>{texts.emails}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={company.license.features.apiAccess ? 'text-green-600' : 'text-muted-foreground'}>
                    {company.license.features.apiAccess ? '✓' : '✗'}
                  </span>
                  <span>{texts.api}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">{texts.usageStats}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Users size={16} weight="duotone" />
                  {texts.users}
                </span>
                <span className="font-medium">
                  {companyUsers.length}
                  {company.license.maxUsers !== -1 && ` / ${company.license.maxUsers}`}
                  {company.license.maxUsers === -1 && ` (${texts.unlimited})`}
                </span>
              </div>
              {company.license.maxUsers !== -1 && (
                <Progress value={usersPercentage} className="h-2" />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Briefcase size={16} weight="duotone" />
                  {texts.positions}
                </span>
                <span className="font-medium">
                  {positionsCount}
                  {company.license.maxPositions !== -1 && ` / ${company.license.maxPositions}`}
                  {company.license.maxPositions === -1 && ` (${texts.unlimited})`}
                </span>
              </div>
              {company.license.maxPositions !== -1 && (
                <Progress value={positionsPercentage} className="h-2" />
              )}
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm font-semibold mb-3">{texts.teamMembers}</p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {companyUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between text-xs sm:text-sm p-2 rounded bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0">
                      {getRoleIcon(user.role)}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {(currentUser.role === 'owner' || currentUser.role === 'admin') && user.id !== currentUser.id && user.role !== 'owner' && (
                        <>
                          <Select
                            value={user.role}
                            onValueChange={(newRole: string) => {
                              if (onUpdateUserRole) {
                                onUpdateUserRole(user.id, newRole as UserRole)
                                toast.success(language === 'fr' ? 'Rôle mis à jour' : 'Role updated')
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 w-[100px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{texts.admin}</SelectItem>
                              <SelectItem value="recruiter">{texts.recruiter}</SelectItem>
                              <SelectItem value="viewer">{texts.viewer}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (onDeleteUser && confirm(language === 'fr' ? 'Supprimer cet utilisateur ?' : 'Delete this user?')) {
                                onDeleteUser(user.id)
                                toast.success(language === 'fr' ? 'Utilisateur supprimé' : 'User deleted')
                              }
                            }}
                          >
                            <Trash size={14} />
                          </Button>
                        </>
                      )}
                      {(user.id === currentUser.id || user.role === 'owner') && (
                        <Badge variant="outline" className="text-xs">
                          {texts[user.role as keyof typeof texts] || user.role}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhooks Section */}
        {company.license.features.apiAccess && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon size={20} />
                    {translate('webhooks.title', language)}
                  </CardTitle>
                  <CardDescription>{translate('webhooks.description', language)}</CardDescription>
                </div>
                <Dialog open={isAddWebhookOpen} onOpenChange={setIsAddWebhookOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">{translate('webhooks.addWebhook', language)}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{translate('webhooks.addWebhook', language)}</DialogTitle>
                      <DialogDescription>{translate('webhooks.description', language)}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{translate('webhooks.url', language)}</Label>
                        <Input
                          value={newWebhookUrl}
                          onChange={(e) => setNewWebhookUrl(e.target.value)}
                          placeholder={translate('webhooks.urlPlaceholder', language)}
                          type="url"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{translate('webhooks.events', language)}</Label>
                        <div className="grid grid-cols-1 gap-1.5">
                          {ALL_WEBHOOK_EVENTS.map(evt => (
                            <label key={evt} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newWebhookEvents.includes(evt)}
                                onChange={(e) => {
                                  setNewWebhookEvents(prev =>
                                    e.target.checked ? [...prev, evt] : prev.filter(x => x !== evt)
                                  )
                                }}
                                className="rounded"
                              />
                              {translate(`webhooks.eventTypes.${evt}`, language)}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddWebhookOpen(false)}>{texts.cancel}</Button>
                        <Button onClick={() => {
                          if (!newWebhookUrl || newWebhookEvents.length === 0) return
                          try { new URL(newWebhookUrl) } catch { return }
                          const sub = addWebhook(company.id, newWebhookUrl, newWebhookEvents)
                          setWebhooks(prev => [...prev, sub])
                          setNewWebhookUrl('')
                          setNewWebhookEvents([])
                          setIsAddWebhookOpen(false)
                        }}>
                          {texts.add}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {webhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{translate('webhooks.noWebhooks', language)}</p>
              ) : (
                <div className="space-y-3">
                  {webhooks.map(wh => (
                    <div key={wh.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1 min-w-0 flex-1 mr-3">
                        <p className="text-sm font-medium truncate">{wh.url}</p>
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map(evt => (
                            <Badge key={evt} variant="secondary" className="text-xs">
                              {translate(`webhooks.eventTypes.${evt}`, language)}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {translate('webhooks.lastTriggered', language)}:{' '}
                          {wh.lastTriggeredAt ? new Date(wh.lastTriggeredAt).toLocaleString() : translate('webhooks.never', language)}
                          {wh.failCount > 0 && (
                            <span className="text-destructive ml-2">
                              ({wh.failCount} {translate('webhooks.failures', language)})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={translate('webhooks.secret', language)}
                          onClick={() => {
                            navigator.clipboard.writeText(wh.secret)
                            toast.success(translate('webhooks.secretCopied', language))
                          }}
                        >
                          <Clipboard size={14} />
                        </Button>
                        <Badge
                          variant={wh.active ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                          onClick={() => {
                            toggleWebhook(wh.id)
                            setWebhooks(getWebhooksByCompany(company.id))
                          }}
                        >
                          {wh.active ? translate('webhooks.active', language) : translate('webhooks.inactive', language)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            removeWebhook(wh.id)
                            setWebhooks(prev => prev.filter(s => s.id !== wh.id))
                          }}
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Embeddable Widget Snippet */}
        {company.license.features.apiAccess && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon size={20} />
                {language === 'fr' ? 'Widget intégrable' : language === 'es' ? 'Widget integrable' : 'Embeddable Widget'}
              </CardTitle>
              <CardDescription>
                {language === 'fr'
                  ? 'Intégrez un formulaire de candidature sur votre site carrière.'
                  : language === 'es'
                    ? 'Integre un formulario de candidatura en su sitio de carreras.'
                    : 'Embed an application form on your careers page.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-all select-all">
{`<div id="ai-recruit-widget"></div>
<script
  src="${window.location.origin}/widget.js"
  data-company-id="${company.id}"
  data-position-id="YOUR_POSITION_ID"
  data-lang="${language}">
</script>`}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(
`<div id="ai-recruit-widget"></div>\n<script src="${window.location.origin}/widget.js" data-company-id="${company.id}" data-position-id="YOUR_POSITION_ID" data-lang="${language}"></script>`
                  )
                  toast.success(language === 'fr' ? 'Snippet copié' : language === 'es' ? 'Snippet copiado' : 'Snippet copied')
                }}
              >
                <Clipboard size={14} className="mr-1" />
                {language === 'fr' ? 'Copier' : language === 'es' ? 'Copiar' : 'Copy'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
