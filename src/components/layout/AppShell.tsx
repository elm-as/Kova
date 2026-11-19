import { useState, useEffect, type ReactNode } from 'react'
import { Language, Company, User } from '@/lib/types'
import { t } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Moon,
  Sun,
  Globe,
  Bell,
  Search,
  User as UserIcon,
  LogOut,
  Key,
  Monitor,
  LayoutDashboard,
  Briefcase,
  Building2,
  HelpCircle,
  SlidersHorizontal,
  Plus,
  Zap,
  ChevronDown,
} from 'lucide-react'
import { AppSidebar } from './Sidebar'
import { useTheme } from '@/hooks/use-theme'

export interface AppShellProps {
  activeView: string
  onNavigate: (view: string) => void
  language: Language
  onLanguageChange: (lang: Language) => void
  company: Company | null
  currentUser: User | null
  onLogout: () => void
  onChangePassword: () => void
  onUpgrade: () => void
  children: ReactNode
  onNewPosition?: () => void
}

const VIEW_CRUMBS: Record<string, { labelKey: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard: { labelKey: 'nav.dashboard', icon: LayoutDashboard },
  positions: { labelKey: 'nav.positions', icon: Briefcase },
  company: { labelKey: 'nav.company', icon: Building2 },
  faq: { labelKey: 'nav.faq', icon: HelpCircle },
  settings: { labelKey: 'nav.settings', icon: SlidersHorizontal },
}

