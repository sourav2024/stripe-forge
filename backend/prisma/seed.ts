import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

// Seed a realistic demo merchant with customers, payments, refunds, ledger
// entries, a webhook endpoint, and job logs so the dashboard has content the
// moment the stack boots. Kept self-contained (no imports from src/) so it can
// run independently of the application code.
const prisma = new PrismaClient();

function rand(prefix: string, bytes = 16): string {
  return `${prefix}_${crypto.randomBytes(bytes).toString('hex')}`;
}

async function main(): Promise<void> {
  const email = 'demo@stripeforge.dev';
  const passwordHash = await bcrypt.hash('password123', 10);

  // Idempotent seed: wipe the demo merchant's graph if it already exists so
  // re-running `npm run seed` yields a clean, deterministic dataset.
  const existing = await prisma.merchant.findUnique({ where: { email } });
  if (existing) {
    await prisma.merchant.delete({ where: { id: existing.id } });
  }

  const merchant = await prisma.merchant.create({
    data: {
      email,
      passwordHash,
      name: 'Acme Payments (Demo)',
      role: 'OWNER',
      emailVerified: true,
      apiKeyPublic: rand('pk_test'),
      apiKeySecret: rand('sk_test'),
    },
  });

  const customerNames = [
    ['Ada Lovelace', 'ada@example.com'],
    ['Alan Turing', 'alan@example.com'],
    ['Grace Hopper', 'grace@example.com'],
    ['Katherine Johnson', 'katherine@example.com'],
    ['Dennis Ritchie', 'dennis@example.com'],
  ];

  const customers = [];
  for (const [name, custEmail] of customerNames) {
    customers.push(
      await prisma.customer.create({
        data: { merchantId: merchant.id, name, email: custEmail },
      }),
    );
  }

  // A spread of amounts and outcomes so charts and status filters have variety.
  const samples = [
    { amount: 2500n, status: 'succeeded' as const },
    { amount: 9900n, status: 'succeeded' as const },
    { amount: 4200n, status: 'succeeded' as const },
    { amount: 15000n, status: 'succeeded' as const },
    { amount: 780n, status: 'failed' as const },
    { amount: 33000n, status: 'succeeded' as const },
  ];

  let succeededCount = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const customer = customers[i % customers.length];
    const intent = await prisma.paymentIntent.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        amount: s.amount,
        currency: 'usd',
        status: s.status === 'succeeded' ? 'succeeded' : 'failed',
        description: `Order #${1000 + i}`,
        clientSecret: rand('pi_secret'),
      },
    });

    const payment = await prisma.payment.create({
      data: {
        merchantId: merchant.id,
        paymentIntentId: intent.id,
        customerId: customer.id,
        amount: s.amount,
        currency: 'usd',
        status: s.status,
      },
    });

    if (s.status === 'succeeded') {
      succeededCount++;
      const txId = rand('txn');
      // Double-entry: cash comes in (DEBIT CASH), merchant balance rises
      // (CREDIT MERCHANT_BALANCE). The two legs sum to zero.
      await prisma.ledgerEntry.createMany({
        data: [
          {
            merchantId: merchant.id,
            transactionId: txId,
            account: 'CASH',
            direction: 'DEBIT',
            amount: s.amount,
            paymentId: payment.id,
            description: 'Payment received',
          },
          {
            merchantId: merchant.id,
            transactionId: txId,
            account: 'MERCHANT_BALANCE',
            direction: 'CREDIT',
            amount: s.amount,
            paymentId: payment.id,
            description: 'Balance increase',
          },
        ],
      });
    }

    // Refund the second successful payment partially to exercise refund flows.
    if (i === 1) {
      const refundAmount = 4000n;
      const refund = await prisma.refund.create({
        data: {
          merchantId: merchant.id,
          paymentId: payment.id,
          amount: refundAmount,
          currency: 'usd',
          status: 'succeeded',
          reason: 'requested_by_customer',
        },
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { amountRefunded: refundAmount },
      });
      const txId = rand('txn');
      await prisma.ledgerEntry.createMany({
        data: [
          {
            merchantId: merchant.id,
            transactionId: txId,
            account: 'MERCHANT_BALANCE',
            direction: 'DEBIT',
            amount: refundAmount,
            paymentId: payment.id,
            refundId: refund.id,
            description: 'Refund issued',
          },
          {
            merchantId: merchant.id,
            transactionId: txId,
            account: 'CASH',
            direction: 'CREDIT',
            amount: refundAmount,
            paymentId: payment.id,
            refundId: refund.id,
            description: 'Cash returned',
          },
        ],
      });
    }
  }

  await prisma.webhookEndpoint.create({
    data: {
      merchantId: merchant.id,
      url: 'https://example.com/webhooks/stripeforge',
      signingSecret: rand('whsec'),
      enabledEvents: ['payment.succeeded', 'payment.failed', 'refund.created'],
      enabled: true,
    },
  });

  await prisma.jobLog.createMany({
    data: [
      { queue: 'receipt', jobId: '1', name: 'send-receipt', status: 'completed', attempts: 1 },
      { queue: 'webhook', jobId: '2', name: 'deliver-webhook', status: 'completed', attempts: 1 },
      { queue: 'email', jobId: '3', name: 'send-email', status: 'completed', attempts: 1 },
      { queue: 'webhook', jobId: '4', name: 'deliver-webhook', status: 'failed', attempts: 3, error: 'connect ETIMEDOUT' },
    ] satisfies Prisma.JobLogCreateManyInput[],
  });

  // eslint-disable-next-line no-console
  console.log(
    `✅ Seeded merchant ${merchant.email} (password: password123) with ${customers.length} customers, ${samples.length} payments (${succeededCount} succeeded), 1 refund, 1 webhook endpoint.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
