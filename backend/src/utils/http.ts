import { Request, Response, NextFunction, RequestHandler } from 'express';

// Wrap async controllers so a rejected promise reaches Express's error
// middleware. Without this, an `await` that throws would hang the request.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

// A consistent success envelope keeps the frontend contract predictable.
export function ok<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(res: Response, data: T[], meta: PaginationMeta): Response {
  return res.status(200).json({ success: true, data, meta });
}

// Parse `page`/`pageSize` query params with sane bounds so a client cannot
// request an unbounded page and exhaust memory.
export function parsePagination(query: Record<string, unknown>): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
