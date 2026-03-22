import Fastify from "fastify";
import { env } from "./src/env.js";
import { productRoutes } from "./src/methods/crud-routes.js";

const app = Fastify({
  logger: true,
});

app.get("/", async () => {
  return { message: "Welcome to CRUD API!" };
});

app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    message: `Route ${request.method} ${request.url} not found`,
  });
});

app.get("/error", async () => {
  throw new Error("Test");
});

productRoutes(app);

const start = async () => {
  try {
    await app.listen({ port: Number(env.PORT), host: "0.0.0.0" });
    console.log(`Server running on port ${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
