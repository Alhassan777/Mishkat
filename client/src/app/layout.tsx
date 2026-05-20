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
  title: "Mishkāt — Mutashābihāt Visualizer",
  description:
    "Mishkāt is a 3D mutashābihāt visualizer that maps verse-to-verse connections from classical scholarship into an interactive Qur'ānic graph.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${scheherazade.variable} ${readexArabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the persisted UI language synchronously so RTL/Arabic font
            don't flicker on first paint. Mirrors useApplyLangToDocument. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{var s=localStorage.getItem('ayat-lang');if(!s)return;var l=(JSON.parse(s)||{}).state&&JSON.parse(s).state.lang;if(l!=='ar'&&l!=='en')return;var h=document.documentElement;h.lang=l;h.dir=l==='ar'?'rtl':'ltr';if(l==='ar')h.dataset.langAr='true';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
