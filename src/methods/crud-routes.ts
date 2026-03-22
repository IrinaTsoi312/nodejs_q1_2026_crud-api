import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { Product, Products } from "../productsDB/products.types";
import { newProductSchema, updateProductSchema, uuidSchema } from "../schemas/productsSchema";
import { env } from "../env";

const productsDEV: Products = [];
const productsPROD: Products = [];

function notifyMasterProcess(operation: string, data: any) {
  if (process.send) {
    process.send({
      type: 'PRODUCT_OPERATION',
      operation,
      ...data,
    });
  }
}

export async function productRoutes(app: FastifyInstance, productsArray?: Products) {
  const products = productsArray || (env.NODE_ENV === "development" ? productsDEV : productsPROD);
  app.get("/api/products", async (_, reply) => {
    return reply.status(200).send(products);
  });

  app.get("/api/products/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    if (!uuidSchema.safeParse(id).success) {
      return reply.status(400).send({ message: "Invalid productId" });
    }

    const product = products.find((product) => product.id === id);

    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }

    return reply.status(200).send(product);
  });

  app.post("/api/products", async (req, reply) => {
    const isArray = Array.isArray(req.body);
    const itemsToCreate = isArray ? (req.body as unknown[]) : [req.body];

    const validations = [];
    const errors = [];

    for (let i = 0; i < itemsToCreate.length; i++) {
      const parsed = newProductSchema.safeParse(itemsToCreate[i]);

      if (!parsed.success) {
        errors.push({
          index: i,
          message: "Missing or invalid required fields",
          errors: parsed.error.format(),
        });
      } else {
        validations.push({ index: i, data: parsed.data });
      }
    }

    if (errors.length > 0) {
      return reply.status(400).send({
        message: "Validation failed - missing or invalid required fields",
        errors,
      });
    }

    const createdProducts: Product[] = [];
    for (const validation of validations) {
      const newProduct: Product = {
        id: randomUUID(),
        ...validation.data,
      };

      products.push(newProduct);
      createdProducts.push(newProduct);

      notifyMasterProcess('POST', {
        products: [newProduct],
      });
    }

    return reply.status(201).send(isArray ? createdProducts : createdProducts[0]);
  });

  app.put("/api/products/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    if (!uuidSchema.safeParse(id).success) {
      return reply.status(400).send({ message: "Invalid productId" });
    }

    const parsed = updateProductSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid product data",
        errors: parsed.error,
      });
    }

    const product = products.find(p => p.id === id);

    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }

    Object.assign(product, parsed.data);

    notifyMasterProcess('PUT', {
      products: [product],
    });

    return reply.status(200).send(product);
  });

  app.delete("/api/products/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    if (!uuidSchema.safeParse(id).success) {
      return reply.status(400).send({ message: "Invalid productId" });
    }

    const index = products.findIndex(p => p.id === id);
    if (index === -1) {
      return reply.status(404).send({ message: "Product not found" });
    }

    products.splice(index, 1);

    notifyMasterProcess('DELETE', {
      productId: id,
    });

    return reply.status(204).send();
  });
}
