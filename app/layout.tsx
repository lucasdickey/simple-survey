import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { appConfig } from "@/lib/app-config";
import { clerkConfigured } from "@/lib/clerk-config";
import "./globals.css";

export const metadata: Metadata = {
  title: appConfig.name,
  description: appConfig.tagline,
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-surface text-ink antialiased">{children}</body>
    </html>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // Clerk is optional. Rendering ClerkProvider without keys throws, so the
  // provider is only mounted once credentials actually resolve.
  if (!clerkConfigured) return <Shell>{children}</Shell>;
  return (
    <ClerkProvider>
      <Shell>{children}</Shell>
    </ClerkProvider>
  );
}
