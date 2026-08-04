import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"), // Use DIRECT_URL for migrations (Supabase requirement)
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
