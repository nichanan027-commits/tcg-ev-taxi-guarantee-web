/**
 * ชั้นเก็บข้อมูลในหน่วยความจำสำหรับรันทั้งระบบในเบราว์เซอร์
 *
 * ทำไมถึงมีไฟล์นี้: ตรรกะทั้งหมดของ Front Office เป็นฟังก์ชันบริสุทธิ์อยู่แล้ว
 * สิ่งเดียวที่ต้องมีเซิร์ฟเวอร์คือ PostgreSQL ไฟล์นี้จึงแทนที่ "เฉพาะชั้นเก็บข้อมูล"
 * โดยคงสัญญาเดิมของ SqlClient ไว้ทุกอย่าง โค้ดชั้นบน — repository, service,
 * การตัดสินเส้นทาง ด่านความยินยอม การประเมินตามเงื่อนไข FI — ไม่ถูกแก้แม้แต่บรรทัดเดียว
 *
 * ตัวนี้ไม่ใช่ PostgreSQL และไม่ได้ตั้งใจจะเป็น มันรองรับเฉพาะรูปแบบคำสั่งที่ระบบนี้ใช้จริง
 * คำสั่งรูปแบบอื่นจะโยนข้อผิดพลาดทันที ไม่ใช่คืนแถวผิด ๆ เงียบ ๆ
 * เพราะการคืนคำตอบผิดแบบไม่มีใครรู้ อันตรายกว่าการพังตรงหน้า
 *
 * ความถูกต้องพิสูจน์ด้วยการรันชุดเทสต์เดิมทั้งหมดทับตัวนี้ ไม่ใช่ด้วยการอ่านโค้ด
 */

/**
 * นาฬิกาของ now()
 *
 * PostgreSQL เก็บเวลาละเอียดระดับไมโครวินาที และแต่ละคำสั่งอยู่ทรานแซกชันของตัวเอง
 * จึงแทบไม่มีทางที่สองแถวจะมีเวลาเท่ากัน คำสั่ง order by created_at, id
 * ที่ระบบนี้ใช้จึงตัดสินด้วย created_at เสมอ
 *
 * ถ้าใช้ Date.now() ตรง ๆ (ละเอียดแค่มิลลิวินาที) แถวที่เกิดในมิลลิวินาทีเดียวกันจะเสมอกัน
 * แล้วไปตกที่ id ซึ่งมีส่วนท้ายเป็นค่าสุ่ม ลำดับก็จะสลับไปมา
 * นาฬิกานี้จึงเดินหน้าอย่างน้อยหนึ่งไมโครวินาทีทุกครั้ง เพื่อให้เทียบเท่าของจริง
 */
let lastMicros = 0;

function nowIso() {
  let micros = Date.now() * 1000;
  if (micros <= lastMicros) micros = lastMicros + 1;
  lastMicros = micros;
  const tail = String(micros % 1000).padStart(3, "0");
  return new Date(Math.floor(micros / 1000)).toISOString().replace("Z", `${tail}Z`);
}

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, " ");
}

function squash(sql) {
  return stripComments(sql).replace(/\s+/g, " ").trim();
}

