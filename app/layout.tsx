import type { ReactNode } from "react";

import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "CSE AI Roleplay Partner",
  description: "Technical Support Engineer training dashboard with simulations and assessments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
