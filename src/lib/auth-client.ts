"use client";

import { createAuthClient } from "better-auth/react";
import {
  twoFactorClient,
  magicLinkClient,
  emailOTPClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient(),
    magicLinkClient(),
    emailOTPClient(),
    passkeyClient(),
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
