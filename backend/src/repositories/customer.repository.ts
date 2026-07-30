import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

// Repository layer: only Prisma access, no business logic. Every query is
// scoped by merchantId to guarantee multi-tenant isolation.

export interface CustomerListParams {
  merchantId: string;
  search?: string;
  skip: number;
  take: number;
}

export const customerRepository = {
  create(data: Prisma.CustomerUncheckedCreateInput) {
    return prisma.customer.create({ data });
  },

  findById(merchantId: string, id: string) {
    return prisma.customer.findFirst({ where: { id, merchantId } });
  },

  async list({ merchantId, search, skip, take }: CustomerListParams) {
    const where: Prisma.CustomerWhereInput = {
      merchantId,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Run the page query and the count in one round trip.
    const [data, total] = await prisma.$transaction([
      prisma.customer.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.customer.count({ where }),
    ]);
    return { data, total };
  },

  update(merchantId: string, id: string, data: Prisma.CustomerUncheckedUpdateInput) {
    // updateMany enforces the merchantId scope in the WHERE clause (unlike
    // update-by-id which cannot filter by a non-unique column).
    return prisma.customer.updateMany({ where: { id, merchantId }, data });
  },

  delete(merchantId: string, id: string) {
    return prisma.customer.deleteMany({ where: { id, merchantId } });
  },
};
