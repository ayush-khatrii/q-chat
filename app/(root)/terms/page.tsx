import type { Metadata } from "next";

import { InfoPageShell } from "@/components/info/InfoPageShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Simple terms for using QChat.",
};

const terms = [
  {
    title: "Use QChat responsibly",
    body: "Do not use QChat for harassment, illegal activity, spam, malware, or attempts to disrupt the service or other users.",
  },
  {
    title: "Your content",
    body: "You are responsible for the messages and information you share. Only post content you have the right to share.",
  },
  {
    title: "Rooms and accounts",
    body: "Keep your account and private room codes secure. Room owners may remove members or delete their rooms.",
  },
  {
    title: "Service availability",
    body: "QChat is provided as available without a guarantee of uninterrupted operation or permanent message storage.",
  },
  {
    title: "Changes",
    body: "Features and these terms may change as QChat develops. Continued use means you accept the current terms.",
  },
];

export default function TermsPage() {
  return (
    <InfoPageShell
      eyebrow="Terms"
      title="Terms of service"
      description="Simple rules for using QChat. Last updated October 7, 2026."
    >
      {terms.map((term) => (
        <Card key={term.title}>
          <CardHeader>
            <CardTitle>{term.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            {term.body}
          </CardContent>
        </Card>
      ))}
    </InfoPageShell>
  );
}
