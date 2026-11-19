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

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' })
  }

  const secretKey = getEnv('STRIPE_SECRET_KEY')
  const webhookSecret = getEnv('STRIPE_WEBHOOK_SECRET')

  if (!secretKey || !webhookSecret) {
    return json(500, { error: 'Stripe keys not configured.' })
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2025-04-30.basil' })
  const sig = event.headers['stripe-signature']

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret)
  } catch (err: any) {
    return json(400, { error: `Webhook signature verification failed: ${err.message}` })
  }

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object as Stripe.Checkout.Session
      const { companyId, plan, billingCycle } = session.metadata || {}
      // TODO: Update company subscription in Supabase using companyId, plan, billingCycle
      // This requires a Supabase admin client. For now, log the event.
      console.log(`[Stripe Webhook] checkout.session.completed for company=${companyId}, plan=${plan}, cycle=${billingCycle}`)
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = stripeEvent.data.object as Stripe.Invoice
      console.log(`[Stripe Webhook] invoice.payment_succeeded: ${invoice.id}`)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = stripeEvent.data.object as Stripe.Invoice
      console.log(`[Stripe Webhook] invoice.payment_failed: ${invoice.id}`)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = stripeEvent.data.object as Stripe.Subscription
      console.log(`[Stripe Webhook] subscription deleted: ${subscription.id}`)
      break
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event: ${stripeEvent.type}`)
  }

  return json(200, { received: true })
}
