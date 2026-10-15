-- Références de filament (« Filaments », 15.10.2026) : les 10 couleurs de la palette
-- du Studio (Bambu Lab PLA Matte, hex officiels du PDF « PLA Matte Hex Code ») et
-- les références des restes du propriétaire. AUCUNE bobine ici : sans bobine, une
-- couleur du Studio est « épuisée ». Idempotent (ids fixes, ON CONFLICT DO NOTHING)
-- et sans donnée personnelle : applicable en production au lancement, APRÈS la
-- migration drizzle-pg/0010_filament_stock.sql, à la main (aucun déploiement ne
-- l'exécute). Prix catalogue Bambu Europe (relevés le 15.10.2026) : recharge
-- 16,99 EUR, avec bobine 19,99 EUR (seulement 5 couleurs existent avec bobine).
-- Les teintes marquées hex_confirmed = false sont APPROXIMATIVES : à confirmer sur
-- la bobine (onglet « Références » de /admin/filaments).

INSERT INTO filament_refs
  (id, brand, range_name, official_name, product_code, hex, studio_id, custom_ok,
   min_spare_spools, price_spool_eur_cents, price_refill_eur_cents, url_spool, url_refill)
VALUES
  ('ref-bambu-matte-ivory-white', 'Bambu Lab', 'PLA Matte', 'Ivory White', '11100', '#FFFFFF', 'blanc-neve', true, 1, 1999, 1699,
   'https://eu.store.bambulab.com/products/pla-matte?id=43992833229019', 'https://eu.store.bambulab.com/products/pla-matte?id=42996742586587'),
  ('ref-bambu-matte-ash-gray', 'Bambu Lab', 'PLA Matte', 'Ash Gray', '11102', '#9B9EA0', 'gris-molasse', true, 1, 1999, 1699,
   'https://eu.store.bambulab.com/products/pla-matte?id=43992833327323', 'https://eu.store.bambulab.com/products/pla-matte?id=42996742619355'),
  ('ref-bambu-matte-charcoal', 'Bambu Lab', 'PLA Matte', 'Charcoal', '11101', '#000000', 'encre', true, 1, 1999, 1699,
   'https://eu.store.bambulab.com/products/pla-matte?id=43992833261787', 'https://eu.store.bambulab.com/products/pla-matte?id=42996742750427'),
  ('ref-bambu-matte-dark-green', 'Bambu Lab', 'PLA Matte', 'Dark Green', '11501', '#68724D', 'vert-foret', true, 1, NULL, 1699,
   NULL, 'https://eu.store.bambulab.com/products/pla-matte?id=47794659656028'),
  ('ref-bambu-matte-marine-blue', 'Bambu Lab', 'PLA Matte', 'Marine Blue', '11600', '#0078BF', 'bleu-leman', true, 1, 1999, 1699,
   'https://eu.store.bambulab.com/products/pla-matte?id=43992833360091', 'https://eu.store.bambulab.com/products/pla-matte?id=42996751073499'),
  ('ref-bambu-matte-ice-blue', 'Bambu Lab', 'PLA Matte', 'Ice Blue', '11601', '#A3D8E1', 'glacier', true, 1, NULL, 1699,
   NULL, 'https://eu.store.bambulab.com/products/pla-matte?id=42996742881499'),
  ('ref-bambu-matte-latte-brown', 'Bambu Lab', 'PLA Matte', 'Latte Brown', '11800', '#D3B7A7', 'gres', true, 1, NULL, 1699,
   NULL, 'https://eu.store.bambulab.com/products/pla-matte?id=42996742815963'),
  ('ref-bambu-matte-terracotta', 'Bambu Lab', 'PLA Matte', 'Terracotta', '11203', '#B15533', 'terre-cuite', true, 1, NULL, 1699,
   NULL, 'https://eu.store.bambulab.com/products/pla-matte?id=53926028804444'),
  ('ref-bambu-matte-scarlet-red', 'Bambu Lab', 'PLA Matte', 'Scarlet Red', '11200', '#DE4343', 'rouge-signal', true, 1, 1999, 1699,
   'https://eu.store.bambulab.com/products/pla-matte?id=43992833294555', 'https://eu.store.bambulab.com/products/pla-matte?id=42996742848731'),
  ('ref-bambu-matte-sakura-pink', 'Bambu Lab', 'PLA Matte', 'Sakura Pink', '11201', '#E8AFCF', 'rose-alpes', true, 1, NULL, 1699,
   NULL, 'https://eu.store.bambulab.com/products/pla-matte?id=42996742684891')
ON CONFLICT (id) DO NOTHING;

-- Restes du propriétaire (pesés le 15.10.2026, identifiés ensuite), tous proposés en
-- « sur mesure », avec reorder_below_grams = 0 : ce sont des fins de bobine à écouler,
-- ils ne polluent pas « À acheter » (modifiable dans l'admin). Hex officiels : Polymaker
-- Cotton White, Charcoal Black et Pastel Candy (wiki Polymaker « HEX Codes and
-- Transmission Distances ») ; Bambu Lab d'après filaments_color_codes.json de
-- BambuStudio (dépôt bambulab/BambuStudio). Seul le tricolore R3D reste approximatif
-- (hex_confirmed = false : pas de hex officiel, trois teintes estimées).
INSERT INTO filament_refs
  (id, brand, range_name, official_name, product_code, hex, hex2, hex3, hex_confirmed,
   custom_ok, min_spare_spools, reorder_below_grams, price_spool_eur_cents,
   price_refill_eur_cents, url_spool, url_refill, note)
VALUES
  ('ref-polymaker-polyterra-cotton-white', 'Polymaker', 'PolyTerra PLA', 'Cotton White', NULL, '#F4EFEB', NULL, NULL, true,
   true, 0, 0, NULL, NULL, NULL, NULL, NULL),
  ('ref-polymaker-polyterra-charcoal-black', 'Polymaker', 'PolyTerra PLA', 'Charcoal Black', NULL, '#2F2E30', NULL, NULL, true,
   true, 0, 0, NULL, NULL, NULL, NULL, NULL),
  ('ref-polymaker-polyterra-candy', 'Polymaker', 'PolyTerra PLA', 'Pastel Candy', NULL, '#F0D6D9', NULL, NULL, true,
   true, 0, 0, NULL, NULL,
   'https://www.galaxus.ch/fr/s1/product/polymaker-polyterra-pla-1000-g-175-mm-filament-3d-18455293', NULL,
   'Rose pastel (Galaxus « Rose Pastel », GTIN 6938936708674, Polymaker PM70867), aujourd''hui Panchroma Matte Pastel Candy (CA04030). Hex : wiki Polymaker.'),
  ('ref-bambu-silk-raspberry', 'Bambu Lab', 'PLA Silk Multi-Color', 'Midnight Blaze', '13902', '#0047BB', '#7D1B49', NULL, true,
   true, 0, 0, 2799, NULL, 'https://eu.store.bambulab.com/products/pla-silk-multi-color?id=47489270808924', NULL,
   'Bicolore co-extrudé bleu / framboise (nom FR : Feu de minuit). Hex officiels Bambu.'),
  ('ref-bambu-metal-blue-grey', 'Bambu Lab', 'PLA Metal', 'Cobalt Blue Metallic', '13600', '#39699E', NULL, NULL, true,
   true, 0, 0, 2799, NULL, 'https://eu.store.bambulab.com/products/pla-metal?id=43959185244379', NULL,
   'Nom FR : Bleu cobalt métallisé.'),
  ('ref-bambu-wood-unknown', 'Bambu Lab', 'PLA Wood', 'Rosewood', '13204', '#4C241C', NULL, NULL, true,
   true, 0, 0, 2799, NULL, 'https://eu.store.bambulab.com/products/pla-wood?id=53441583087964', NULL,
   'Nom FR : Palissandre.'),
  ('ref-bambu-basic-bright-green', 'Bambu Lab', 'PLA Basic', 'Bright Green', '10503', '#BECF00', NULL, NULL, true,
   true, 0, 0, NULL, 1699, NULL, 'https://eu.store.bambulab.com/products/pla-basic-filament?id=49636024353116',
   'Nom FR : Vert vif.'),
  ('ref-bambu-basic-yellow', 'Bambu Lab', 'PLA Basic', 'Sunflower Yellow', '10402', '#FEC600', NULL, NULL, true,
   true, 0, 0, NULL, 1699, NULL, 'https://eu.store.bambulab.com/products/pla-basic-filament?id=49636014031196',
   'Nom FR : Jaune tournesol.'),
  ('ref-r3d-silk-tricolor-blue-purple-pink', 'R3D', 'eSilk Mystic-PLA', 'Bleu-Violet-Rose', NULL, '#3D5BD9', '#7E4FC2', '#E86FB4', false,
   true, 0, 0, NULL, NULL,
   'https://www.galaxus.ch/fr/s1/product/r3d-filament-esilk-mystic-pla-bleu-violet-rose-175mm-1kg-pla-1000-g-filament-3d-47920103', NULL,
   'Tricolore co-extrudé (eSilk Mystic). Galaxus 47920103, GTIN 6974868562298, 1,75 mm, 1 kg. Pas de hex officiel : trois teintes approximatives.')
ON CONFLICT (id) DO NOTHING;

-- Lien avec la palette de la boutique (couleurs « Blanc » et « Noir » du PLA), si elles existent.
UPDATE filament_refs
SET shop_color_id = (
  SELECT c.id FROM filament_colors c JOIN materials m ON m.id = c.material_id
  WHERE m.name = 'PLA' AND c.name = 'Blanc' LIMIT 1)
WHERE id = 'ref-polymaker-polyterra-cotton-white' AND shop_color_id IS NULL;
UPDATE filament_refs
SET shop_color_id = (
  SELECT c.id FROM filament_colors c JOIN materials m ON m.id = c.material_id
  WHERE m.name = 'PLA' AND c.name = 'Noir' LIMIT 1)
WHERE id = 'ref-polymaker-polyterra-charcoal-black' AND shop_color_id IS NULL;
