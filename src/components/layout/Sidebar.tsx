import { Language, Company } from '@/lib/types'
import { t } from '@/lib/translations'
import { getDaysUntilExpiry } from '@/lib/payment'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  SlidersHorizontal,
  HelpCircle,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react'
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'

export interface SidebarProps {
  activeView: string
  onNavigate: (view: string) => void
  language: Language
  company: Company | null
  onUpgrade: () => void
}

// ---------------------------------------------------------------------------
// Nav items definition (4 domaines essentiels pour le recruteur)
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', shortcutKey: '1' },
  { id: 'positions', icon: Briefcase, labelKey: 'nav.positions', shortcutKey: '2' },
  { id: 'company', icon: Building2, labelKey: 'nav.company', shortcutKey: '3' },
  { id: 'settings', icon: SlidersHorizontal, labelKey: 'nav.settings', shortcutKey: '4' },
]

// ---------------------------------------------------------------------------
// Subscription status pill
// ---------------------------------------------------------------------------

function SubscriptionStatusPill({ company, lang }: { company: Company | null; lang: Language }) {
  if (!company) return null

  const days = getDaysUntilExpiry(company)
  const expired = days <= 0
  const expiringSoon = days <= 7 && days > 0
  const isTrialing = company.license.type === 'trial'

  const statusConfig = (() => {
    if (expired) return {
      icon: XCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/20',
      label: t('sidebar.subscriptionExpired', lang),
    }
    if (expiringSoon) return {
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      label: t('sidebar.subscriptionExpiring', lang, { days }),
    }
    if (isTrialing) return {
      icon: Clock,
      color: 'text-info',
      bg: 'bg-info/10',
      border: 'border-info/20',
      label: t('sidebar.trialDaysLeft', lang, { days }),
    }
    return {
      icon: CheckCircle2,
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/20',
      label: t('sidebar.subscriptionActive', lang),
    }
  })()

  const StatusIcon = statusConfig.icon

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs font-medium',
        statusConfig.bg,
        statusConfig.border,
        statusConfig.color,
      )}
    >
      <StatusIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{statusConfig.label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar Navigation
// ---------------------------------------------------------------------------

function SidebarNav({
  activeView,
  onNavigate,
  lang,
}: {
  activeView: string
  onNavigate: (view: string) => void
  lang: Language
}) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        {!collapsed && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold font-mono">
            Navigation
          </span>
        )}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id
            const Icon = item.icon

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => onNavigate(item.id)}
                  isActive={isActive}
                  tooltip={t(item.labelKey, lang)}
                  className="gap-2.5 h-8.5 rounded font-medium text-[13px]"
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span>{t(item.labelKey, lang)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// ---------------------------------------------------------------------------
// Sidebar Footer with FAQ + subscription + collapse button
// ---------------------------------------------------------------------------

function SidebarFooterSection({
  company,
  lang,
  onUpgrade,
  onNavigate,
  activeView,
}: {
  company: Company | null
  lang: Language
  onUpgrade: () => void
  onNavigate: (view: string) => void
  activeView: string
}) {
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === 'collapsed'

  return (
    <>
      <SidebarSeparator />
      <SidebarFooter className="p-2 space-y-1.5">
        {/* Accès d'aide / FAQ discret */}
        <button
          onClick={() => onNavigate('faq')}
          className={cn(
            'flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors w-full',
            activeView === 'faq' && 'bg-secondary font-semibold text-foreground',
            collapsed && 'justify-center',
          )}
          title="Guide & Questions fréquentes"
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>Aide & FAQ</span>}
        </button>

        {!collapsed && (
          <div className="space-y-1.5 pt-1">
            <SubscriptionStatusPill company={company} lang={lang} />

            {company && company.license.type !== 'enterprise' && (
              <button
                onClick={onUpgrade}
                className="flex w-full items-center justify-center gap-1.5 rounded bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>{t('sidebar.upgradeToPro', lang)}</span>
              </button>
            )}
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className={cn(
            'flex items-center gap-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors w-full',
            collapsed && 'justify-center',
          )}
          title={collapsed ? 'Développer' : 'Réduire'}
        >
          <ChevronLeft
            className={cn('h-3.5 w-3.5 transition-transform duration-200', collapsed && 'rotate-180')}
          />
          {!collapsed && <span className="text-[11px]">{t('nav.collapse', lang)}</span>}
        </button>
      </SidebarFooter>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sidebar Logo / Brand
// ---------------------------------------------------------------------------

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <SidebarHeader className="p-2.5">
      <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xs tracking-wider">
          K
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-bold tracking-tight text-foreground truncate">Kova</span>
            <span className="text-[10px] text-muted-foreground truncate font-mono">Talent Intelligence</span>
          </div>
        )}
      </div>
    </SidebarHeader>
  )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function AppSidebar({ activeView, onNavigate, language, company, onUpgrade }: SidebarProps) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  return (
    <SidebarPrimitive collapsible="icon" variant="sidebar">
      <SidebarBrand collapsed={collapsed} />
      <SidebarSeparator />
      <SidebarContent>
        <SidebarNav activeView={activeView} onNavigate={onNavigate} lang={language} />
      </SidebarContent>
      <SidebarFooterSection
        company={company}
        lang={language}
        onUpgrade={onUpgrade}
        onNavigate={onNavigate}
        activeView={activeView}
      />
    </SidebarPrimitive>
  )
}
