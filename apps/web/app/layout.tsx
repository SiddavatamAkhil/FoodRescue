import "@fontsource-variable/manrope";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "FoodRescue — Surplus food rescue network", template: "%s · FoodRescue" },
  description:
    "FoodRescue connects food businesses, NGOs and volunteers so safe surplus food reaches people instead of landfill.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#174C3C" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
