"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, ArrowRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";

const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="h-5 w-5"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default function HomePage() {
  const { data: session } = authClient.useSession();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const isLoggedIn = !!session;

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setSignInError(null);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/chat",
      });

      if (result.error) {
        setSignInError(result.error.message ?? "Google sign in failed.");
      }
    } finally {
      setSigningIn(false);
    }
  };
  return (
    <main className="py-20 relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
        <div className="mb-8 cursor-pointer flex items-center gap-3 rounded-full border border-primary/70 bg-black px-4 py-2 backdrop-blur">
          <div className="flex  h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MessageCircle className="h-5 w-5" />
          </div>

          <span className="text-xl font-bold tracking-tight">QChat</span>
        </div>

        {/* Badge */}

        <Badge
          variant="secondary"
          className="mb-6 rounded-full px-4 py-4 border border-accent-foreground/10"
        >
          Room Based • Instant Conversations
        </Badge>

        <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Join Any Room.
          <br />
          Chat Instantly.
        </h1>

        <p className="mt-6 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base md:text-lg">
          QChat lets anyone create or join rooms and start conversations in
          seconds. No unnecessary steps. Just instant real-time chatting.
        </p>

        {/* CTA */}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {!isLoggedIn ? (
            <>
              <Button
                size="lg"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="h-12 px-8 text-base gap-2"
              >
                <GoogleIcon />
                {signingIn ? "Signing in..." : "Sign in with Google"}
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
              >
                JOIN ROOM
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href="/chat">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  GO TO CHAT
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
              >
                <Link href="/chat">
                  CREATE A ROOM
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>

        {signInError ? (
          <p className="mt-3 text-sm text-destructive">{signInError}</p>
        ) : null}

        {isLoggedIn && (
          <p className="mt-4 text-sm text-muted-foreground">
            Welcome back,{" "}
            <span className="font-medium text-foreground">
              {session?.user?.name}
            </span>
            !
          </p>
        )}

        <div className="mt-10 px-5 flex items-center justify-center gap-8 text-center">
          <div>
            <h3 className="text-xl font-bold">∞</h3>
            <p className="text-xs text-muted-foreground">Unlimited Rooms</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <h3 className="text-xl font-bold">⚡</h3>
            <p className="text-xs text-muted-foreground">Real-time Messages</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <h3 className="text-xl font-bold">🌍</h3>
            <p className="text-xs text-muted-foreground">Chat Anywhere</p>
          </div>
        </div>
      </section>
      {/* <ConnectionStatusComponent /> */}
    </main>
  );
}
