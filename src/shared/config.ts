// Single place that reads env vars. Names documented in .env.example.
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

let cached: z.infer<typeof schema> | undefined;

export function config() {
  cached ??= schema.parse(process.env);
  return cached;
}
