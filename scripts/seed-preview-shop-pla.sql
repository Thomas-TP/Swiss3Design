-- Boutique en PLA et couleurs du stock (15.10.2026) : PREVIEW SEULEMENT, à jouer à
-- la main sur la branche Neon preview, APRÈS drizzle-pg/0011_shop_colors.sql et APRÈS
-- scripts/seed-filament-refs.sql (les couleurs de la boutique SONT ses références).
-- Jamais exécuté par un déploiement. Idempotent (rejouable sans effet de bord).
--
-- Ce que ça fait, uniquement sur les 6 articles de démonstration (repérés par leur
-- slug, jamais par un id) :
--   1. matière PLA partout (l'atelier n'imprime que du PLA) et descriptions sans PETG ;
--   2. un poids partout où il manque : tout article qui a un poids réserve
--      leur filament (poids × quantité + 10 %), un poids absent = couleur non suivie ;
--   3. UNE exclusion de démonstration (le « Support de casque » ne se fait pas en
--      Sakura Pink) pour voir une case décochée côté fiche et côté admin.
-- Les anciennes tables (materials, filament_colors, product_colors) ne sont ni lues
-- ni modifiées : filet de retour arrière.

-- 1. Matière
UPDATE products
SET material = 'PLA'
WHERE slug IN ('vase-spirale', 'lampe-voronoi', 'organiseur-bureau',
               'jardiniere-geometrique', 'porte-cles-relief', 'support-casque')
  AND material <> 'PLA';

UPDATE product_translations pt
SET description = CASE pt.locale
    WHEN 'fr' THEN 'Support audio stable au look bicolore, avec passe-câble intégré. Imprimé en PLA pour une tenue nette et durable.'
    WHEN 'de' THEN 'Stabiler Audio-Ständer im zweifarbigen Look mit integrierter Kabelführung. In PLA gedruckt für ein sauberes, dauerhaftes Ergebnis.'
    WHEN 'it' THEN 'Supporto audio stabile dal look bicolore, con passacavo integrato. Stampato in PLA per un risultato pulito e duraturo.'
    ELSE 'Stable audio stand with a two-tone look and built-in cable guide. Printed in PLA for a clean, lasting finish.'
  END
FROM products p
WHERE pt.product_id = p.id
  AND p.slug = 'support-casque'
  AND pt.description LIKE '%PETG%';

-- 2. Poids (g) d'une pièce, là où il manque
UPDATE products p
SET weight_grams = v.grams
FROM (VALUES
  ('vase-spirale', 180),
  ('lampe-voronoi', 320),
  ('organiseur-bureau', 240),
  ('jardiniere-geometrique', 160),
  ('porte-cles-relief', 8),
  ('support-casque', 280)
) AS v(slug, grams)
WHERE p.slug = v.slug
  AND p.weight_grams IS NULL;

-- 3. Une couleur décochée pour la démonstration
INSERT INTO product_filament_exclusions (product_id, ref_id)
SELECT p.id, r.id
FROM products p
JOIN filament_refs r ON r.id = 'ref-bambu-matte-sakura-pink'
WHERE p.slug = 'support-casque'
ON CONFLICT (product_id, ref_id) DO NOTHING;
