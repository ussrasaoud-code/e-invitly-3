/**
 * Banc d'essai local — imitation minimale de Supabase (REST + Auth)
 * au-dessus de PostgreSQL embarqué (PGlite), pour tester l'application
 * de bout en bout SANS compte Supabase. Usage développeur uniquement.
 *
 *   node scripts/local-stack/server.mjs          → http://127.0.0.1:54321
 *
 * Couvre le sous-ensemble de PostgREST utilisé par l'application :
 * sélections avec ressources imbriquées (et indices de clé étrangère),
 * filtres eq/neq/gt/gte/lt/lte/like/ilike/is/in/not/or, tri, limite,
 * comptage, insert/upsert/update/delete avec retour, RPC.
 * Les règles RLS sont appliquées via SET ROLE + claims JWT, comme Supabase.
 * Auth : lien magique PKCE (le lien est écrit dans la console et dans
 * scripts/local-stack/mailbox.log), session, utilisateur, déconnexion.
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const PORT = Number(process.env.PORT ?? 54321);
const DATA_DIR = process.env.LOCAL_STACK_DATA ?? path.join(ROOT, ".local-stack-data");
export const JWT_SECRET = "local-stack-secret-not-for-production-use-0123456789";

// ── JWT HS256 ──────────────────────────────────────────────────────────
const b64url = (buf) => Buffer.from(buf).toString("base64url");
export function signJwt(payload) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, b, s] = String(token ?? "").split(".");
  if (!h || !b || !s) return null;
  const expected = b64url(createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest());
  if (expected !== s) return null;
  const payload = JSON.parse(Buffer.from(b, "base64url").toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}
export const ANON_KEY = signJwt({ role: "anon", iss: "local", exp: 4102444800 });
export const SERVICE_KEY = signJwt({ role: "service_role", iss: "local", exp: 4102444800 });

// ── Base de données ───────────────────────────────────────────────────
const fresh = !existsSync(DATA_DIR);
if (fresh) mkdirSync(DATA_DIR, { recursive: true });
const db = new PGlite(DATA_DIR, { extensions: { citext, pgcrypto } });
await db.waitReady;

if (fresh) {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  for (const f of readdirSync(path.join(ROOT, "supabase/migrations")).sort()) {
    await db.exec(readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8"));
  }
  await db.exec(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    grant execute on all functions in schema public to anon, authenticated;
    revoke execute on function public.check_rate_limit(text, integer, integer) from anon, authenticated;
  `);
  await db.exec(readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
  console.log("Base initialisée (migrations + seed).");
}

// File d'attente : PGlite n'a qu'une connexion
let chain = Promise.resolve();
const serial = (fn) => {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
};

// ── Métadonnées (colonnes, clés étrangères) ───────────────────────────
const meta = { columns: new Map(), fks: [], pks: new Map(), functions: new Map() };
async function loadMeta() {
  const cols = await db.query(`select table_name, column_name from information_schema.columns where table_schema = 'public'`);
  meta.columns.clear();
  for (const r of cols.rows) {
    if (!meta.columns.has(r.table_name)) meta.columns.set(r.table_name, new Set());
    meta.columns.get(r.table_name).add(r.column_name);
  }
  const fks = await db.query(`
    select c.conname as name, src.relname as src_table, dst.relname as dst_table,
           (select array_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as src_cols,
           (select array_agg(a.attname order by k.ord) from unnest(c.confkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as dst_cols
    from pg_constraint c join pg_class src on src.oid = c.conrelid join pg_class dst on dst.oid = c.confrelid
    join pg_namespace n on n.oid = src.relnamespace
    where c.contype = 'f' and n.nspname = 'public'`);
  meta.fks = fks.rows;
  const pks = await db.query(`select tc.table_name, string_agg(kcu.column_name, ',' order by kcu.ordinal_position) as cols
    from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY' group by tc.table_name`);
  for (const r of pks.rows) meta.pks.set(r.table_name, r.cols);
  const fns = await db.query(`select p.proname, p.proretset, pg_get_function_result(p.oid) as result from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`);
  for (const f of fns.rows) meta.functions.set(f.proname, f);
}
await loadMeta();

class ApiError extends Error {
  constructor(status, code, message, details = null, hint = null) {
    super(message);
    Object.assign(this, { status, code, details, hint });
  }
}

const ident = (s) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) throw new ApiError(400, "PGRST100", `Identifiant invalide : ${s}`);
  return `"${s}"`;
};
const lit = (v) => (v === null ? "null" : `'${String(v).replace(/'/g, "''")}'`);

// ── Analyse de ?select= ───────────────────────────────────────────────
function parseSelect(src) {
  let i = 0;
  function list() {
    const items = [];
    while (i < src.length && src[i] !== ")") {
      items.push(item());
      if (src[i] === ",") i++;
    }
    return items;
  }
  function item() {
    let token = "";
    while (i < src.length && !",()".includes(src[i])) token += src[i++];
    token = token.trim();
    if (src[i] === "(") {
      i++;
      const children = list();
      i++; // )
      let alias = null;
      let rest = token;
      if (token.includes(":")) [alias, rest] = token.split(":");
      const [table, hint] = rest.split("!");
      return { kind: "embed", alias: alias ?? table, table, hint: hint ?? null, children };
    }
    if (token === "*") return { kind: "star" };
    let alias = null;
    let col = token;
    if (token.includes(":") && !token.includes("::")) [alias, col] = token.split(":");
    return { kind: "col", alias: alias ?? col, col };
  }
  return list();
}

function findRelation(from, to, hint) {
  let candidates = meta.fks.filter(
    (f) => (f.src_table === from && f.dst_table === to) || (f.src_table === to && f.dst_table === from),
  );
  if (hint) candidates = candidates.filter((f) => f.name === hint || f.src_cols?.[0] === hint);
  if (!candidates.length) throw new ApiError(400, "PGRST200", `Could not find a relationship between '${from}' and '${to}' in the schema cache`);
  if (candidates.length > 1) {
    throw new ApiError(300, "PGRST201", `Could not embed because more than one relationship was found for '${from}' and '${to}'`, candidates.map((c) => c.name).join(", "));
  }
  const fk = candidates[0];
  // many-to-one si la clé étrangère part de "from"
  return fk.src_table === from ? { fk, toOne: true } : { fk, toOne: false };
}

let aliasSeq = 0;
function selectList(table, alias, items) {
  const parts = [];
  for (const it of items) {
    if (it.kind === "star") parts.push(`${alias}.*`);
    else if (it.kind === "col") {
      if (!meta.columns.get(table)?.has(it.col)) throw new ApiError(400, "42703", `column ${table}.${it.col} does not exist`);
      parts.push(`${alias}.${ident(it.col)} as ${ident(it.alias)}`);
    } else {
      if (!meta.columns.has(it.table)) throw new ApiError(400, "PGRST200", `Could not find table '${it.table}'`);
      const { fk, toOne } = findRelation(table, it.table, it.hint);
      const a = `t${++aliasSeq}`;
      const inner = selectList(it.table, a, it.children.length ? it.children : [{ kind: "star" }]);
      let join;
      if (toOne) join = fk.src_cols.map((c, k) => `${a}.${ident(fk.dst_cols[k])} = ${alias}.${ident(c)}`).join(" and ");
      else join = fk.src_cols.map((c, k) => `${a}.${ident(c)} = ${alias}.${ident(fk.dst_cols[k])}`).join(" and ");
      const sub = `select ${inner} from public.${ident(it.table)} ${a} where ${join}`;
      parts.push(
        toOne
          ? `(select row_to_json(s) from (${sub} limit 1) s) as ${ident(it.alias)}`
          : `coalesce((select json_agg(row_to_json(s)) from (${sub}) s), '[]'::json) as ${ident(it.alias)}`,
      );
    }
  }
  return parts.join(", ");
}

// ── Filtres ───────────────────────────────────────────────────────────
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "or", "and"]);
function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function condition(alias, col, expr) {
  const c = `${alias}.${ident(col)}`;
  let neg = false;
  if (expr.startsWith("not.")) {
    neg = true;
    expr = expr.slice(4);
  }
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const val = expr.slice(dot + 1);
  let sql;
  switch (op) {
    case "eq": sql = `${c} = ${lit(val)}`; break;
    case "neq": sql = `${c} <> ${lit(val)}`; break;
    case "gt": sql = `${c} > ${lit(val)}`; break;
    case "gte": sql = `${c} >= ${lit(val)}`; break;
    case "lt": sql = `${c} < ${lit(val)}`; break;
    case "lte": sql = `${c} <= ${lit(val)}`; break;
    case "like": sql = `${c}::text like ${lit(val.replace(/\*/g, "%"))}`; break;
    case "ilike": sql = `${c}::text ilike ${lit(val.replace(/\*/g, "%"))}`; break;
    case "is": sql = `${c} is ${val === "null" ? "null" : val === "true" ? "true" : val === "false" ? "false" : "unknown"}`; break;
    case "in": {
      const items = val.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      sql = items.length ? `${c} in (${items.map(lit).join(", ")})` : "false";
      break;
    }
    default:
      throw new ApiError(400, "PGRST100", `Opérateur non pris en charge par le banc d'essai : ${op}`);
  }
  return neg ? `not (${sql})` : sql;
}
function whereClause(alias, params) {
  const conds = [];
  for (const [k, v] of params) {
    if (RESERVED.has(k)) {
      if (k === "or" || k === "and") {
        const inner = splitTop(v.replace(/^\(|\)$/g, "")).map((part) => {
          const d = part.indexOf(".");
          return condition(alias, part.slice(0, d), part.slice(d + 1));
        });
        conds.push(`(${inner.join(k === "or" ? " or " : " and ")})`);
      }
      continue;
    }
    conds.push(condition(alias, k, v));
  }
  return conds.length ? `where ${conds.join(" and ")}` : "";
}
function orderClause(alias, order) {
  if (!order) return "";
  return (
    "order by " +
    order
      .split(",")
      .map((o) => {
        const [col, dir, nulls] = o.split(".");
        return `${alias}.${ident(col)} ${dir === "desc" ? "desc" : "asc"}${nulls === "nullsfirst" ? " nulls first" : nulls === "nullslast" ? " nulls last" : ""}`;
      })
      .join(", ")
  );
}

