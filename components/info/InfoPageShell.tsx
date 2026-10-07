import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

type InfoPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function InfoPageShell({
  eyebrow,
  title,
  description,
  children,
}: InfoPageShellProps) {
  return (
    <div className="min-h-full w-full overflow-y-auto">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Button asChild variant="ghost" className="mb-6">
          <Link href="/chat">
            <ArrowLeft />
            Back to chat
          </Link>
        </Button>

        <header className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </header>

        <div className="space-y-4">{children}</div>
      </main>
    </div>
  );
}
