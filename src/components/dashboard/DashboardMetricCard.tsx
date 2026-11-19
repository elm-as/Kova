import { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface TrendInfo {
  direction: 'up' | 'down' | 'neutral'
  label: string
}

interface DashboardMetricCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  subtitle?: string
  trend?: TrendInfo
}

export default function DashboardMetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
}: DashboardMetricCardProps) {
  return (
    <Card className="border border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3.5 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground/70" />
      </CardHeader>
      <CardContent className="p-3.5 pt-0">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold font-mono tracking-tight tabular-nums text-foreground">
            {value}
          </span>
          {subtitle && (
            <span className="text-xs font-mono text-muted-foreground">{subtitle}</span>
          )}
        </div>
        {trend && trend.label && (
          <div
            className={cn(
              'mt-1 text-xs font-medium font-mono tabular-nums',
              trend.direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
              trend.direction === 'down' && 'text-red-600 dark:text-red-400',
              trend.direction === 'neutral' && 'text-muted-foreground'
            )}
          >
            {trend.label}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
