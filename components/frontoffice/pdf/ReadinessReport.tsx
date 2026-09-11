import type { ReadinessReportModel } from "../../../app/lib/result/report-model.ts";

/**
 * รายงานความพร้อมสำหรับแปลงเป็น PDF
 *
 * แต่ละ .report-sheet คือหนึ่งหน้า A4 ที่ถูก rasterise แยกกัน
 * ทำให้จำนวนหน้าคงที่ ไม่ขึ้นกับฟอนต์หรือระบบปฏิบัติการของเครื่องผู้ใช้
 * ทุกค่ามาจาก Evaluation Snapshot ชุดเดียวกับหน้าเว็บ ไม่มีการคำนวณซ้ำที่นี่
 */
export function ReadinessReport({ model }: { model: ReadinessReportModel }) {
  return (
    <div id="reportArea" className="rr" data-role="readiness-report" data-snapshot-id={model.snapshotId}>
      {model.pages.map((page, index) => (
        <section className="report-sheet" key={page.id} data-role={`report-page-${page.id}`}>
          <header className="rr-head">
            <div>
              <p className="rr-brand">Route to Own by บสย.</p>
              <h1 className="rr-title" data-role="report-title">
                {model.title}
              </h1>
              {index === 0 ? <p className="rr-subtitle">{model.subtitleTh}</p> : null}
            </div>
            <div className="rr-meta">
              <p>{model.applicationId}</p>
              <p>หน้า {index + 1} / {model.pages.length}</p>
            </div>
          </header>

          <h2 className="rr-h2">{page.heading}</h2>

          {page.rows.length > 0 ? (
            <table className="rr-table">
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <b>{row.value}</b>
                      {row.note ? <small>{row.note}</small> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {page.notes.length > 0 ? (
            <ul className="rr-notes">
              {page.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}

          <footer className="rr-foot">
            <span>
              Snapshot {model.snapshotId} · เวอร์ชันข้อมูล {model.inputVersion}
            </span>
            <span>
              {model.engineStatus} · {model.specVersion}
            </span>
          </footer>
        </section>
      ))}
    </div>
  );
}
