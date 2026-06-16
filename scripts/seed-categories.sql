-- Catégories de base (structure, sans produits) — idempotent
INSERT OR REPLACE INTO categories (id, slug, sort_order) VALUES
  ('c_deco', 'deco', 1),
  ('c_bureau', 'bureau', 2),
  ('c_accessoires', 'accessoires', 3);

INSERT OR REPLACE INTO category_translations (category_id, locale, name) VALUES
  ('c_deco', 'fr', 'Décoration'), ('c_deco', 'de', 'Dekoration'), ('c_deco', 'it', 'Decorazione'), ('c_deco', 'en', 'Home decor'),
  ('c_bureau', 'fr', 'Bureau'), ('c_bureau', 'de', 'Büro'), ('c_bureau', 'it', 'Ufficio'), ('c_bureau', 'en', 'Desk'),
  ('c_accessoires', 'fr', 'Accessoires'), ('c_accessoires', 'de', 'Accessoires'), ('c_accessoires', 'it', 'Accessori'), ('c_accessoires', 'en', 'Accessories');

INSERT OR REPLACE INTO settings (key, value) VALUES
  ('shipping_cents', '890'),
  ('free_shipping_over_cents', '6000');
