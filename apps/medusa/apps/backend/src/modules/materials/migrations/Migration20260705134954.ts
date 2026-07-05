import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260705134954 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product_color" drop constraint if exists "product_color_product_id_color_id_unique";`);
    this.addSql(`alter table if exists "filament_color" drop constraint if exists "filament_color_material_id_name_unique";`);
    this.addSql(`alter table if exists "material" drop constraint if exists "material_name_unique";`);
    this.addSql(`create table if not exists "material" ("id" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "material_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_material_deleted_at" ON "material" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_material_name_unique" ON "material" ("name") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "filament_color" ("id" text not null, "name" text not null, "hex" text not null, "sort_order" integer not null default 0, "material_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "filament_color_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_filament_color_material_id" ON "filament_color" ("material_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_filament_color_deleted_at" ON "filament_color" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_filament_color_material_id_name_unique" ON "filament_color" ("material_id", "name") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "product_color" ("id" text not null, "product_id" text not null, "color_id" text not null, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_color_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_color_deleted_at" ON "product_color" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_color_product_id_color_id_unique" ON "product_color" ("product_id", "color_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_color_product_id" ON "product_color" ("product_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "filament_color" add constraint "filament_color_material_id_foreign" foreign key ("material_id") references "material" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "filament_color" drop constraint if exists "filament_color_material_id_foreign";`);

    this.addSql(`drop table if exists "material" cascade;`);

    this.addSql(`drop table if exists "filament_color" cascade;`);

    this.addSql(`drop table if exists "product_color" cascade;`);
  }

}
