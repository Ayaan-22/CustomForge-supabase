import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/app/components/auth-provider" // Import AuthProvider

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CustomForge Admin Dashboard",
  description: "Admin dashboard for CustomForge",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans antialiased bg-gradient-to-br from-[#0B0B0F] to-[#14141A]`}>
        <AuthProvider>
          {" "}
          {/* Wrap with AuthProvider */}
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