// ── Exécution sous un rôle (RLS) ──────────────────────────────────────
async function asRole(claims, fn) {
  return serial(async () => {
    await db.exec("begin");
    try {
      await db.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [
        claims.sub ?? "",
        JSON.stringify(claims),
      ]);
      await db.exec(`set local role ${claims.role === "service_role" ? "service_role" : claims.role === "authenticated" ? "authenticated" : "anon"}`);
      const out = await fn();
      await db.exec("commit");
      return out;
    } catch (e) {
      await db.exec("rollback").catch(() => {});
      throw e;
    }
  });
}

function claimsFrom(req) {
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const claims = verifyJwt(bearer) ?? verifyJwt(req.headers.apikey);
  if (!claims) throw new ApiError(401, "PGRST301", "JWT invalide");
  return claims;
}

async function handleRest(req, res, url, body) {
  const claims = claimsFrom(req);
  const segs = url.pathname.replace(/^\/rest\/v1\/?/, "").split("/");
  const prefer = req.headers.prefer ?? "";
  const wantObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");

  if (segs[0] === "rpc") {
    const fn = meta.functions.get(segs[1]);
    if (!fn) throw new ApiError(404, "PGRST202", `Could not find the function public.${segs[1]}`);
    const args = Object.entries(body ?? {});
    const call = `public.${ident(segs[1])}(${args.map(([k, v]) => `${ident(k)} => ${typeof v === "object" ? lit(JSON.stringify(v)) : lit(v)}`).join(", ")})`;
    const result = await asRole(claims, async () => {
      if (fn.proretset || fn.result.startsWith("TABLE")) {
        const r = await db.query(`select coalesce(json_agg(row_to_json(x)), '[]'::json) as j from ${call} x`);
        return r.rows[0].j;
      }
      const r = await db.query(`select to_json(${call}) as j`);
      return r.rows[0].j;
    });
    return send(res, 200, result);
  }

  const table = segs[0];
  if (!meta.columns.has(table)) throw new ApiError(404, "42P01", `relation "public.${table}" does not exist`);
  const params = [...url.searchParams.entries()];
  const selectParam = url.searchParams.get("select") ?? "*";
  const items = parseSelect(selectParam);
  aliasSeq = 0;
  const t0 = "t0";

  const finish = (rows, status = 200, total = null) => {
    if (req.method === "HEAD") {
      res.writeHead(200, { "content-range": `*/${total ?? rows.length}` });
      return res.end();
    }
    const headers = {};
    if (prefer.includes("count=exact")) headers["content-range"] = `0-${Math.max(rows.length - 1, 0)}/${total ?? rows.length}`;
    if (wantObject) {
      if (rows.length !== 1) {
        throw new ApiError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", `The result contains ${rows.length} rows`);
      }
      return send(res, status, rows[0], headers);
    }
    if (prefer.includes("return=minimal") && req.method !== "GET") return send(res, status === 200 ? 204 : status, null, headers);
    return send(res, status, rows, headers);
  };

  if (req.method === "GET" || req.method === "HEAD") {
    const where = whereClause(t0, params);
    const order = orderClause(t0, url.searchParams.get("order"));
    const limit = url.searchParams.get("limit") ? `limit ${Number(url.searchParams.get("limit"))}` : "";
    const offset = url.searchParams.get("offset") ? `offset ${Number(url.searchParams.get("offset"))}` : "";
    const sql = `select coalesce(json_agg(row_to_json(r)), '[]'::json) as j from (select ${selectList(table, t0, items)} from public.${ident(table)} ${t0} ${where} ${order} ${limit} ${offset}) r`;
    const countSql = prefer.includes("count=exact") ? `select count(*)::int as n from public.${ident(table)} ${t0} ${where}` : null;
    const [rows, total] = await asRole(claims, async () => {
      const r = await db.query(sql);
      const c = countSql ? (await db.query(countSql)).rows[0].n : null;
      return [r.rows[0].j, c];
    });
    return finish(rows, 200, total);
  }

  const returning = prefer.includes("return=representation") || url.searchParams.has("select");
  const wrapReturn = (cte) =>
    `with ${cte} select coalesce(json_agg(row_to_json(r)), '[]'::json) as j from (select ${selectList(table, t0, items)} from changed ${t0}) r`;

  if (req.method === "POST") {
    const rowsIn = Array.isArray(body) ? body : [body];
    const keys = [...new Set(rowsIn.flatMap((r) => Object.keys(r)))];
    const cols = keys.map(ident).join(", ");
    let conflict = "";
    if (prefer.includes("resolution=merge-duplicates")) {
      const onConflict = url.searchParams.get("on_conflict") ?? meta.pks.get(table) ?? "id";
      const target = onConflict.split(",").map(ident).join(", ");
      const updates = keys.filter((k) => !onConflict.split(",").includes(k)).map((k) => `${ident(k)} = excluded.${ident(k)}`);
      conflict = `on conflict (${target}) do ${updates.length ? `update set ${updates.join(", ")}` : "nothing"}`;
    }
    const sql = wrapReturn(
      `changed as (insert into public.${ident(table)} (${cols}) select ${cols} from json_populate_recordset(null::public.${ident(table)}, ${lit(JSON.stringify(rowsIn))}::json) ${conflict} returning *)`,
    );
    const rows = await asRole(claims, async () => (await db.query(sql)).rows[0].j);
    return returning ? finish(rows, 201) : send(res, 201, null);
  }

  if (req.method === "PATCH") {
    const keys = Object.keys(body ?? {});
    const sets = keys.map((k) => `${ident(k)} = src.${ident(k)}`).join(", ");
    const where = whereClause(t0, params).replace(/^where /, "");
    const sql = wrapReturn(
      `src as (select * from json_populate_record(null::public.${ident(table)}, ${lit(JSON.stringify(body))}::json)),
       changed as (update public.${ident(table)} ${t0} set ${sets} from src ${where ? `where ${where}` : ""} returning ${t0}.*)`,
    );
    const rows = await asRole(claims, async () => (await db.query(sql)).rows[0].j);
    return returning ? finish(rows) : send(res, 204, null);
  }

  if (req.method === "DELETE") {
    const where = whereClause(t0, params);
    const sql = wrapReturn(`changed as (delete from public.${ident(table)} ${t0} ${where} returning ${t0}.*)`);
    const rows = await asRole(claims, async () => (await db.query(sql)).rows[0].j);
    return returning ? finish(rows) : send(res, 204, null);
  }
  throw new ApiError(405, "PGRST000", "Méthode non prise en charge");
}

