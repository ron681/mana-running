import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Mana Running - Cross Country Statistics",
  description: "Comprehensive Cross Country Statistics & Performance Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Header with Navigation */}
        <header className="bg-black text-white p-6">
          <div className="container mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold mb-2">
                  <a href="/" className="hover:text-gray-300">Mana Running</a>
                </h1>
                <p className="text-gray-200">Comprehensive Cross Country Statistics & Performance Analytics</p>
              </div>
              <nav className="flex space-x-4">
                <a href="/" className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                  Home
                </a>
                <a href="/races" className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition-colors">
                  Races
                </a>
                <a href="/schools" className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 transition-colors">
                  Schools
                </a>
                <a href="/courses" className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 transition-colors">
                  Courses
                </a>
                <a href="/search" className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-500 transition-colors">
                  Search
                </a>
                <a href="/admin" className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-500 transition-colors">
                  Admin
                </a>
              </nav>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}