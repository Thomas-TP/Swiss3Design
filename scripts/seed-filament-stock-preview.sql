-- Stock de départ du propriétaire (« Filaments », 15.10.2026) : PREVIEW SEULEMENT,
-- jamais en production automatiquement (à jouer à la main, APRÈS la migration
-- drizzle-pg/0010_filament_stock.sql et APRÈS scripts/seed-filament-refs.sql).
-- Idempotent (ids fixes, ON CONFLICT DO NOTHING).
--
-- Restant estimé = poids brut pesé le 15.10.2026 − tare :
--   Bambu bobine plastique 212 g (pesée) ; Polymaker carton 140 g ; R3D carton 150 g (estimation).
-- Seule la bobine R3D (tare du carton estimée) reste à confirmer (to_confirm).

-- Supports plastique Bambu : 5 sous une bobine, 2 vides (PLA Basic, 212 g chacun).
INSERT INTO filament_holders (id, tare_grams, note) VALUES
  ('seed-holder-1', 212, 'sous la bobine Silk'),
  ('seed-holder-3', 212, 'sous la bobine Metal'),
  ('seed-holder-4', 212, 'sous la bobine Wood'),
  ('seed-holder-5', 212, 'sous la bobine Basic vert'),
  ('seed-holder-6', 212, 'sous la bobine Basic jaune'),
  ('seed-holder-e1', 212, 'vide, 212 g pesés (PLA Basic)'),
  ('seed-holder-e2', 212, 'vide, 212 g pesés (PLA Basic)')
ON CONFLICT (id) DO NOTHING;

-- Bobines en stock (restant = brut − tare ; initial = 1000 g).
INSERT INTO filament_spools
  (id, ref_id, holder_id, spool_type, tare_grams, tare_confirmed, initial_grams, remaining_grams,
   status, sealed, to_confirm, last_weighed_at, note, created_at)
VALUES
  ('seed-spool-1', 'ref-bambu-silk-raspberry', 'seed-holder-1', 'bambu_reusable', 212, true, 1000, 251, 'in_stock', false, false, '2026-10-15 12:00+02', 'brut 463 g', '2026-10-15 12:00+02'),
  ('seed-spool-2', 'ref-polymaker-polyterra-candy', NULL, 'polymaker_cardboard', 140, true, 1000, 896, 'in_stock', false, false, '2026-10-15 12:00+02', 'brut 1036 g', '2026-10-15 12:00+02'),
  ('seed-spool-3', 'ref-bambu-metal-blue-grey', 'seed-holder-3', 'bambu_reusable', 212, true, 1000, 340, 'in_stock', false, false, '2026-10-15 12:00+02', 'brut 552 g', '2026-10-15 12:00+02'),
  ('seed-spool-4', 'ref-bambu-wood-unknown', 'seed-holder-4', 'bambu_reusable', 212, true, 1000, 193, 'in_stock', false, false, '2026-10-15 12:00+02', 'brut 405 g', '2026-10-15 12:00+02'),
  ('seed-spool-5', 'ref-bambu-basic-bright-green', 'seed-holder-5', 'bambu_reusable', 212, true, 1000, 900, 'in_stock', false, false, '2026-10-15 12:00+02', 'brut 1112 g', '2026-10-15 12:00+02'),
  ('seed-spool-6', 'ref-bambu-basic-yellow', 'seed-holder-6', 'bambu_reusable', 212, true, 1000, 773, 'in_stock', false, false, '2026-10-15 12:00+02', 'brut 985 g', '2026-10-15 12:00+02'),
  ('seed-spool-7', 'ref-polymaker-polyterra-charcoal-black', NULL, 'polymaker_cardboard', 140, true, 1000, 33, 'in_stock', false, false, '2026-10-15 12:00+02', 'brut 173 g', '2026-10-15 12:00+02'),
  ('seed-spool-8', 'ref-polymaker-polyterra-cotton-white', NULL, 'polymaker_cardboard', 140, true, 1000, 507, 'in_stock', false, false, '2026-10-15 12:00+02', 'brut 647 g', '2026-10-15 12:00+02'),
  ('seed-spool-9', 'ref-r3d-silk-tricolor-blue-purple-pink', NULL, 'r3d_cardboard', 150, false, 1000, 967, 'in_stock', false, true, '2026-10-15 12:00+02', 'brut 1117 g, carton R3D estimé à 150 g', '2026-10-15 12:00+02')