/** แยกรายการที่คั่นด้วย , โดยไม่ตัดกลางวงเล็บหรือกลางสตริง */
function splitTop(text, sep = ",") {
  const out = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (const ch of text) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * ตัดคำสั่งออกเป็นส่วน ๆ ตามคำสำคัญที่อยู่ "ระดับนอกสุด" เท่านั้น
 *
 * ใช้ regex ตัดตรง ๆ ไม่ได้ เพราะ subquery มี where/order by ของตัวเอง
 * เช่น left join lateral (select ... where es.application_id = a.id order by ...)
 * ถ้าตัดด้วย regex จะไปหยิบ where ของ subquery มาเป็น where ของคำสั่งนอก
 * ซึ่งให้ผลผิดแบบเงียบ ๆ อันตรายที่สุด
 */
const CLAUSE_WORDS = [
  "select", "from", "where", "group by", "having", "order by", "limit", "offset",
  "returning", "values", "set", "on conflict"
];

function splitClauses(sql) {
  const found = [];
  let depth = 0;
  let quote = null;
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (quote) {
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; i += 1; continue; }
    if (ch === "(") { depth += 1; i += 1; continue; }
    if (ch === ")") { depth -= 1; i += 1; continue; }
    if (depth === 0 && (i === 0 || /[\s)]/.test(sql[i - 1]))) {
      const rest = sql.slice(i).toLowerCase();
      const word = CLAUSE_WORDS.find(
        (w) => rest.startsWith(w) && /[\s(]/.test(rest[w.length] ?? " ")
      );
      // "on conflict" ต้องไม่ถูกสับสนกับ "on" ของ join — CLAUSE_WORDS ไม่มี "on" เดี่ยว
      if (word) {
        found.push({ word, start: i, end: i + word.length });
        i += word.length;
        continue;
      }
    }
    i += 1;
  }

  const clauses = {};
  found.forEach((c, idx) => {
    const next = found[idx + 1];
    const body = sql.slice(c.end, next ? next.start : sql.length).trim();
    // คำสำคัญเดียวกันซ้ำระดับนอกสุดไม่มีในระบบนี้ เก็บครั้งแรกไว้
    if (!(c.word in clauses)) clauses[c.word] = body;
  });
  return clauses;
}

/** ส่วนหัวของคำสั่ง เช่น "insert into applications (id, status)" */
function headOf(sql) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === "(") { depth += 1; continue; }
    if (ch === ")") { depth -= 1; continue; }
    if (depth === 0 && (i === 0 || /[\s)]/.test(sql[i - 1]))) {
      const rest = sql.slice(i).toLowerCase();
      if (CLAUSE_WORDS.some((w) => rest.startsWith(w) && /[\s(]/.test(rest[w.length] ?? " "))) {
        return sql.slice(0, i).trim();
      }
    }
  }
  return sql;
}

/** แปลงค่าคงที่ใน SQL เป็นค่า JS */
function literal(token, params) {
  const t = token.trim();
  const p = /^\$(\d+)$/.exec(t);
  if (p) return params[Number(p[1]) - 1];
  if (/^'(.*)'$/s.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  if (/^null$/i.test(t)) return null;
  if (/^now\(\)$/i.test(t)) return nowIso();
  throw new Error(`memory-sql: ไม่รู้จักค่า ${t}`);
}

/** where ที่ระบบนี้ใช้มีแค่ and ของการเทียบเท่า/ไม่เท่า/is null — รองรับเท่านั้น */
function compileWhere(clause, params) {
  if (!clause || !clause.trim()) return () => true;
  const parts = clause.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  const preds = parts.map((part) => {
    let m = /^([\w.]+)\s+is\s+not\s+null$/i.exec(part);
    if (m) return (row) => value(row, m[1]) !== null && value(row, m[1]) !== undefined;
    m = /^([\w.]+)\s+is\s+null$/i.exec(part);
    if (m) return (row) => value(row, m[1]) === null || value(row, m[1]) === undefined;
    m = /^([\w.]+)\s*=\s*(.+)$/.exec(part);
    if (m) {
      const want = literal(m[2], params);
      return (row) => eq(value(row, m[1]), want);
    }
    m = /^([\w.]+)\s*(?:<>|!=)\s*(.+)$/.exec(part);
    if (m) {
      const want = literal(m[2], params);
      return (row) => !eq(value(row, m[1]), want);
    }
    throw new Error(`memory-sql: ไม่รองรับเงื่อนไข "${part}"`);
  });
  return (row) => preds.every((p) => p(row));
}

function value(row, ref) {
  const key = ref.includes(".") ? ref.split(".").pop() : ref;
  const alias = ref.includes(".") ? ref.split(".")[0] : null;
  if (alias && row.__joined && row.__joined[alias] && key in row.__joined[alias]) {
    return row.__joined[alias][key];
  }
  return row[key];
}

function eq(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  // boolean ของ PostgreSQL อ่านกลับมาเป็น true/false, ตัวเลขเทียบข้ามชนิดได้
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a) === String(b);
}

