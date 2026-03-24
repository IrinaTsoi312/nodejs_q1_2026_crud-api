import { z } from "zod";

export const newProductSchema  = z.object({
  name: z.string(),
  description: z.string(),
  price: z.coerce.number().positive(),
  cathegory: z.string(),
  inStock: z.boolean()
});

export const uuidSchema = z.uuid();

export const productSchema = newProductSchema.extend({
  id: uuidSchema,
});

export const updateProductSchema = productSchema.partial();
