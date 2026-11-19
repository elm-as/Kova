import { useState, useEffect } from 'react'
import { Company, Language, PaymentHistory as PaymentHistoryType } from '@/lib/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Download, FileText, Receipt, Calendar, CheckCircle, Clock, ArrowCounterClockwise, Empty } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatCurrency, getPaymentHistory, downloadInvoiceAsPDF, getInvoiceData } from '@/lib/payment'

interface InvoiceManagerProps {
  company: Company
  language: Language
  className?: string
}

export default function InvoiceManager({
  company,
  language,
  className,
}: InvoiceManagerProps) {
  const [invoices, setInvoices] = useState<PaymentHistoryType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    loadInvoices()
  }, [company.id])

  const loadInvoices = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const history = await getPaymentHistory(company.id)
      // Only succeeded payments have downloadable invoices
      setInvoices(history.filter((p) => p.status === 'succeeded'))
    } catch {
      setError(language === 'fr'
        ? 'Impossible de charger les factures.'
        : 'Unable to load invoices.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const texts = {
    fr: {
      title: 'Factures',
      subtitle: 'Telechargez vos factures au format PDF.',
      invoiceNumber: 'Facture N',
      date: 'Date',
      amount: 'Montant',
      download: 'Telecharger',
      downloading: 'Generation...',
      empty: 'Aucune facture disponible',
      emptyDesc: 'Vos factures apparaitront ici apres votre premier paiement reussi.',
      error: 'Erreur de chargement',
      retry: 'Reessayer',
      plan: 'Plan',
      total: 'Total',
      downloadAll: 'Tout telecharger',
    },
    en: {
      title: 'Invoices',
      subtitle: 'Download your invoices in PDF format.',
      invoiceNumber: 'Invoice #',
      date: 'Date',
      amount: 'Amount',
      download: 'Download',
      downloading: 'Generating...',
      empty: 'No invoices available',
      emptyDesc: 'Your invoices will appear here after your first successful payment.',
      error: 'Loading error',
      retry: 'Retry',
      plan: 'Plan',
      total: 'Total',
      downloadAll: 'Download all',
    },
  }

  const t = texts[language]

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(
      language === 'fr' ? 'fr-FR' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' }
    )
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
        'yearly'
      )
      downloadInvoiceAsPDF(invoiceData)
    } catch {
      // Silently fail
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDownloadAll = async () => {
    for (const payment of invoices) {
      setDownloadingId(payment.id)
      try {
        const invoiceData = getInvoiceData(
          payment,
          { name: company.name, email: company.email },
          company.license.type === 'trial'
            ? 'Trial'
            : company.license.type === 'starter'
              ? 'Starter'
              : company.license.type === 'professional'
                ? 'Professional'
                : 'Enterprise',
          'yearly'
        )
        downloadInvoiceAsPDF(invoiceData)
        // Small delay between downloads to avoid browser blocking
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch {
        // Continue with next
      }
    }
    setDownloadingId(null)
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
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="w-24 h-8 bg-muted rounded" />
              </div>
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
          <Button onClick={loadInvoices} variant="outline" className="gap-2">
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
            <Receipt size={22} weight="duotone" className="text-primary" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </div>
        {invoices.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloadingId !== null}
            className="gap-2 h-9"
          >
            <Download size={16} weight="duotone" />
            {t.downloadAll}
          </Button>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="pt-6">
        {invoices.length === 0 ? (
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
          <div className="space-y-2">
            {invoices.map((invoice, index) => (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
                className="flex items-center gap-4 p-3 sm:p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/20 transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Receipt size={22} weight="duotone" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">
                      {t.invoiceNumber} {invoice.id}
                    </p>
                    <Badge
                      variant="default"
                      className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] h-4 px-1.5"
                    >
                      <CheckCircle size={10} weight="fill" className="mr-1" />
                      {language === 'fr' ? 'Payee' : 'Paid'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Calendar size={12} weight="duotone" />
                    <span>{formatDate(invoice.createdAt)}</span>
                    <span className="text-border">|</span>
                    <FileText size={12} weight="duotone" />
                    <span className="truncate">{invoice.description}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownloadInvoice(invoice)}
                  disabled={downloadingId !== null}
                  className={cn(
                    'shrink-0 gap-1.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors',
                    downloadingId === invoice.id && 'opacity-50'
                  )}
                >
                  {downloadingId === invoice.id ? (
                    <Clock size={14} weight="duotone" className="animate-spin" />
                  ) : (
                    <Download size={14} weight="duotone" />
                  )}
                  <span className="hidden sm:inline text-xs">
                    {downloadingId === invoice.id ? t.downloading : t.download}
                  </span>
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>

      {invoices.length > 0 && (
        <>
          <Separator />
          <CardFooter className="pt-4 flex justify-between">
            <div className="text-sm text-muted-foreground">
              {invoices.length} {invoices.length > 1
                ? (language === 'fr' ? 'factures' : 'invoices')
                : (language === 'fr' ? 'facture' : 'invoice')
              }
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground mr-2">{t.total}</span>
              <span className="font-bold">
                {formatCurrency(
                  invoices.reduce((sum, inv) => sum + inv.amount, 0),
                  invoices[0]?.currency || 'EUR'
                )}
              </span>
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  )
}
