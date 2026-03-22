import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("4000"),
  NODE_ENV: z.enum(["development", "production"]).default("development").catch("development"),
  BASE_URL: z.string().default("http://localhost:4000"),
});

export const env = envSchema.parse(process.env);
