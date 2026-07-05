import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260705144006 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "quote_request" ("id" text not null, "customer_id" text null, "email" text not null, "description" text not null, "material" text null, "colors" text null, "dimensions" text null, "file_url" text null, "file_name" text null, "status" text check ("status" in ('received', 'quoted', 'revision_requested', 'accepted', 'declined', 'paid', 'in_production', 'done', 'rejected')) not null default 'received', "quoted_price" integer null, "admin_message" text null, "valid_until" timestamptz null, "admin_note" text null, "locale" text check ("locale" in ('fr', 'de', 'it', 'en')) not null default 'fr', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "quote_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_request_deleted_at" ON "quote_request" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_request_email" ON "quote_request" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_request_customer_id" ON "quote_request" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_request_status" ON "quote_request" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "quote_message" ("id" text not null, "sender" text check ("sender" in ('customer', 'admin')) not null, "body" text not null, "price" integer null, "file_url" text null, "file_name" text null, "quote_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "quote_message_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_message_quote_id" ON "quote_message" ("quote_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_message_deleted_at" ON "quote_message" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "quote_message" add constraint "quote_message_quote_id_foreign" foreign key ("quote_id") references "quote_request" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "quote_message" drop constraint if exists "quote_message_quote_id_foreign";`);

    this.addSql(`drop table if exists "quote_request" cascade;`);

    this.addSql(`drop table if exists "quote_message" cascade;`);
  }

}
