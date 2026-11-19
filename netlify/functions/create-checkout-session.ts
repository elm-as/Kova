import Stripe from 'stripe'

function getEnv(name: string): string | undefined {
  return process.env[name]
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  }
}

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  starter:      { monthly: 2900, yearly: 29000 },
  professional: { monthly: 7900, yearly: 79000 },
  enterprise:   { monthly: 19900, yearly: 199000 },
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' })
  }

  const secretKey = getEnv('STRIPE_SECRET_KEY')
  if (!secretKey) {
    return json(500, { error: 'STRIPE_SECRET_KEY is not configured.' })
  }

  let body: {
    plan?: string;
    billingCycle?: string;
    companyId?: string;
    successUrl?: string;
    cancelUrl?: string;
    customerEmail?: string;
  }
  try {
    body = event.body ? JSON.parse(event.body) : {}
  } catch {
    return json(400, {
      error: 'Format JSON invalide',
      message: 'Le corps de la requete doit etre au format JSON valide.',
    })
  }

  const { plan, billingCycle, companyId, successUrl, cancelUrl, customerEmail } = body

  if (!plan || !billingCycle || !companyId) {
    return json(400, {
      error: 'Champs obligatoires manquants',
      message: 'Les champs plan, billingCycle et companyId sont requis.',
      missing: [
        !plan && 'plan',
        !billingCycle && 'billingCycle',
        !companyId && 'companyId',
      ].filter(Boolean),
    })
  }

  if (!PLAN_PRICES[plan]) {
    return json(400, {
      error: 'Plan invalide',
      message: `Le plan "${plan}" n'est pas reconnu. Plans disponibles: ${Object.keys(PLAN_PRICES).join(', ')}.`,
    })
  }

  if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
    return json(400, {
      error: 'Cycle de facturation invalide',
      message: 'Le billingCycle doit etre "monthly" (mensuel) ou "yearly" (annuel).',
    })
  }

  const priceInCents = PLAN_PRICES[plan][billingCycle]
  const stripe = new Stripe(secretKey, { apiVersion: '2025-04-30.basil' })

  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: priceInCents,
            recurring: {
              interval: billingCycle === 'monthly' ? 'month' : 'year',
            },
            product_data: {
              name: `AI CV Scorer – ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
              description: `${billingCycle === 'monthly' ? 'Mensuel' : 'Annuel'}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        companyId,
        plan,
        billingCycle,
      },
      allow_promotion_codes: true,
      success_url: successUrl || `${getEnv('URL') || 'https://ai-cv-scorer.netlify.app'}/?payment=success`,
      cancel_url: cancelUrl || `${getEnv('URL') || 'https://ai-cv-scorer.netlify.app'}/?payment=cancelled`,
    }

    // Add customer email if provided
    if (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      sessionParams.customer_email = customerEmail
    }

    // Enable tax ID collection for EU customers
    sessionParams.tax_id_collection = { enabled: true }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return json(200, { sessionId: session.id, url: session.url })
  } catch (err: unknown) {
    const stripeError = err as { message?: string; type?: string; code?: string }
    return json(500, {
      error: 'Erreur Stripe',
      message: stripeError.message || 'Une erreur est survenue lors de la creation de la session de paiement.',
      stripeCode: stripeError.code || null,
      stripeType: stripeError.type || null,
    })
  }
}
