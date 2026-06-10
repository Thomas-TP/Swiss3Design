-- Données de démonstration Swiss3Design (idempotent)

-- Catégories
INSERT OR REPLACE INTO categories (id, slug, sort_order) VALUES
  ('c_deco', 'deco', 1),
  ('c_bureau', 'bureau', 2),
  ('c_accessoires', 'accessoires', 3);

INSERT OR REPLACE INTO category_translations (category_id, locale, name) VALUES
  ('c_deco', 'fr', 'Décoration'), ('c_deco', 'de', 'Dekoration'), ('c_deco', 'it', 'Decorazione'), ('c_deco', 'en', 'Home decor'),
  ('c_bureau', 'fr', 'Bureau'), ('c_bureau', 'de', 'Büro'), ('c_bureau', 'it', 'Ufficio'), ('c_bureau', 'en', 'Desk'),
  ('c_accessoires', 'fr', 'Accessoires'), ('c_accessoires', 'de', 'Accessoires'), ('c_accessoires', 'it', 'Accessori'), ('c_accessoires', 'en', 'Accessories');

-- Produits
INSERT OR REPLACE INTO products (id, slug, price_cents, sale_type, production_days, material, dimensions_mm, weight_grams, multicolor, featured, active, created_at) VALUES
  ('p_vase', 'vase-spirale', 2990, 'stock', NULL, 'PLA', '120 × 120 × 220 mm', 180, 0, 1, 1, unixepoch()),
  ('p_lampe', 'lampe-voronoi', 4990, 'on_demand', 5, 'PLA', '180 × 180 × 260 mm', 320, 0, 1, 1, unixepoch()),
  ('p_organiseur', 'organiseur-bureau', 2490, 'stock', NULL, 'PETG', '220 × 100 × 110 mm', 240, 1, 1, 1, unixepoch()),
  ('p_jardiniere', 'jardiniere-geometrique', 1990, 'stock', NULL, 'PETG', '150 × 150 × 130 mm', 160, 0, 0, 1, unixepoch()),
  ('p_portecles', 'porte-cles-relief', 990, 'stock', NULL, 'PLA', '60 × 30 × 4 mm', 8, 1, 0, 1, unixepoch()),
  ('p_casque', 'support-casque', 3490, 'on_demand', 3, 'PETG', '120 × 100 × 280 mm', 280, 1, 0, 1, unixepoch());