function compileOrder(clause) {
  if (!clause) return null;
  const keys = splitTop(clause).map((k) => {
    const m = /^([\w.]+)(?:\s+(asc|desc))?$/i.exec(k.trim());
    if (!m) throw new Error(`memory-sql: ไม่รองรับ order by "${k}"`);
    return { key: m[1].includes(".") ? m[1].split(".").pop() : m[1], dir: (m[2] || "asc").toLowerCase() };
  });
  return (a, b) => {
    for (const { key, dir } of keys) {
      const av = a[key];
      const bv = b[key];
      if (av === bv) continue;
      const less = av === null || av === undefined ? true : bv === null || bv === undefined ? false : av < bv;
      return (less ? -1 : 1) * (dir === "desc" ? -1 : 1);
    }
    return 0;
  };
}

export function createMemorySqlClient() {
  /** ตาราง: ชื่อ → { rows: [], columns: Map<name, {default}> } */
  const db = new Map();
  const sequences = new Map();
  let rowSeq = 0;

  function table(name) {
    const t = db.get(name);
    if (!t) throw new Error(`memory-sql: ไม่พบตาราง ${name}`);
    return t;
  }

  /** ค่าเริ่มต้นของคอลัมน์ตาม DDL — ใช้เมื่อ insert ไม่ได้ระบุคอลัมน์นั้น */
  function applyDefaults(name, row) {
    const t = table(name);
    for (const [col, def] of t.columns) {
      if (col in row) continue;
      if (def.default === undefined) { row[col] = null; continue; }
      row[col] = typeof def.default === "function" ? def.default() : def.default;
    }
    return row;
  }

  // ---------- DDL ----------
  function createTable(stmt) {
    const m = /create table if not exists (\w+)\s*\(([\s\S]*)\)\s*$/i.exec(stmt);
    if (!m) throw new Error(`memory-sql: อ่าน create table ไม่ออก: ${stmt.slice(0, 80)}`);
    const [, name, body] = m;
    if (db.has(name)) return;

    const columns = new Map();
    for (const def of splitTop(body)) {
      if (/^(primary key|unique|foreign key|constraint|check)\b/i.test(def)) continue;
      const cm = /^(\w+)\s+([\s\S]*)$/.exec(def.trim());
      if (!cm) continue;
      const [, col, rest] = cm;
      let dflt;
      const dm = /default\s+(.+?)(?:\s+(?:not null|references|primary key|unique|check)\b|$)/i.exec(rest);
      if (dm) {
        const raw = dm[1].trim().replace(/::\w+(\[\])?/g, "");
        if (/^now\(\)$/i.test(raw)) dflt = () => nowIso();
        else if (/^'(.*)'$/s.test(raw)) dflt = raw.slice(1, -1);
        else if (/^-?\d+(\.\d+)?$/.test(raw)) dflt = Number(raw);
        else if (/^true$/i.test(raw)) dflt = true;
        else if (/^false$/i.test(raw)) dflt = false;
      }
      columns.set(col, { default: dflt });
    }
    db.set(name, { rows: [], columns });
  }

  function alterTable(stmt) {
    const m = /alter table (\w+)\s+add column if not exists (\w+)/i.exec(stmt);
    if (!m) return; // คำสั่งเปลี่ยนโครงแบบอื่นยังไม่มีใช้
    const [, name, col] = m;
    const t = db.get(name);
    if (!t || t.columns.has(col)) return;
    t.columns.set(col, { default: undefined });
    for (const row of t.rows) if (!(col in row)) row[col] = null;
  }

  function createSequence(stmt) {
    const m = /create sequence if not exists (\w+)(?:\s+start with (\d+))?/i.exec(stmt);
    if (!m) return;
    if (!sequences.has(m[1])) sequences.set(m[1], Number(m[2] ?? 1) - 1);
  }

  function runDdl(stmt) {
    if (/^create table/i.test(stmt)) return createTable(stmt);
    if (/^create sequence/i.test(stmt)) return createSequence(stmt);
    if (/^create index/i.test(stmt)) return; // ดัชนีไม่เปลี่ยนผลลัพธ์ของคำสั่งที่ระบบนี้ใช้
    if (/^alter table/i.test(stmt)) return alterTable(stmt);
    throw new Error(`memory-sql: ไม่รองรับคำสั่ง DDL: ${stmt.slice(0, 80)}`);
  }

  // ---------- DML ----------
  function runInsert(text, params) {
    const clauses = splitClauses(text);
    const head = /^insert into (\w+)\s*\(([\s\S]*)\)$/i.exec(headOf(text));
    if (!head || clauses.values === undefined) {
      throw new Error(`memory-sql: อ่าน insert ไม่ออก: ${text.slice(0, 100)}`);
    }
    const [, name, colText] = head;
    const valText = /^\(([\s\S]*)\)$/.exec(clauses.values.trim());
    if (!valText) throw new Error(`memory-sql: อ่าน values ไม่ออก: ${clauses.values.slice(0, 80)}`);
    const conflict = clauses["on conflict"] === undefined ? null : clauses["on conflict"];
    const returning = clauses.returning;
    const cols = splitTop(colText).map((c) => c.trim());
    const vals = splitTop(valText[1]).map((v) => literal(v, params));

    const t = table(name);
    const incoming = {};
    cols.forEach((c, i) => { incoming[c] = vals[i]; });

    if (conflict !== null) {
      // "on conflict (cols) do update set ..." — คำว่า set ถูกแยกเป็นอีกส่วนแล้ว
      const cm = /^\(([^)]*)\)\s*do (update|nothing)$/i.exec(conflict.trim());
      if (!cm) throw new Error(`memory-sql: ไม่รองรับ on conflict แบบนี้: ${conflict.slice(0, 80)}`);
      const keys = splitTop(cm[1]).map((k) => k.trim());
      const existing = t.rows.find((r) => keys.every((k) => eq(r[k], incoming[k])));
      if (existing && /nothing/i.test(cm[2])) return returning ? [project(existing, returning)] : [];
      if (existing) {
        if (clauses.set === undefined) {
          throw new Error(`memory-sql: on conflict do update ต้องมี set: ${text.slice(0, 80)}`);
        }
        for (const assign of splitTop(clauses.set)) {
          const am = /^(\w+)\s*=\s*([\s\S]+)$/.exec(assign.trim());
          if (!am) continue;
          const rhs = am[2].trim();
          const ex = /^excluded\.(\w+)$/i.exec(rhs);
          existing[am[1]] = ex ? incoming[ex[1]] : literal(rhs, params);
        }
        return returning ? [project(existing, returning)] : [];
      }
    }

    const row = applyDefaults(name, { ...incoming });
    row.__seq = (rowSeq += 1); // ลำดับการแทรก ใช้เป็นตัวตัดสินเมื่อ order by ชนกัน
    t.rows.push(row);
    return returning ? [project(row, returning)] : [];
  }

  function runUpdate(text, params) {
    const clauses = splitClauses(text);
    const head = /^update (\w+)$/i.exec(headOf(text));
    if (!head || clauses.set === undefined) {
      throw new Error(`memory-sql: อ่าน update ไม่ออก: ${text.slice(0, 100)}`);
    }
    const name = head[1];
    const setText = clauses.set;
    const returning = clauses.returning;
    const pred = compileWhere(clauses.where, params);
    const t = table(name);
    const touched = [];
    for (const row of t.rows) {
      if (!pred(row)) continue;
      for (const assign of splitTop(setText)) {
        const am = /^(\w+)\s*=\s*([\s\S]+)$/.exec(assign.trim());
        if (!am) throw new Error(`memory-sql: อ่าน set ไม่ออก: ${assign}`);
        row[am[1]] = literal(am[2], params);
      }
      touched.push(row);
    }
    return returning ? touched.map((r) => project(r, returning)) : [];
  }

  function runDelete(text, params) {
    const clauses = splitClauses(text);
    // "from" เป็นคำสำคัญ ชื่อตารางจึงไปอยู่ในส่วน from ไม่ใช่ส่วนหัว
    const name = /^(\w+)$/.exec((clauses.from ?? "").trim());
    if (!/^delete$/i.test(headOf(text)) || !name) {
      throw new Error(`memory-sql: อ่าน delete ไม่ออก: ${text.slice(0, 100)}`);
    }
    const t = table(name[1]);
    const pred = compileWhere(clauses.where, params);
    t.rows = t.rows.filter((r) => !pred(r));
    return [];
  }

  function project(row, returningText) {
    const text = returningText.replace(/^returning\s+/i, "").trim();
    if (text === "*") return clean(row);
    const out = {};
    for (const part of splitTop(text)) {
      const am = /^([\w.]+)(?:\s+as\s+(\w+))?$/i.exec(part.trim());
      if (!am) throw new Error(`memory-sql: ไม่รองรับ returning "${part}"`);
      const key = am[1].includes(".") ? am[1].split(".").pop() : am[1];
      out[am[2] || key] = row[key] ?? null;
    }
    return out;
  }

  function clean(row) {
    const out = {};
    for (const [k, v] of Object.entries(row)) if (k !== "__seq" && k !== "__joined") out[k] = v;
    return out;
  }

  function runSelect(text, params) {
    // nextval — ลำดับเลขที่ใบสมัครและเลขที่เคส
    let m = /^select nextval\('(\w+)'\) as (\w+)$/i.exec(text);
    if (m) {
      const next = (sequences.get(m[1]) ?? 0) + 1;
      sequences.set(m[1], next);
      return [{ [m[2]]: String(next) }];
    }

    // count
    m = /^select count\(\*\)(?:::\w+)? as (\w+) from (\w+)(?: where ([\s\S]*))?$/i.exec(text);
    if (m) {
      const pred = compileWhere(m[3], params);
      return [{ [m[1]]: table(m[2]).rows.filter(pred).length }];
    }

    // ค่าคงที่เพื่อตรวจการมีอยู่ เช่น select 1 as ok ... limit 1
    m = /^select (\d+) as (\w+) from (\w+)(?: where ([\s\S]*?))?(?: limit (\d+))?$/i.exec(text);
    if (m) {
      const pred = compileWhere(m[4], params);
      const rows = table(m[3]).rows.filter(pred);
      const limited = m[5] ? rows.slice(0, Number(m[5])) : rows;
      return limited.map(() => ({ [m[2]]: Number(m[1]) }));
    }

    const clauses = splitClauses(text);
    if (clauses.select === undefined || clauses.from === undefined) {
      throw new Error(`memory-sql: อ่าน select ไม่ออก: ${text.slice(0, 120)}`);
    }
    const colText = clauses.select;
    const fromText = clauses.from;
    const whereText = clauses.where;
    const orderText = clauses["order by"];
    const limitText = clauses.limit;

    let rows = resolveFrom(fromText, params);
    rows = rows.filter(compileWhere(whereText, params));

    const cmp = compileOrder(orderText);
    if (cmp) rows = [...rows].sort((a, b) => cmp(a, b) || (a.__seq ?? 0) - (b.__seq ?? 0));
    else rows = [...rows].sort((a, b) => (a.__seq ?? 0) - (b.__seq ?? 0));

    if (limitText) rows = rows.slice(0, Number(limitText));

    const cols = colText.trim();
    if (cols === "*") return rows.map(clean);
    return rows.map((row) => {
      const out = {};
      for (const part of splitTop(cols)) {
        const p = part.trim();
        const sub = /^\(\s*select ([\s\S]*)\)\s+as (\w+)$/i.exec(p);
        if (sub) { out[sub[2]] = runScalarSubquery(sub[1], row, params); continue; }
        const am = /^([\w.]+)(?:::\w+)?(?:\s+as\s+(\w+))?$/i.exec(p);
        if (!am) throw new Error(`memory-sql: ไม่รองรับคอลัมน์ "${p}"`);
        const key = am[1].includes(".") ? am[1].split(".").pop() : am[1];
        out[am[2] || key] = value(row, am[1]) ?? null;
      }
      return out;
    });
  }

  /** from ที่ใช้จริงมีสองแบบ: ตารางเดียว และ left join แบบเทียบคีย์ */
  function resolveFrom(fromText, params) {
    const text = fromText.trim();
    const single = /^(\w+)(?:\s+(\w+))?$/.exec(text);
    if (single) return table(single[1]).rows.map((r) => withAlias(r, single[2] || single[1]));

    const baseMatch = /^(\w+)\s+(\w+)\s+((?:left join|join)[\s\S]*)$/i.exec(text);
    if (!baseMatch) throw new Error(`memory-sql: ไม่รองรับ from "${text.slice(0, 90)}"`);
    const [, baseName, baseAlias, joinText] = baseMatch;

    let rows = table(baseName).rows.map((r) => withAlias(r, baseAlias));

    const joinRe = /(left join|join)\s+(?:lateral\s*\(([\s\S]*?)\)\s+(\w+)\s+on true|(\w+)\s+(\w+)\s+on\s+([\w.]+)\s*=\s*([\w.]+))/gi;
    let jm;
    while ((jm = joinRe.exec(joinText)) !== null) {
      if (jm[2]) {
        // lateral — คำนวณทีละแถวของฝั่งซ้าย
        const alias = jm[3];
        rows = rows.map((row) => {
          const sub = runSelectFor(jm[2], row, params);
          return attach(row, alias, sub[0] ?? null);
        });
        continue;
      }
      const [, , , , joinName, joinAlias, leftRef, rightRef] = jm;
      const joinRows = table(joinName).rows;
      rows = rows.map((row) => {
        const match = joinRows.find((jr) => {
          const l = refValue(row, leftRef, joinAlias, jr);
          const r = refValue(row, rightRef, joinAlias, jr);
          return eq(l, r);
        });
        return attach(row, joinAlias, match ?? null);
      });
    }
    return rows;
  }

  function refValue(row, ref, joinAlias, joinRow) {
    const [alias, col] = ref.includes(".") ? ref.split(".") : [null, ref];
    if (alias === joinAlias) return joinRow[col];
    return value(row, ref);
  }

  function withAlias(row, alias) {
    const view = { ...row };
    view.__joined = { [alias]: row };
    return view;
  }

  function attach(row, alias, joined) {
    const view = { ...row, __joined: { ...row.__joined, [alias]: joined ?? {} } };
    if (joined) for (const [k, v] of Object.entries(joined)) if (!(k in view)) view[k] = v;
    return view;
  }

  /** subquery ที่อ้างแถวฝั่งนอก — ใช้ใน export metrics */
  function runSelectFor(inner, outerRow, params) {
    const text = squash(inner);
    const clauses = splitClauses(text);
    const fromMatch = /^(\w+)(?:\s+(\w+))?$/.exec((clauses.from ?? "").trim());
    if (clauses.select === undefined || !fromMatch) {
      throw new Error(`memory-sql: ไม่รองรับ subquery "${text.slice(0, 90)}"`);
    }
    const [, name, alias] = fromMatch;
    const whereText = clauses.where;
    const orderText = clauses["order by"];
    const limitText = clauses.limit;
    let rows = table(name).rows.map((r) => withAlias(r, alias || name));
    if (whereText) rows = rows.filter(outerAwareWhere(whereText, outerRow, params, alias || name));
    const cmp = compileOrder(orderText);
    if (cmp) rows = [...rows].sort((a, b) => cmp(a, b) || (a.__seq ?? 0) - (b.__seq ?? 0));
    if (limitText) rows = rows.slice(0, Number(limitText));
    return rows.map(clean);
  }

  function runScalarSubquery(inner, outerRow, params) {
    const text = squash(inner);
    if (/^count\(\*\)(?:::\w+)?\s+from\b/i.test(text)) {
      const clauses = splitClauses(text);
      const fm = /^(\w+)(?:\s+(\w+))?$/.exec((clauses.from ?? "").trim());
      if (!fm) throw new Error(`memory-sql: ไม่รองรับ count subquery "${text.slice(0, 90)}"`);
      const alias = fm[2] || fm[1];
      const rows = table(fm[1]).rows.map((r) => withAlias(r, alias));
      return rows.filter(outerAwareWhere(clauses.where, outerRow, params, alias)).length;
    }
    const rows = runSelectFor("select " + text, outerRow, params);
    return rows.length ? Object.values(rows[0])[0] ?? null : null;
  }

  /** where ของ subquery: ฝั่งขวาอาจอ้างแถวฝั่งนอก */
  function outerAwareWhere(clause, outerRow, params, innerAlias) {
    if (!clause) return () => true;
    const parts = clause.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
    return (row) =>
      parts.every((part) => {
        const m = /^([\w.]+)\s*=\s*(.+)$/.exec(part);
        if (!m) return compileWhere(part, params)(row);
        const left = resolveRef(m[1], row, outerRow, innerAlias);
        const rightRaw = m[2].trim();
        const right = /^[\w.]+$/.test(rightRaw) && !/^\$/.test(rightRaw)
          ? resolveRef(rightRaw, row, outerRow, innerAlias)
          : literal(rightRaw, params);
        return eq(left, right);
      });
  }

  function resolveRef(ref, innerRow, outerRow, innerAlias) {
    if (/^(true|false|null)$/i.test(ref)) return literal(ref, []);
    const alias = ref.includes(".") ? ref.split(".")[0] : null;
    if (!alias || alias === innerAlias) return value(innerRow, ref);
    return value(outerRow, ref);
  }

  // ---------- ทางเข้า ----------
  async function run(text, params) {
    const sql = squash(text);
    if (/^select\b/i.test(sql)) return runSelect(sql, params);
    if (/^insert\b/i.test(sql)) return runInsert(sql, params);
    if (/^update\b/i.test(sql)) return runUpdate(sql, params);
    if (/^delete\b/i.test(sql)) return runDelete(sql, params);
    return runDdl(sql);
  }

  const client = async (strings, ...values) => {
    let text = "";
    for (let i = 0; i < strings.length; i += 1) {
      text += strings[i];
      if (i < values.length) text += `$${i + 1}`;
    }
    return (await run(text, values)) ?? [];
  };

  client.driver = "pglite";

  client.exec = async (statements) => {
    for (const stmt of squash(statements).split(";")) {
      const s = stmt.trim();
      if (s) await run(s, []);
    }
  };

  /** schema ถูกฉีดตอนสร้าง client เพื่อไม่ต้องอ่านไฟล์ในเบราว์เซอร์ */
  client.__setMigration = (sqlText) => { client.__migration = sqlText; };
  client.migrate = async () => {
    if (!client.__migration) throw new Error("memory-sql: ยังไม่ได้ตั้งค่า schema");
    await client.exec(client.__migration);
  };

  client.__dump = () => Object.fromEntries([...db].map(([k, v]) => [k, v.rows.map(clean)]));

  return client;
}
