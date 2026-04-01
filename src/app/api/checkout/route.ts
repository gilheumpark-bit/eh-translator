import { NextRequest, NextResponse } from 'next/server';
import { getStripeSession } from '@/lib/stripe';

/**
 * Stripe Checkout for subscription (optional). Requires STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PRICE_ID in env.
 */
export async function POST(req: NextRequest) {
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || '';
  if (!priceId) {
    return NextResponse.json({ error: 'Stripe 가격 ID가 설정되지 않았습니다.' }, { status: 501 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const returnUrl =
      typeof body.returnUrl === 'string' ? body.returnUrl : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await getStripeSession(priceId, undefined, returnUrl);
    if (!session.url) {
      return NextResponse.json({ error: 'Checkout 세션을 만들 수 없습니다.' }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('checkout error', e);
    return NextResponse.json({ error: '결제 세션 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
