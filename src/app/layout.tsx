import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Competitor Research | MEGA AI",
  description: "Find your prospect's top SEO competitors in seconds",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
