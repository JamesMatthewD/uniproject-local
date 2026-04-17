import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <h1>Texas Hold'Em Poker</h1>
      <p>Play poker against AI or compete with other players online.</p>

      <div className="split-button-container">
        <Link href="/ingame" className="split-button split-button-left">
          <h2>vs AI</h2>
          <p>Play against computer opponents</p>
        </Link>
        <Link href="/multiplayer" className="split-button split-button-right">
          <h2>Play Online</h2>
          <p>Compete with other players</p>
        </Link>
      </div>

      <Link href="/toy-poker" className="card card-link">
        <h2>Play Toy Poker</h2>
        <p>Fast-paced poker with lower stakes and smaller tables.</p>
      </Link>

      <Link href="/agents" className="card card-link">
        <h2>Upload Custom Agents</h2>
        <p>Create and upload your own AI opponents.</p>
      </Link>

      <section className="card">
        <h2>API Endpoints</h2>
        <ul>
          <li>GET /api/health</li>
          <li>POST /api/echo</li>
        </ul>
      </section>
    </main>
  );
}
