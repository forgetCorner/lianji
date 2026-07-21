declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    LIANJI_BOOTSTRAP_INVITE_CODE?: string;
    [key: string]: unknown;
  };
}
