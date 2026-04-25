import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TopNav } from "@/components/TopNav";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider, ThemeToggle } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Water Monitor",
  description: "Water quality monitoring dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
        <ThemeProvider>
          <AuthProvider>
            <TopNav />
            <main className="flex-1">{children}</main>
            <ThemeToggle />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
