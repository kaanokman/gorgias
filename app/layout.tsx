import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import './custom.scss';
import "./globals.css";
import HeidiLogo from "@/components/heidi-logo";

const defaultUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
    metadataBase: new URL(defaultUrl),
    title: "Reviews Analyzer",
    description: "Read-only review analysis dashboard",
};

const geistSans = Geist({
    variable: "--font-geist-sans",
    display: "swap",
    subsets: ["latin"],
});

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${geistSans.className} antialiased bg-light`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem={false}
                    disableTransitionOnChange
                >
                    <main className="min-h-screen flex">
                        <nav className="w-full flex items-center justify-between
                                px-5 h-20 bg-sunlight position-fixed z-2">
                            <HeidiLogo color='#28030f' />
                            <div className="w-full flex justify-end items-center text-sm" />
                        </nav>
                        <div style={{ paddingTop: 80 }} className="flex-1 min-w-0">
                            {children}
                        </div>
                    </main>
                </ThemeProvider>
                <ToastContainer position="bottom-right" />
            </body>
        </html>
    );
}
