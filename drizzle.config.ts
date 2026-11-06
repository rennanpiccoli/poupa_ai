import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) process.loadEnvFile?.(".env");

export default defineConfig({
  schema: "./src/shared/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