ON CONFLICT (id) DO NOTHING;

-- Une pesée datée par bobine : la somme des mouvements égale le restant.
INSERT INTO filament_movements
  (id, spool_id, kind, delta_grams, grams_after, gross_grams, tare_grams, idempotency_key, note, created_at)
SELECT 'seed-mov-' || s.id, s.id, 'weigh', s.remaining_grams, s.remaining_grams,
       s.remaining_grams + s.tare_grams, s.tare_grams, 'seed:2026-10-15:' || s.id,
       'Inventaire initial (pesée du 15.10.2026)', s.created_at
FROM filament_spools s
WHERE s.id LIKE 'seed-spool-%'
ON CONFLICT (id) DO NOTHING;

-- Commande à venir : 5 avec bobine + 10 recharges, statut « commandée ».
INSERT INTO filament_purchases (id, supplier, reference, status, ordered_at, note)
VALUES ('seed-purchase-1', 'Bambu Lab Europe', 'Commande à venir (15.10.2026)', 'ordered', '2026-10-15 12:00+02',
        '5 avec bobine (Ivory White, Charcoal, Ash Gray, Marine Blue, Scarlet Red) + 10 recharges.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO filament_spools
  (id, ref_id, purchase_id, spool_type, tare_grams, tare_confirmed, initial_grams, remaining_grams, status, sealed, note)
VALUES
  ('seed-ord-01', 'ref-bambu-matte-ivory-white', 'seed-purchase-1', 'bambu_reusable', 212, true, 1000, 0, 'ordered', true, NULL),
  ('seed-ord-02', 'ref-bambu-matte-charcoal', 'seed-purchase-1', 'bambu_reusable', 212, true, 1000, 0, 'ordered', true, NULL),
  ('seed-ord-03', 'ref-bambu-matte-ash-gray', 'seed-purchase-1', 'bambu_reusable', 212, true, 1000, 0, 'ordered', true, NULL),
  ('seed-ord-04', 'ref-bambu-matte-marine-blue', 'seed-purchase-1', 'bambu_reusable', 212, true, 1000, 0, 'ordered', true, NULL),
  ('seed-ord-05', 'ref-bambu-matte-scarlet-red', 'seed-purchase-1', 'bambu_reusable', 212, true, 1000, 0, 'ordered', true, NULL),
  ('seed-ord-06', 'ref-bambu-matte-dark-green', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier'),
  ('seed-ord-07', 'ref-bambu-matte-ice-blue', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier'),
  ('seed-ord-08', 'ref-bambu-matte-latte-brown', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier'),
  ('seed-ord-09', 'ref-bambu-matte-terracotta', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier'),
  ('seed-ord-10', 'ref-bambu-matte-sakura-pink', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier'),
  ('seed-ord-11', 'ref-bambu-matte-ivory-white', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier'),
  ('seed-ord-12', 'ref-bambu-matte-ivory-white', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier'),
  ('seed-ord-13', 'ref-bambu-matte-charcoal', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier'),
  ('seed-ord-14', 'ref-bambu-matte-ash-gray', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier'),
  ('seed-ord-15', 'ref-bambu-matte-dark-green', 'seed-purchase-1', 'bambu_refill', 237, false, 1000, 0, 'ordered', true, 'recharge : support + mandrin ≈ 237 g, à vérifier')
ON CONFLICT (id) DO NOTHING;
