import { Router } from 'express';
import authRoutes from './auth.routes';
import customerRoutes from './customer.routes';
import paymentIntentRoutes from './paymentIntent.routes';
import paymentRoutes from './payment.routes';
import refundRoutes from './refund.routes';
import ledgerRoutes from './ledger.routes';
import webhookEndpointRoutes from './webhook.routes';
import webhookDeliveryRoutes from './webhookDelivery.routes';
import jobRoutes from './job.routes';
import dashboardRoutes from './dashboard.routes';

// Main API router — everything here is mounted under `/api/v1` by app.ts.
// Resource paths use snake_case (payment_intents) to mirror Stripe's API
// conventions, which the frontend client also follows.
const router = Router();

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/payment_intents', paymentIntentRoutes);
router.use('/payments', paymentRoutes);
router.use('/refunds', refundRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/webhook_endpoints', webhookEndpointRoutes);
router.use('/webhook_deliveries', webhookDeliveryRoutes);
router.use('/jobs', jobRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
