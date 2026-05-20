import type { Metadata } from "next";
import { Inter, Scheherazade_New, Readex_Pro } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const scheherazade = Scheherazade_New({
  variable: "--font-scheherazade",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const readexArabic = Readex_Pro({
  variable: "--font-readex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ayāt — The Infinite Ink",
  description:
    "A poetic 3D visualization of the connections between the verses of the Qur'ān, drawn from thirteen classical works on mutashābihāt, wujūh, and naẓāʾir.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${scheherazade.variable} ${readexArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
