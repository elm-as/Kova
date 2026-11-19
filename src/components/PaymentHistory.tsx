import { useState, useMemo, useEffect } from 'react'
import { Company, Language, PaymentHistory as PaymentHistoryType } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, XCircle, Clock, ArrowCounterClockwise, Download, Funnel, Calendar, FileText, Empty } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPaymentStatus, getPaymentHistory, downloadInvoiceAsPDF, getInvoiceData } from '@/lib/payment'

interface PaymentHistoryComponentProps {
  company: Company
  language: Language
  className?: string
}

type PaymentStatusFilter = 'all' | 'succeeded' | 'failed' | 'refunded'

const ITEMS_PER_PAGE = 10

export default function PaymentHistoryComponent({
  company,
  language,
  className,
}: PaymentHistoryComponentProps) {
  const [payments, setPayments] = useState<PaymentHistoryType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    loadPayments()
  }, [company.id])

  const loadPayments = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const history = await getPaymentHistory(company.id)
      setPayments(history)
    } catch {
      setError(language === 'fr'
        ? 'Impossible de charger l\'historique des paiements.'
        : 'Unable to load payment history.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const texts = {
    fr: {
      title: 'Historique des paiements',
      subtitle: 'Consultez tous vos paiements et telechargez vos factures.',
      filterAll: 'Tous les statuts',
      filterSucceeded: 'Reussis',
      filterFailed: 'Echoues',
      filterRefunded: 'Rembourses',
      date: 'Date',
      description: 'Description',
      amount: 'Montant',
      status: 'Statut',
      invoice: 'Facture',
      download: 'Telecharger',
      downloading: 'Generation...',
      empty: 'Aucun paiement enregistre',
      emptyDesc: 'Votre historique de paiement apparaitra ici une fois votre premier paiement effectue.',
      previous: 'Precedent',
      next: 'Suivant',
      page: 'Page',
      of: 'sur',
      results: 'resultats',
      error: 'Erreur de chargement',
      retry: 'Reessayer',
      filter: 'Filtrer',
    },
    en: {
      title: 'Payment History',
      subtitle: 'View all your payments and download your invoices.',
      filterAll: 'All statuses',
      filterSucceeded: 'Succeeded',
      filterFailed: 'Failed',
      filterRefunded: 'Refunded',
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      status: 'Status',
      invoice: 'Invoice',
      download: 'Download',
      downloading: 'Generating...',
      empty: 'No payments recorded',
      emptyDesc: 'Your payment history will appear here once your first payment is processed.',
      previous: 'Previous',
      next: 'Next',
      page: 'Page',
      of: 'of',
      results: 'results',
      error: 'Loading error',
      retry: 'Retry',
      filter: 'Filter',
    },
  }

  const t = texts[language]

  const filteredPayments = useMemo(() => {
    if (statusFilter === 'all') return payments
    return payments.filter((p) => p.status === statusFilter)
  }, [payments, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / ITEMS_PER_PAGE))
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredPayments.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredPayments, currentPage])

  // Reset page when filter changes
  const handleFilterChange = (value: string) => {
    setStatusFilter(value as PaymentStatusFilter)
    setCurrentPage(1)
  }

  const getStatusIcon = (status: PaymentHistoryType['status']) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle size={18} weight="duotone" className="text-emerald-500" />
      case 'failed':
        return <XCircle size={18} weight="duotone" className="text-red-500" />
      case 'pending':
        return <Clock size={18} weight="duotone" className="text-amber-500" />
      case 'refunded':
        return <ArrowCounterClockwise size={18} weight="duotone" className="text-slate-500" />
      default:
        return <Clock size={18} weight="duotone" className="text-muted-foreground" />
    }
  }

  const handleDownloadInvoice = async (payment: PaymentHistoryType) => {
    setDownloadingId(payment.id)
    try {
      const invoiceData = getInvoiceData(
        payment,
        { name: company.name, email: company.email },
        company.license.type === 'trial'
          ? (language === 'fr' ? 'Essai' : 'Trial')
          : company.license.type === 'starter'
            ? (language === 'fr' ? 'Demarrage' : 'Starter')
            : company.license.type === 'professional'
              ? (language === 'fr' ? 'Professionnel' : 'Professional')
              : 'Enterprise',
        'yearly' // Default assumption, could be refined with actual data
      )
      downloadInvoiceAsPDF(invoiceData)
    } catch {
      // Silently fail, the download is a convenience feature
    } finally {
      setDownloadingId(null)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(
      language === 'fr' ? 'fr-FR' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' }
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardHeader>
          <CardTitle className="text-destructive">{t.error}</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={loadPayments} variant="outline" className="gap-2">
            <ArrowCounterClockwise size={16} weight="duotone" />
            {t.retry}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar size={22} weight="duotone" className="text-primary" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </div>

        {/* Filter */}
        {payments.length > 0 && (
          <div className="flex items-center gap-2">
            <Funnel size={16} weight="duotone" className="text-muted-foreground" />
            <Select value={statusFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[170px] h-9 text-sm">
                <SelectValue placeholder={t.filter} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.filterAll}</SelectItem>
                <SelectItem value="succeeded">{t.filterSucceeded}</SelectItem>
                <SelectItem value="failed">{t.filterFailed}</SelectItem>
                <SelectItem value="refunded">{t.filterRefunded}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="pt-6">
        {/* Empty state */}
        {payments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Empty size={40} weight="duotone" className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t.empty}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t.emptyDesc}
            </p>
          </motion.div>
        ) : (
          <>
            {/* Filtered empty */}
            {filteredPayments.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <Funnel size={40} weight="duotone" className="text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {language === 'fr' ? 'Aucun resultat' : 'No results'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'fr'
                    ? 'Aucun paiement ne correspond a ce filtre.'
                    : 'No payments match this filter.'}
                </p>
              </motion.div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">{t.date}</TableHead>
                        <TableHead>{t.description}</TableHead>
                        <TableHead className="w-[120px]">{t.amount}</TableHead>
                        <TableHead className="w-[130px]">{t.status}</TableHead>
                        <TableHead className="w-[100px] text-right">{t.invoice}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {paginatedPayments.map((payment, index) => {
                          const statusInfo = formatPaymentStatus(payment.status, language)
                          return (
                            <motion.tr
                              key={payment.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{ duration: 0.2, delay: index * 0.03 }}
                              className="border-b border-border hover:bg-muted/30 transition-colors"
                            >
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(payment.status)}
                                  {formatDate(payment.createdAt)}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {payment.description}
                              </TableCell>
                              <TableCell className="text-sm font-semibold">
                                {formatCurrency(payment.amount, payment.currency)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={statusInfo.variant}
                                  className={cn(
                                    'text-xs font-medium',
                                    payment.status === 'succeeded' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                                    payment.status === 'failed' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                    payment.status === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                    payment.status === 'refunded' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                                  )}
                                >
                                  {statusInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {payment.status === 'succeeded' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadInvoice(payment)}
                                    disabled={downloadingId === payment.id}
                                    className="h-8 gap-1.5"
                                  >
                                    {downloadingId === payment.id ? (
                                      <Clock size={14} weight="duotone" className="animate-spin" />
                                    ) : (
                                      <Download size={14} weight="duotone" />
                                    )}
                                    <span className="text-xs">
                                      {downloadingId === payment.id ? t.downloading : t.download}
                                    </span>
                                  </Button>
                                )}
                              </TableCell>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-muted-foreground">
                      {t.page} {currentPage} {t.of} {totalPages}
                      {' '}({filteredPayments.length} {t.results})
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 text-xs"
                      >
                        {t.previous}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 text-xs"
                      >
                        {t.next}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
