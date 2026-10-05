import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// One family, used across its width axis: condensed to expanded is part of the motion language.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Ajit Shitole · Work", template: "%s · Ajit Shitole" },
  description:
    "20+ years of making. An interactive archive of Ajit Shitole’s work, from art direction to enterprise product design.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/ajit-mark.svg` },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
