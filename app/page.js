import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <h1>UniProject Next.js Starter</h1>
      <p>This app includes a frontend and backend API routes.</p>

      <Link href="/ingame" className="card card-link">
        <h2>Go To Ingame Page</h2>
        <p>Click this card to open another page in the app.</p>
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
