import { MattersClient } from "./MattersClient";

export const dynamic = "force-dynamic";

export default async function MattersPage() {
  let snap: any = null;
  let error: string | null = null;

  try {
    const r = await fetch("http://localhost:3000/api/hand/agenda", { cache: "no-store" });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      error = e.error ?? `HTTP ${r.status}`;
    } else {
      snap = await r.json();
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return <MattersClient snap={snap} error={error} />;
}
