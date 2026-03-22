import Fastify from "fastify";
import { env } from "./env.js";

const app = Fastify({
  logger: true,
});

app.get("/", async () => {
  return { message: "Welcome to CRUD API!" };
});

const start = async () => {
  try {
    await app.listen({ port: Number(env.PORT), host: "0.0.0.0" });
    console.log(`Server running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
