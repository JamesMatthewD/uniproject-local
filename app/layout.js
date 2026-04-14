import "./globals.css";

export const metadata = {
  title: "UniProject",
  description: "Basic Next.js fullstack starter"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
