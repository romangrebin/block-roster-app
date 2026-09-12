import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { getUserFromServerComponent } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import AuthButton from "@/components/AuthButton";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Our Block",
  description: "A resident-owned directory, shared notes, and lending library for your block or community.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUserFromServerComponent();

  return (
    <html
      lang="en"
      className={`${lora.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg">
        <header className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-semibold text-ink">
              Our Block
            </Link>
            {isAdmin(user?.email) && (
              <Link href="/admin" className="text-sm text-muted hover:text-ink transition-colors">
                Admin
              </Link>
            )}
          </div>
          <AuthButton user={user} />
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
