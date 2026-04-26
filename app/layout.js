import "./globals.css";

export const metadata = {
  title: "ODDIBLE - Guess the sound",
  description: "A music-tech guessing game prototype built with Next.js and Tailwind CSS."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg)] text-[var(--ink)] antialiased">{children}</body>
    </html>
  );
}
