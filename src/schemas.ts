import { z } from 'zod';

// Zod validates the actual runtime shape of incoming request bodies.
// TypeScript types alone only exist at compile time — they can't catch
// a caller sending { "order_index": "banana" } over HTTP.

export const CreateTemplateSchema = z.object({
  id: z.string().min(1, 'id must not be empty'),
  title: z.string().min(1, 'title must not be empty'),
  source: z.record(z.string(), z.unknown()),
  order_index: z.number().optional(),
  categories: z.array(z.string()).optional(),
});

export const UpdateTemplateSchema = z
  .object({
    title: z.string().min(1).optional(),
    source: z.record(z.string(), z.unknown()).optional(),
    order_index: z.number().optional(),
  })
  .refine(
    (data) => data.title !== undefined || data.source !== undefined || data.order_index !== undefined,
    { message: 'at least one field (title, source, order_index) must be provided' }
  );

export const CreateCategorySchema = z.object({
  slug: z.string().min(1, 'slug must not be empty'),
});