// ── Auth (GoTrue minimal) ─────────────────────────────────────────────
const pendingCodes = new Map(); // code → { email, challenge }
const refreshTokens = new Map(); // token → userId

async function userById(id) {
  const r = await serial(() => db.query(`select id, email, created_at from auth.users where id = $1`, [id]));
  return r.rows[0] ?? null;
}
function userJson(u) {
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: u.created_at, email_confirmed_at: u.created_at };
}
function session(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = signJwt({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp });
  const refresh_token = randomBytes(16).toString("hex");
  refreshTokens.set(refresh_token, u.id);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token, user: userJson(u) };
}

async function handleAuth(req, res, url, body) {
  const route = url.pathname.replace(/^\/auth\/v1/, "");
  if (route === "/otp" && req.method === "POST") {
    const email = String(body.email ?? "").toLowerCase();
    const u = (await serial(() => db.query(`select id from auth.users where lower(email) = $1`, [email]))).rows[0];
    if (!u && body.create_user === false) {
      throw new ApiError(422, "otp_disabled", "Signups not allowed for otp");
    }
    const code = randomUUID();
    pendingCodes.set(code, { email, challenge: body.code_challenge, method: body.code_challenge_method });
    const redirect = url.searchParams.get("redirect_to") ?? "http://localhost:3000/auth/callback";
    const link = `${redirect}${redirect.includes("?") ? "&" : "?"}code=${code}`;
    appendFileSync(path.join(ROOT, "scripts/local-stack/mailbox.log"), `${new Date().toISOString()} ${email} ${link}\n`);
    console.log(`✉  Lien magique pour ${email} : ${link}`);
    return send(res, 200, {});
  }
  if (route === "/token") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "pkce") {
      const p = pendingCodes.get(body.auth_code);
      if (!p) throw new ApiError(400, "flow_state_not_found", "invalid flow state, no valid flow state found");
      const computed = createHash("sha256").update(body.code_verifier).digest("base64url");
      if (p.challenge && computed !== p.challenge && body.code_verifier !== p.challenge) throw new ApiError(400, "bad_code_verifier", "code challenge does not match previously saved code verifier");
      pendingCodes.delete(body.auth_code);
      const u = (await serial(() => db.query(`select id, email, created_at from auth.users where lower(email) = $1`, [p.email]))).rows[0];
      return send(res, 200, session(u));
    }
    if (grant === "refresh_token") {
      const id = refreshTokens.get(body.refresh_token);
      if (!id) throw new ApiError(400, "refresh_token_not_found", "Invalid Refresh Token");
      refreshTokens.delete(body.refresh_token);
      return send(res, 200, session(await userById(id)));
    }
  }
  if (route === "/user" && req.method === "GET") {
    const claims = verifyJwt((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
    if (!claims?.sub) throw new ApiError(401, "bad_jwt", "invalid JWT");
    const u = await userById(claims.sub);
    if (!u) throw new ApiError(404, "user_not_found", "User not found");
    return send(res, 200, userJson(u));
  }
  if (route === "/logout") return send(res, 204, null);
  // Outil de test : création d'utilisateur (équivalent « Add user » du tableau de bord)
  if (route === "/admin/users" && req.method === "POST") {
    const claims = claimsFrom(req);
    if (claims.role !== "service_role") throw new ApiError(403, "not_admin", "service_role requis");
    const r = await serial(() => db.query(`insert into auth.users (email) values ($1) returning id, email, created_at`, [String(body.email).toLowerCase()]));
    return send(res, 200, userJson(r.rows[0]));
  }
  throw new ApiError(404, "not_found", `Route auth non prise en charge : ${route}`);
}

// ── Serveur HTTP ──────────────────────────────────────────────────────
function send(res, status, data, headers = {}) {
  const payload = data === null || status === 204 ? "" : JSON.stringify(data);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", ...headers });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" });
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return send(res, 400, { message: "JSON invalide" });
  }
  try {
    if (url.pathname.startsWith("/rest/v1")) await handleRest(req, res, url, body);
    else if (url.pathname.startsWith("/auth/v1")) await handleAuth(req, res, url, body);
    else send(res, 404, { message: "not found" });
  } catch (e) {
    const status = e instanceof ApiError ? e.status : e.code === "23505" ? 409 : e.code === "42501" ? 403 : 400;
    if (!(e instanceof ApiError)) console.error(`✗ ${req.method} ${url.pathname}${url.search} → ${e.code ?? ""} ${e.message}`);
    send(res, status, { code: e.code ?? null, message: e.message, details: e.details ?? null, hint: e.hint ?? null });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Banc d'essai Supabase local : http://127.0.0.1:${PORT}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}`);
});
