import type { Metadata } from "next";
import { Noto_Sans_SC, Roboto_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "练迹｜记录每一次进步",
    description: "为自己和朋友打造的轻量训练记录、进步趋势与公平排行榜。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "练迹｜记录每一次进步",
      description: "训练记录、进步趋势与公平排行榜。",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "练迹，记录每一次进步" }],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${notoSans.variable} ${robotoMono.variable}`}>{children}</body></html>;
}
