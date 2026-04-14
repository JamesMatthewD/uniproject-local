import Link from "next/link";

export default function IngamePage() {
  return (
    <main className="container">
      <h1>Ingame</h1>
      <p>This is a separate page reached from the card on the homepage.</p>

      <Link href="/" className="back-link">
        Go back home
      </Link>
    </main>
  );
}
