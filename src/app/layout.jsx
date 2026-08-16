import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata = {
  title: "Dasbor HGPGA",
  description: "Dasbor HGPGA",
  icons: {
    icon: "/apotekku-logo.jpeg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="h-full">
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
