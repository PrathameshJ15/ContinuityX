import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .default("postgresql://postgres:postgres@localhost:5432/continuityx?schema=public"),
  DIRECT_URL: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z
    .string()
    .min(16, "NEXTAUTH_SECRET must be at least 16 characters")
    .default("continuityx-default-development-secret-key-32b"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_EXTRACTION_MODEL: z.string().default("gemini-1.5-flash"),
  GEMINI_JUDGE_MODEL: z.string().default("gemini-1.5-pro"),
  MAX_DOCUMENT_SIZE_MB: z.coerce.number().int().positive().default(10),
  MAX_DOCUMENT_PAGES: z.coerce.number().int().positive().default(100),
  MAX_PROJECT_DOCUMENTS: z.coerce.number().int().positive().default(50),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join(".");
        return `  - ${path}: ${issue.message}`;
      })
      .join("\n");

    const message = `[FATAL] Invalid environment configuration:\n${errorDetails}\n(Sensitive values are redacted)`;
    console.error(message);
    throw new Error(message);
  }

  return parsed.data;
}

export const env = validateEnv();
