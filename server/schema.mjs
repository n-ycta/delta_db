import { z } from 'zod';
export const Record = z.object({id:z.string().uuid(),time:z.number().int().min(0).max(8640000000000000),source:z.string().min(1).max(128),node:z.string().min(1).max(128),metric:z.string().min(1).max(128),value:z.number().finite().nullable(),dimensions:z.record(z.string().max(256)).default({}),payload:z.record(z.unknown()).default({})}).strict();
export const Batch = z.object({records:z.array(Record).min(1).max(1000)}).strict();
export const Query = z.object({source:z.string().min(1).max(128),metric:z.string().min(1).max(128),from:z.number().int().nonnegative(),to:z.number().int().nonnegative(),filters:z.record(z.array(z.string())).optional(),limit:z.number().int().min(1).max(10000).default(10000)}).refine(v=>v.to>v.from,'Invalid range');
export const Document = z.object({namespace:z.string().regex(/^[a-z0-9_-]{1,64}$/),key:z.string().min(1).max(128),value:z.record(z.unknown()).optional()});
