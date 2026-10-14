import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "simple-podomoro",
  description:
    "A one-day focus board. Add up to three tasks, run a 25-minute focus block, then a 5-minute break.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
