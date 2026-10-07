import "dotenv/config";
import { defineConfig, env } from "prisma/config";

function migrationDatabaseUrl() {
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED;
  if (directUrl) return directUrl;

  const url = new URL(env("DATABASE_URL"));
  // Neon direct connections preserve the session used by migration locks.
  // Application queries continue to use DATABASE_URL and its pooler.
  if (url.hostname.endsWith(".neon.tech")) {
    url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  }
  return url.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationDatabaseUrl(),
  },
});
