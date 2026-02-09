import type { Metadata } from "next";
import { Press_Start_2P, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

const pressStart2P = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Among Nads",
  description: "On-chain prediction game on Monad — bet on Crewmates or Impostors",
  icons: {
    icon: "/amongnads_logo_tg.png",
    apple: "/amongnads_logo_tg.png",
  },
  openGraph: {
    title: "Among Nads",
    description: "On-chain prediction game on Monad — bet on Crewmates or Impostors",
    images: ["/amongnads_logo_tg.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${pressStart2P.variable} ${inter.variable}`}
      >
        <Providers>
          <div className="min-h-screen flex flex-col">
            <div className="p-4 sm:px-8 sm:pt-6 pb-0">
              <Navbar />
            </div>
            <div className="flex-1">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
