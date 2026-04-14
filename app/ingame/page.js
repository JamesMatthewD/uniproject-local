import Link from "next/link";

export default function IngamePage() {
  return (
    <main className="ingame-page">
      <Link href="/" className="ingame-back-link">
        Back to main page
      </Link>

      <section className="green-box" aria-label="Ingame area">
        <div className="green-box-inner" />
      </section>
    </main>
  );
}
