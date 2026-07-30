import { Prisma } from '@prisma/client';
import { customerRepository } from '../repositories/customer.repository';
import { ConflictError, NotFoundError } from '../utils/AppError';
import type { CreateCustomerInput, UpdateCustomerInput } from '../validators/customer.validator';

// P2002 is Prisma's unique-constraint violation. We translate it to a domain
// ConflictError so the (merchantId,email) uniqueness surfaces as HTTP 409
// rather than a leaked 500.
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export const customerService = {
  async createCustomer(merchantId: string, input: CreateCustomerInput) {
    try {
      return await customerRepository.create({
        merchantId,
        email: input.email,
        name: input.name,
        phone: input.phone,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('A customer with this email already exists');
      }
      throw err;
    }
  },

  async retrieveCustomer(merchantId: string, id: string) {
    const customer = await customerRepository.findById(merchantId, id);
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  },

  listCustomers(params: { merchantId: string; search?: string; skip: number; take: number }) {
    return customerRepository.list(params);
  },

  async updateCustomer(merchantId: string, id: string, input: UpdateCustomerInput) {
    // Ensure the record exists and belongs to this merchant before writing.
    await this.retrieveCustomer(merchantId, id);
    try {
      await customerRepository.update(merchantId, id, {
        email: input.email,
        name: input.name,
        phone: input.phone,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('A customer with this email already exists');
      }
      throw err;
    }
    return this.retrieveCustomer(merchantId, id);
  },

  async deleteCustomer(merchantId: string, id: string) {
    const result = await customerRepository.delete(merchantId, id);
    if (result.count === 0) throw new NotFoundError('Customer not found');
  },
};
