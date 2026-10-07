import type { Metadata } from "next";
import Link from "next/link";
import { Code2, ExternalLink, Globe, MessagesSquare } from "lucide-react";

import { InfoPageShell } from "@/components/info/InfoPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About QChat",
  description: "About QChat and its creator, Ayush Khatri.",
};

const stack = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
  "Ably Chat",
  "PostgreSQL",
  "Prisma",
];

export default function AboutPage() {
  return (
    <InfoPageShell
      eyebrow="About"
      title="QChat"
      description="A focused, room-based chat app for quick real-time conversations."
    >
      <Card>
        <CardHeader>
          <MessagesSquare />
          <CardTitle>Simple real-time chat</CardTitle>
          <CardDescription>
            Create a private room, share its QC code, and start chatting without
            unnecessary setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {stack.map((item) => (
            <Badge key={item} variant="secondary">
              {item}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Built by Ayush Khatri</CardTitle>
          <CardDescription>
            Ayush is a full-stack web developer from India who builds functional
            web applications and backend services.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link
              href="https://www.ayushkhatri.in"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe />
              Website
              <ExternalLink />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link
              href="https://github.com/ayush-khatrii"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Code2 />
              GitHub profile
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link
              href="https://github.com/ayush-khatrii/q-chat"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Code2 />
              QChat source
            </Link>
          </Button>
        </CardContent>
      </Card>
    </InfoPageShell>
  );
}
