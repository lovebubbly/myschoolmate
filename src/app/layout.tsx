
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter for "premium" feel as requested
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MySchoolMate | 충북대학교 정보통신공학부 AI 비서",
  description: "충북대학교 정보통신공학부 학생들을 위한 스마트 AI 학사 비서 서비스입니다.",
  icons: {
    icon: "/icon.png",
  },
};

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <AuthSessionProvider>
            <NavBar />
            {children}
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
