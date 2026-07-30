import { PaymentStatus } from '@prisma/client';
import { paymentRepository } from '../repositories/payment.repository';
import { NotFoundError } from '../utils/AppError';

export const paymentService = {
  async retrievePayment(merchantId: string, id: string) {
    const payment = await paymentRepository.findById(merchantId, id);
    if (!payment) throw new NotFoundError('Payment not found');
    return payment;
  },

  listPayments(params: { merchantId: string; status?: PaymentStatus; skip: number; take: number }) {
    return paymentRepository.list(params);
  },
};
