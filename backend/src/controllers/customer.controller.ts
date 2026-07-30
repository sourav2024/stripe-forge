import { Request, Response } from 'express';
import { asyncHandler, ok, paginated, parsePagination } from '../utils/http';
import { serialize } from '../utils/serialize';
import { customerService } from '../services/customer.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
  listQuerySchema,
} from '../validators/customer.validator';

// Controllers stay thin: validate input, delegate to the service, serialize the
// result. `req.merchant!` is guaranteed by requireAuth on every route.

export const customerController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createCustomerSchema.parse(req.body);
    const customer = await customerService.createCustomer(req.merchant!.id, input);
    return ok(res, serialize(customer), 201);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const customer = await customerService.retrieveCustomer(req.merchant!.id, req.params.id);
    return ok(res, serialize(customer));
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(query as Record<string, unknown>);
    const { data, total } = await customerService.listCustomers({
      merchantId: req.merchant!.id,
      search: query.search,
      skip,
      take,
    });
    return paginated(res, serialize(data), {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = updateCustomerSchema.parse(req.body);
    const customer = await customerService.updateCustomer(req.merchant!.id, req.params.id, input);
    return ok(res, serialize(customer));
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await customerService.deleteCustomer(req.merchant!.id, req.params.id);
    return ok(res, { deleted: true, id: req.params.id });
  }),
};
