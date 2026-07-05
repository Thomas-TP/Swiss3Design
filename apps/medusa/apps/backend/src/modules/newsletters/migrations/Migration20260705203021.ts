import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260705203021 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "newsletter_send" ("id" text not null, "subject" text not null, "audience" text check ("audience" in ('newsletter', 'product_news', 'both')) not null, "product_ids" text null, "recipient_count" integer not null, "sent_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "newsletter_send_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_newsletter_send_deleted_at" ON "newsletter_send" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_newsletter_send_audience" ON "newsletter_send" ("audience") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "newsletter_send" cascade;`);
  }

}
