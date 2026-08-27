import { Toaster } from "@/components/ui/sonner";
import { Geist_Mono, Roboto_Slab } from "next/font/google";
import "./globals.css";

const robotoSlab = Roboto_Slab({
  subsets: ["latin"],
  variable: "--font-roboto-slab",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata = {
  title: "Dasbor HGPGA",
  description: "Dasbor HGPGA",
  icons: {
    icon: "/apotekku-logo.jpeg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      className={`${robotoSlab.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
