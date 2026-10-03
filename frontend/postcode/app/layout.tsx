import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Our Patch - Grow your street together",
  description:
    "Understand your local environment, take practical actions, and help your postcode grow greener. Built by Team FlickFlack.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
