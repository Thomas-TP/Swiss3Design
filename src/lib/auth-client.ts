"use client";

import { createAuthClient } from "better-auth/react";
import {
  twoFactorClient,
  magicLinkClient,
  emailOTPClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient(),
    magicLinkClient(),
    emailOTPClient(),
    passkeyClient(),
    // Joint la requête OAuth signée (?sig=…) aux POST de la page de connexion
    // et de consentement : better-auth reprend alors l'autorisation en cours.
    oauthProviderClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  updateUser,
  twoFactor,
  deleteUser,
  changeEmail,
  changePassword,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  listAccounts,
  linkSocial,
  unlinkAccount,
  sendVerificationEmail,
  emailOtp,
  passkey,
} = authClient;
