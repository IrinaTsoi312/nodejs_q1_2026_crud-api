import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { Product, Products } from "../productsDB/products.types";
import { newProductSchema, updateProductSchema, uuidSchema } from "../schemas/productsSchema";

const products: Products = [];

export async function productRoutes(app: FastifyInstance) {
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
    const parsed = newProductSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid product data",
        errors: parsed.error,
      });
    }

    const newProduct: Product = {
      id: randomUUID(),
      ...parsed.data,
    };

    products.push(newProduct);

    return reply.status(201).send(newProduct);
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
        errors: parsed.error.format(),
      });
    }

    const product = products.find(p => p.id === id);

    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }

    Object.assign(product, parsed.data);

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

    return reply.status(204).send();
  });
}
