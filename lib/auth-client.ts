import { createAuthClient } from "better-auth/react";
import { oneTapClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [
    oneTapClient({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      autoSelect: false,
      cancelOnTapOutside: true,
      context: "signin",

      promptOptions: {
        baseDelay: 1000,
        maxAttempts: 5,
      },
    }),
  ],
});
