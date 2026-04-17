import "./globals.css";

export const metadata = {
  title: "Poker AI Playground",
  description: "University Project"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
