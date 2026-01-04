
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter for "premium" feel as requested
import "./globals.css";
import { NavBar } from "@/components/NavBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MySchoolMate - CBNU Assistant",
  description: "Academic assistant for CBNU ICE students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