function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  lang,
  onNewPosition,
  onUpgrade,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: string) => void
  lang: Language
  onNewPosition?: () => void
  onUpgrade: () => void
}) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t('header.searchPlaceholder', lang)} />
      <CommandList>
        <CommandEmpty>{t('common.noResults', lang)}</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => { onNavigate('dashboard'); onOpenChange(false) }}>
            <LayoutDashboard className="h-4 w-4 mr-2" />
            <span>{t('nav.dashboard', lang)}</span>
            <CommandShortcut>Alt+1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { onNavigate('positions'); onOpenChange(false) }}>
            <Briefcase className="h-4 w-4 mr-2" />
            <span>{t('nav.positions', lang)}</span>
            <CommandShortcut>Alt+2</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { onNavigate('company'); onOpenChange(false) }}>
            <Building2 className="h-4 w-4 mr-2" />
            <span>{t('nav.company', lang)}</span>
            <CommandShortcut>Alt+3</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { onNavigate('settings'); onOpenChange(false) }}>
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            <span>{t('nav.settings', lang)}</span>
            <CommandShortcut>Alt+4</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { onNavigate('faq'); onOpenChange(false) }}>
            <HelpCircle className="h-4 w-4 mr-2" />
            <span>{t('nav.faq', lang)}</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {onNewPosition && (
            <CommandItem onSelect={() => { onNewPosition(); onOpenChange(false) }}>
              <Plus className="h-4 w-4 mr-2" />
              <span>{t('dashboard.newPosition', lang)}</span>
              <CommandShortcut>Ctrl+N</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem onSelect={() => { onUpgrade(); onOpenChange(false) }}>
            <Zap className="h-4 w-4 mr-2" />
            <span>{t('sidebar.upgradeToPro', lang)}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

function NotificationsDropdown({ lang }: { lang: Language }) {
  const mockNotifications = [
    { id: 1, title: lang === 'fr' ? 'Nouveau candidat analysé' : 'New candidate analyzed', desc: lang === 'fr' ? 'Jean Dupont - Dev Senior' : 'Jean Dupont - Senior Dev', time: '5m', read: false },
    { id: 2, title: lang === 'fr' ? 'Période d\'essai expire' : 'Trial period expiring', desc: lang === 'fr' ? '3 jours restants' : '3 days remaining', time: '1h', read: false },
  ]

  const unreadCount = mockNotifications.filter(n => !n.read).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between text-xs">
          <span>{t('header.notifications', lang)}</span>
          <span className="text-[10px] text-muted-foreground font-normal">
            {unreadCount} {lang === 'fr' ? 'non lues' : 'unread'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {mockNotifications.map((n) => (
          <DropdownMenuItem key={n.id} className="flex items-start gap-2.5 py-2.5 cursor-default text-xs">
            <div className={cn(
              'mt-1 h-1.5 w-1.5 rounded-full shrink-0',
              n.read ? 'bg-muted-foreground/30' : 'bg-primary',
            )} />
            <div className="flex-1 min-w-0">
              <p className={cn('truncate', !n.read && 'font-semibold text-foreground')}>{n.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{n.desc}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{n.time}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {theme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : theme === 'light' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <Sun className="h-3.5 w-3.5 mr-2" />
            <span>{t('theme.light', 'fr')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <Moon className="h-3.5 w-3.5 mr-2" />
            <span>{t('theme.dark', 'fr')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <Monitor className="h-3.5 w-3.5 mr-2" />
            <span>{t('theme.system', 'fr')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LanguageToggle({
  onLanguageChange,
}: {
  language: Language
  onLanguageChange: (lang: Language) => void
}) {
  const labels: Record<Language, string> = { fr: 'Français', en: 'English', es: 'Español' }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onLanguageChange('fr')}>
            <span className="font-mono text-xs font-bold mr-2">FR</span>
            <span>{labels.fr}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLanguageChange('en')}>
            <span className="font-mono text-xs font-bold mr-2">EN</span>
            <span>{labels.en}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLanguageChange('es')}>
            <span className="font-mono text-xs font-bold mr-2">ES</span>
            <span>{labels.es}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu({
  currentUser,
  lang,
  onLogout,
  onChangePassword,
}: {
  currentUser: User | null
  lang: Language
  onLogout: () => void
  onChangePassword: () => void
}) {
  const initials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 gap-2 px-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden md:inline text-xs font-medium max-w-[120px] truncate">
            {currentUser?.name ?? ''}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-0.5">
            <p className="text-xs font-semibold leading-none">{currentUser?.name}</p>
            <p className="text-[11px] leading-none text-muted-foreground">{currentUser?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onChangePassword} className="text-xs">
            <Key className="h-3.5 w-3.5 mr-2" />
            <span>{lang === 'fr' ? 'Changer le mot de passe' : 'Change password'}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="text-xs text-destructive focus:text-destructive">
          <LogOut className="h-3.5 w-3.5 mr-2" />
          <span>{t('header.logout', lang)}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ShellHeader({
  activeView,
  onNavigate,
  language,
  onLanguageChange,
  company,
  currentUser,
  onLogout,
  onChangePassword,
  onOpenCommand,
}: {
  activeView: string
  onNavigate: (view: string) => void
  language: Language
  onLanguageChange: (lang: Language) => void
  company: Company | null
  currentUser: User | null
  onLogout: () => void
  onChangePassword: () => void
  onUpgrade: () => void
  onNewPosition?: () => void
  onOpenCommand: () => void
}) {
  const crumb = VIEW_CRUMBS[activeView]
  const CrumbIcon = crumb?.icon

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="flex h-12 items-center gap-3 px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="h-7 w-7" />
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <Breadcrumb className="hidden sm:flex">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => onNavigate('dashboard')} className="flex items-center gap-1 cursor-pointer">
                  {CrumbIcon && <CrumbIcon className="h-3.5 w-3.5" />}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <span className="text-xs font-semibold text-foreground">
                  {crumb ? t(crumb.labelKey, language) : ''}
                </span>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <span className="text-xs font-medium text-muted-foreground sm:hidden truncate flex-1">
          {company?.name}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenCommand}
                className="h-7 gap-2 px-2 text-xs text-muted-foreground hidden sm:flex border-border/70"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{t('header.search', language)}</span>
                <kbd className="pointer-events-none hidden lg:inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                  <span>Ctrl</span>K
                </kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('header.search', language)} (Ctrl+K)</TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenCommand}
            className="h-8 w-8 sm:hidden"
          >
            <Search className="h-4 w-4" />
          </Button>

          <NotificationsDropdown lang={language} />
          <ThemeToggle />
          <LanguageToggle language={language} onLanguageChange={onLanguageChange} />
          <UserMenu
            currentUser={currentUser}
            lang={language}
            onLogout={onLogout}
            onChangePassword={onChangePassword}
          />
        </div>
      </div>
    </header>
  )
}

export function AppShell({
  activeView,
  onNavigate,
  language,
  onLanguageChange,
  company,
  currentUser,
  onLogout,
  onChangePassword,
  onUpgrade,
  children,
  onNewPosition,
}: AppShellProps) {
  const [commandOpen, setCommandOpen] = useState(false)

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        activeView={activeView}
        onNavigate={onNavigate}
        language={language}
        company={company}
        onUpgrade={onUpgrade}
      />

      <SidebarInset>
        <ShellHeader
          activeView={activeView}
          onNavigate={onNavigate}
          language={language}
          onLanguageChange={onLanguageChange}
          company={company}
          currentUser={currentUser}
          onLogout={onLogout}
          onChangePassword={onChangePassword}
          onUpgrade={onUpgrade}
          onNewPosition={onNewPosition}
          onOpenCommand={() => setCommandOpen(true)}
        />

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-5">
            {children}
          </div>
        </div>
      </SidebarInset>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={onNavigate}
        lang={language}
        onNewPosition={onNewPosition}
        onUpgrade={onUpgrade}
      />
    </SidebarProvider>
  )
}
