import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// ── Stripe Webhook Handler ────────────────────────────────────────────────────
// Infrastructure in place for future monetisation.
// No plan gates active at launch — all users get agency tier.
//
// When ready to gate:
// 1. Handle checkout.session.completed → provision plan
// 2. Handle customer.subscription.updated → update profiles.plan
// 3. Handle customer.subscription.deleted → downgrade to free

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-11-20.acacia',
  })
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  console.log(`Stripe event received: ${event.type}`)

  switch (event.type) {
    case 'checkout.session.completed': {
      // const session = event.data.object as Stripe.Checkout.Session
      // TODO: Provision plan for session.customer_email
      // await updateUserPlan(session.customer_email, 'starter')
      break
    }

    case 'customer.subscription.updated': {
      // const sub = event.data.object as Stripe.Subscription
      // TODO: Sync plan from sub.items.data[0].price.lookup_key
      break
    }

    case 'customer.subscription.deleted': {
      // const sub = event.data.object as Stripe.Subscription
      // TODO: Downgrade user to 'free' plan
      break
    }

    case 'invoice.payment_failed': {
      // TODO: Email user, suspend after grace period
      break
    }

    default:
      // Unhandled event — log and acknowledge
      break
  }

  return NextResponse.json({ received: true })
}
