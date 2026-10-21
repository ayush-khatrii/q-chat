import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const runtime = "nodejs";
export const alt = "QChat — Quick, hassle-free chatting.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/logo-1.png"));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        background: "#09090b",
        color: "#fafafa",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${logo.toString("base64")}`}
        width="128"
        height="128"
        alt=""
      />
      <div style={{ fontSize: 88, fontWeight: 700, marginTop: 24 }}>QChat</div>
      <div style={{ fontSize: 36, color: "#a1a1aa", marginTop: 16 }}>
        Quick, hassle-free chatting.
      </div>
    </div>,
    size,
  );
}
