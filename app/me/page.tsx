import { currentIdentity, currentStaff } from "@/lib/repositories/current-user";

export default async function MePage() {
  const [identity, staff] = await Promise.all([currentIdentity(), currentStaff()]);

  if (!identity) {
    return (
      <div className="page">
        <div className="eyebrow">MY SPACE</div>
        <h1>My profile</h1>
        <p className="subtitle">Chưa nhận được identity từ Cloudflare Access.</p>
        <div className="card">
          <h2>Authentication chưa được nối</h2>
          <p className="muted">Local development có thể chạy không cần Access. Khi deploy production, Cloudflare Access phải cấp JWT cho request.</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="page">
        <div className="eyebrow">MY SPACE</div>
        <h1>Identity chưa được map</h1>
        <p className="subtitle">Cloudflare Access đã xác thực, nhưng chưa tìm thấy nhân sự tương ứng trong Notion Staff.</p>
        <div className="card">
          <div className="muted">Email</div>
          <div className="metric" style={{ fontSize: 20 }}>{identity.email || "—"}</div>
          <p className="muted">Hãy điền User ID bằng Cloudflare Access subject hoặc bảo đảm Email trong Staff trùng với email đã xác thực.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="eyebrow">MY SPACE</div>
      <h1>{staff.name || identity.name || "My profile"}</h1>
      <p className="subtitle">Thông tin lấy từ Notion Staff và identity đã xác thực.</p>

      <div className="grid grid-3">
        <div className="card"><div className="muted">Department</div><div className="metric" style={{ fontSize: 20 }}>{staff.department || "—"}</div></div>
        <div className="card"><div className="muted">App Access</div><div className="metric" style={{ fontSize: 20 }}>{staff.appAccess}</div></div>
        <div className="card"><div className="muted">Status</div><div className="metric" style={{ fontSize: 20 }}>{staff.employmentStatus || "—"}</div></div>
      </div>

      <div className="section grid grid-3">
        <div className="card">
          <h2>Identity</h2>
          <div className="list">
            <div className="list-item"><div className="muted">Email</div><strong>{staff.email || identity.email || "—"}</strong></div>
            <div className="list-item"><div className="muted">User ID</div><strong>{staff.userId || "—"}</strong></div>
            <div className="list-item"><div className="muted">Phone</div><strong>{staff.phone || "—"}</strong></div>
          </div>
        </div>
        <div className="card">
          <h2>Functions</h2>
          <div className="list">
            {staff.functions.length ? staff.functions.map((item) => <div className="list-item" key={item}><strong>{item}</strong></div>) : <div className="list-item"><span className="muted">Chưa có dữ liệu</span></div>}
          </div>
        </div>
        <div className="card">
          <h2>Coming next</h2>
          <p className="muted">Lịch cá nhân, timesheet và training progress sẽ nối vào cùng identity này.</p>
        </div>
      </div>
    </div>
  );
}
