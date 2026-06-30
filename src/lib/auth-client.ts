"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
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
} = authClient;
