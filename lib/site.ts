import type { Metadata } from "next";

export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_APP_URL ?? "https://q-chat-dev.vercel.app",
);
export const siteDescription =
  "Quick, hassle-free chatting. Sign in with Google, create or join a two-person room, and chat in real time from your phone or desktop.";
export const privateMetadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export function publicPageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "QChat",
      locale: "en_IN",
      title,
      description,
      url: path,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "QChat — Quick, hassle-free chatting.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}
