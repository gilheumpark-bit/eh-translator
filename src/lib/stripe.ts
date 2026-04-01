import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-12-18.acacia' as any,
  appInfo: {
    name: 'EH-Translator-V3',
    version: '3.0.0',
  },
});

export const getStripeSession = async (priceId: string, customerId?: string, returnUrl?: string) => {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl || process.env.NEXT_PUBLIC_APP_URL}/?success=true`,
    cancel_url: `${returnUrl || process.env.NEXT_PUBLIC_APP_URL}/?cancel=true`,
    customer: customerId,
  });
};
