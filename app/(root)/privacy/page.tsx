import type { Metadata } from "next";
import Link from "next/link";
import { Database, History, LockKeyhole, Radio } from "lucide-react";

import { InfoPageShell } from "@/components/info/InfoPageShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "A short explanation of how QChat handles data.",
};

export default function PrivacyPage() {
  return (
    <InfoPageShell
      eyebrow="Privacy"
      title="Privacy policy"
      description="A short, plain-language summary of the information QChat uses to provide the service. Last updated October 7, 2026."
    >
      <Card>
        <CardHeader>
          <Radio />
          <CardTitle>Realtime messages</CardTitle>
          <CardDescription>
            QChat uses Ably Chat to send and receive messages in real time.
            Message bodies come from Ably rather than QChat&apos;s PostgreSQL
            database.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Ably Chat enables message persistence for chat rooms by default and
          retains message history for 30 days. Read more in the{" "}
          <Link
            href="https://ably.com/docs/chat/rooms/history"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Ably message history documentation
          </Link>
          .
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Database />
          <CardTitle>Information QChat stores</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          QChat stores account details supplied through sign-in, room membership,
          room themes, message read receipts, and notification tokens. This data
          is used only to operate account and chat features.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <History />
          <CardTitle>Technology</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          QChat is built with Next.js, React, TypeScript, PostgreSQL, Prisma,
          Better Auth, Ably Chat, and Firebase Cloud Messaging.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <LockKeyhole />
          <CardTitle>Your responsibility</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Do not send passwords, payment details, or other highly sensitive
          information through chat. You may leave rooms or delete a room you own
          using the room menu.
        </CardContent>
      </Card>
    </InfoPageShell>
  );
}
