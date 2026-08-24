import type { Metadata } from "next";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { PinoriaControllerGate } from "./pinoria-controller-gate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Pinoria Staff Controller | PINO Team OS",
  description: "Mobile-first staff remote for the shared Pinoria TV Shop and Túi Hành Trang.",
};

export default async function PinoriaControllerPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const params = await searchParams;
  const staffToken = params.t?.trim() ?? "";
  let staff = null;
  try {
    staff = staffToken ? await staffByUsername(staffToken) : null;
  } catch {
    staff = null;
  }

  if (!staff) {
    return (
      <main className="main">
        <div className="page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <section className="card" style={{ width: "min(460px,100%)", padding: 32 }}>
            <div className="eyebrow">PINO TEAM OS · PINORIA</div>
            <h1 style={{ marginTop: 8 }}>Cần xác nhận nhân sự</h1>
            <p className="subtitle">Mở Pinoria Controller từ Dashboard TOS để giữ đúng phiên nhân sự.</p>
            <a className="button" href="/dashboard" style={{ marginTop: 18, display: "inline-flex" }}>Về Dashboard</a>
          </section>
        </div>
      </main>
    );
  }

  return <PinoriaControllerGate staffToken={staffToken} staff={{ id: staff.id, name: staff.name }} />;
}