-- Traductions produits
INSERT OR REPLACE INTO product_translations (product_id, locale, name, description) VALUES
  ('p_vase', 'fr', 'Vase Spirale', 'Vase sculptural imprimé en mode spirale, d''une seule traite et sans couture visible. Étanche grâce à son insert, il accueille fleurs fraîches ou séchées.'),
  ('p_vase', 'de', 'Spiralvase', 'Skulpturale Vase im Spiralmodus gedruckt – in einem Zug, ohne sichtbare Naht. Dank Einsatz wasserdicht, für frische oder getrocknete Blumen.'),
  ('p_vase', 'it', 'Vaso Spirale', 'Vaso scultoreo stampato in modalità spirale, in un unico passaggio e senza cuciture visibili. Impermeabile grazie all''inserto, per fiori freschi o secchi.'),
  ('p_vase', 'en', 'Spiral Vase', 'Sculptural vase printed in spiral mode — one continuous pass, no visible seam. Watertight thanks to its insert, for fresh or dried flowers.'),

  ('p_lampe', 'fr', 'Lampe Voronoï', 'Abat-jour organique inspiré des structures Voronoï. Projette un jeu d''ombres chaleureux. Compatible douille E27, ampoule LED recommandée.'),
  ('p_lampe', 'de', 'Voronoi-Lampe', 'Organischer Lampenschirm, inspiriert von Voronoi-Strukturen. Wirft ein warmes Schattenspiel. Kompatibel mit E27-Fassung, LED empfohlen.'),
  ('p_lampe', 'it', 'Lampada Voronoi', 'Paralume organico ispirato alle strutture di Voronoi. Proietta un caldo gioco di ombre. Compatibile con attacco E27, LED consigliato.'),
  ('p_lampe', 'en', 'Voronoi Lamp', 'Organic lampshade inspired by Voronoi structures. Casts a warm play of shadows. Fits E27 sockets, LED bulb recommended.'),

  ('p_organiseur', 'fr', 'Organiseur de bureau', 'Trois modules emboîtables imprimés en trois couleurs pour stylos, cartes et petits objets. Le multicolore AMS, au service du rangement.'),
  ('p_organiseur', 'de', 'Schreibtisch-Organizer', 'Drei steckbare Module in drei Farben für Stifte, Karten und Kleinkram. AMS-Mehrfarbdruck im Dienste der Ordnung.'),
  ('p_organiseur', 'it', 'Organizer da scrivania', 'Tre moduli componibili stampati in tre colori per penne, biglietti e piccoli oggetti. Il multicolore AMS al servizio dell''ordine.'),
  ('p_organiseur', 'en', 'Desk organizer', 'Three stackable modules printed in three colors for pens, cards and small items. AMS multicolor printing, in the service of tidiness.'),

  ('p_jardiniere', 'fr', 'Jardinière géométrique', 'Pot facetté au design minimaliste avec réserve d''eau intégrée. Parfait pour succulentes et plantes grasses.'),
  ('p_jardiniere', 'de', 'Geometrischer Übertopf', 'Facettierter Topf im minimalistischen Design mit integriertem Wasserspeicher. Perfekt für Sukkulenten.'),
  ('p_jardiniere', 'it', 'Fioriera geometrica', 'Vaso sfaccettato dal design minimalista con riserva d''acqua integrata. Perfetto per piante grasse.'),
  ('p_jardiniere', 'en', 'Geometric planter', 'Faceted pot with a minimalist design and built-in water reservoir. Perfect for succulents.'),

  ('p_portecles', 'fr', 'Porte-clés relief', 'Porte-clés personnalisable imprimé en quatre couleurs, texte en relief net et durable. Idéal en cadeau ou pour votre équipe.'),
  ('p_portecles', 'de', 'Relief-Schlüsselanhänger', 'Personalisierbarer Anhänger in vier Farben gedruckt, mit klarem, langlebigem Relieftext. Ideal als Geschenk oder fürs Team.'),
  ('p_portecles', 'it', 'Portachiavi in rilievo', 'Portachiavi personalizzabile stampato in quattro colori, testo in rilievo nitido e resistente. Ideale come regalo o per il vostro team.'),
  ('p_portecles', 'en', 'Relief keychain', 'Customizable keychain printed in four colors with crisp, durable raised text. Great as a gift or for your team.'),

  ('p_casque', 'fr', 'Support de casque', 'Support audio stable au look bicolore, avec passe-câble intégré. Imprimé en PETG pour une rigidité durable.'),
  ('p_casque', 'de', 'Kopfhörerständer', 'Stabiler Audio-Ständer im zweifarbigen Look mit integrierter Kabelführung. In PETG gedruckt für dauerhafte Steifigkeit.'),
  ('p_casque', 'it', 'Supporto per cuffie', 'Supporto audio stabile dal look bicolore, con passacavo integrato. Stampato in PETG per una rigidità duratura.'),
  ('p_casque', 'en', 'Headphone stand', 'Stable audio stand with a two-tone look and built-in cable guide. Printed in PETG for lasting rigidity.');

-- Images
INSERT OR REPLACE INTO product_images (id, product_id, url, alt, sort_order) VALUES
  ('img_vase', 'p_vase', '/products/vase-spirale.svg', 'Vase Spirale', 0),
  ('img_lampe', 'p_lampe', '/products/lampe-voronoi.svg', 'Lampe Voronoï', 0),
  ('img_organiseur', 'p_organiseur', '/products/organiseur-bureau.svg', 'Organiseur de bureau', 0),
  ('img_jardiniere', 'p_jardiniere', '/products/jardiniere-geometrique.svg', 'Jardinière géométrique', 0),
  ('img_portecles', 'p_portecles', '/products/porte-cles-relief.svg', 'Porte-clés relief', 0),
  ('img_casque', 'p_casque', '/products/support-casque.svg', 'Support de casque', 0);

-- Associations catégories
INSERT OR REPLACE INTO product_categories (product_id, category_id) VALUES
  ('p_vase', 'c_deco'),
  ('p_lampe', 'c_deco'),
  ('p_jardiniere', 'c_deco'),
  ('p_organiseur', 'c_bureau'),
  ('p_casque', 'c_bureau'),
  ('p_portecles', 'c_accessoires');

-- Réglages boutique
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('shipping_cents', '890'),
  ('free_shipping_over_cents', '6000');
