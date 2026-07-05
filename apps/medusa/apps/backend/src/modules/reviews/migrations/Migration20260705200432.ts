import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260705200432 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "review" drop constraint if exists "review_order_id_product_id_unique";`);
    this.addSql(`create table if not exists "review" ("id" text not null, "product_id" text not null, "order_id" text not null, "customer_id" text null, "author_name" text not null, "rating" integer not null, "body" text null, "status" text check ("status" in ('pending', 'published', 'rejected')) not null default 'pending', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_deleted_at" ON "review" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_product_id" ON "review" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_status" ON "review" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_review_order_id_product_id_unique" ON "review" ("order_id", "product_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "review" cascade;`);
  }

}
