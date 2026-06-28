import { authClient } from "@/lib/auth-client"; //import the auth client

export const signInWithGoogle = async () => {
  await authClient.signIn.social({
    provider: "google",
    callbackURL: "/chat",
    errorCallbackURL: "/auth-error",
    newUserCallbackURL: "/welcome",
    disableRedirect: true,
  });
};
