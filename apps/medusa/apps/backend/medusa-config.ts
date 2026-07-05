import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: [
    // i18n natif Medusa (>=2.12.3, derriere le flag MEDUSA_FF_TRANSLATION) :
    // Product.title/subtitle/description/material et ProductCategory.name/
    // description sont deja marques .translatable() dans le core. Remplace le
    // module custom "catalog-i18n" initialement prevu au plan - inutile de
    // reecrire ce que Medusa fournit deja nativement.
    { resolve: "@medusajs/translation" },
    // Palette matieres/couleurs custom : aucun equivalent Medusa natif (une
    // couleur ici est un choix cosmetique a l'achat, pas une option qui
    // multiplie les variantes/SKU comme le systeme Product Option de Medusa).
    { resolve: "./src/modules/materials" },
    {
      // R2 (S3-compatible) file storage. Points at swiss3design-preview-files
      // (non-prod bucket) while this stack is still under development —
      // switching to the real swiss3design-files bucket is a Phase 6 cutover
      // decision, not something to do while iterating. file_url is provisional:
      // this bucket has no public access/custom domain configured (matches the
      // current app's private R2 + proxy-route pattern), so public product
      // image URLs and private quote-file access both need a real design pass
      // in Phase 1/3 rather than assuming direct bucket URLs work.
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-s3",
            id: "s3",
            options: {
              file_url: process.env.R2_FILE_URL,
              access_key_id: process.env.R2_ACCESS_KEY_ID,
              secret_access_key: process.env.R2_SECRET_ACCESS_KEY,
              region: "auto",
              bucket: process.env.R2_BUCKET,
              endpoint: process.env.R2_ENDPOINT,
              additional_client_config: {
                forcePathStyle: true,
              },
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          // Kept for Medusa Admin dashboard staff logins (actor type "user").
          {
            resolve: "@medusajs/auth-emailpass",
            id: "emailpass",
          },
          // Bridges better-auth (customer-facing auth, unchanged on Cloudflare
          // Workers + D1) into Medusa's customer actor type.
          {
            resolve: "./src/modules/better-auth-bridge",
            id: "better-auth-bridge",
            options: {
              secret: process.env.BETTER_AUTH_BRIDGE_SECRET,
            },
          },
        ],
      },
    },
  ],
})
