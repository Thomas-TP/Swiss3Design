import type {
  D1Database,
  R2Bucket,
  KVNamespace,
  Fetcher,
} from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    R2: R2Bucket;
    KV: KVNamespace;
    ASSETS: Fetcher;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    ADMIN_EMAILS: string;
    // Secret pour déclencher la maintenance planifiée (purge R2 + rétention)
    CRON_SECRET?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    APPLE_CLIENT_ID?: string;
    APPLE_CLIENT_SECRET?: string;
    FACEBOOK_CLIENT_ID?: string;
    FACEBOOK_CLIENT_SECRET?: string;
  }
}

export {};
