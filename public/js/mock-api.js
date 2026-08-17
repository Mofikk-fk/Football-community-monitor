(function () {
  const delay = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const dates = ["2026-05-02", "2026-05-09", "2026-05-16", "2026-05-23", "2026-05-30", "2026-06-06", "2026-06-13", "2026-06-20", "2026-06-27", "2026-07-04", "2026-07-11", "2026-07-18", "2026-07-25", "2026-08-01"];
  const db = { players: [], visitors: [], notes: [], users: [], activity: [], settings: null, snapshots: {} };

  function payment(expected, paid) { return { expected, paid }; }
  function attendance(index, offset) {
    return Object.fromEntries(dates.map((date, dateIndex) => [date, ((index * 5 + dateIndex * 3 + offset) % 11) > (index % 4)]));
  }
  function playerIndex(player) {
    const sessions = dates.length;
    const present = dates.filter((date) => player.attendance[date]).length;
    const stats = player.stats;
    const attendancePercentage = Math.round((present / sessions) * 100);
    const performanceIndex = Math.min(100, Math.round(stats.goals * 4 + stats.assists * 3 + attendancePercentage * .35 - stats.yellow * 2 - stats.red * 6));
    const paidMonths = Object.values(player.payments.monthly).filter((row) => row.paid >= row.expected).length;
    const contributionIndex = Math.min(100, Math.round(attendancePercentage * .6 + (paidMonths / 8) * 40));
    return { attendancePercentage, performanceIndex, contributionIndex, currentStreak: dates.slice().reverse().findIndex((date) => !player.attendance[date]) + 1 };
  }
  function decoratePlayer(player) {
    const metrics = playerIndex(player);
    player.indexes = metrics;
    player.performanceIndex = metrics.performanceIndex;
    player.clubContributionIndex = metrics.contributionIndex;
    player.attendancePercentage = metrics.attendancePercentage;
    player.currentStreak = Math.max(0, metrics.currentStreak);
    return player;
  }
  function makePlayer(row, index) {
    const [name, nickname, position, jersey, goals, assists, yellow, red] = row;
    const monthly = {};
    ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"].forEach((month, monthIndex) => {
      const expected = 2000;
      const paid = (index + monthIndex) % 7 === 0 ? 0 : (index + monthIndex) % 9 === 0 ? 1000 : expected;
      monthly[month] = payment(expected, paid);
    });
    return decoratePlayer({ id: `player-${index + 1}`, name, nickname, position, jerseyNumber: jersey, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@achieversfc.demo`, phone: `+234 80${String(12000000 + index * 31791).slice(-8)}`, membership: { memberSinceYear: 2022 + (index % 5) }, subscriptions: { year: { "2026": index % 5 === 0 ? "pending" : "paid" }, months: Object.fromEntries(Object.entries(monthly).map(([key, value]) => [key, value.paid >= value.expected ? "paid" : "pending"])) }, stats: { goals, assists, yellow, red }, attendance: attendance(index, 1), payments: { yearly: { "2026": payment(index % 5 === 0 ? 5000 : 2500, index % 5 === 0 ? 0 : 2500) }, monthly }, discipline: { yellowPaid: yellow * 500, redPaid: red * 1000 }, createdAt: `202${index % 4}-0${(index % 8) + 1}-10T12:00:00.000Z` });
  }
  function makeVisitor(row, index) {
    const [name, nickname] = row;
    const visitor = { id: `visitor-${index + 1}`, name, full_name: name, nickname, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.demo`, phone: `+234 81${String(22000000 + index * 19271).slice(-8)}`, attendance: attendance(index, 3), payments: { sessions: {} }, stats: { goals: index % 5 === 0 ? 2 : index % 3, assists: index % 4, yellow: index % 6 === 0 ? 1 : 0, red: 0 } };
    dates.forEach((date, dateIndex) => { if (visitor.attendance[date]) visitor.payments.sessions[date] = payment(1000, (index + dateIndex) % 5 === 0 ? 0 : 1000); });
    return visitor;
  }
  function log(type, message) { db.activity.unshift({ id: `activity-${Date.now()}-${Math.random()}`, type, message, timestamp: new Date().toISOString() }); }
  async function initialise() {
    const [players, visitors, users, settings] = await Promise.all([fetch("/mock/players.json").then((r) => r.json()), fetch("/mock/visitors.json").then((r) => r.json()), fetch("/mock/users.json").then((r) => r.json()), fetch("/mock/settings.json").then((r) => r.json())]);
    db.players = players.map(makePlayer);
    db.visitors = visitors.map(makeVisitor);
    db.users = users;
    db.settings = {
      ...settings,
      discipline: settings.discipline || {
        yellowFine: Number(settings?.fees?.yellowCardFine) || 500,
        redFine: Number(settings?.fees?.redCardFine) || 1000
      }
    };
    db.notes = [{ id: "note-1", text: "Welcome to the Achievers FC demo. Try the filters and player modals.", createdAt: "2026-08-03T09:00:00.000Z" }, { id: "note-2", text: "Saturday training starts at 7:00 AM.", createdAt: "2026-08-02T12:00:00.000Z" }];
    db.activity = db.players.slice(0, 15).map((player, index) => ({ id: `seed-${index}`, type: index % 3 === 0 ? "payment" : "attendance", message: `${player.name} ${index % 3 === 0 ? "recorded a payment" : "was marked present for training"}.`, timestamp: `2026-08-${String(4 - (index % 4)).padStart(2, "0")}T0${9 + (index % 7)}:00:00.000Z` }));
  }
  const ready = initialise();
  function overview() {
    const monthly = db.players.map((player) => player.payments.monthly["2026-08"] || payment(2000, 0));
    const yearly = db.players.map((player) => player.payments.yearly["2026"] || payment(2500, 0));
    return { counts: { totalMembers: db.players.length, yearlyPaid: yearly.filter((row) => row.paid >= row.expected).length, yearlyPending: yearly.filter((row) => row.paid < row.expected).length, monthlyPaid: monthly.filter((row) => row.paid >= row.expected).length, monthlyPending: monthly.filter((row) => row.paid < row.expected).length } };
  }
  function rankings() {
    const entries = db.players.map((player) => ({ id: player.id, player_id: player.id, name: player.name, nickname: player.nickname, position: player.position, performanceIndex: player.performanceIndex, contributionIndex: player.clubContributionIndex, attendancePercentage: player.attendancePercentage }));
    return { overall: entries.slice().sort((a, b) => b.performanceIndex + b.contributionIndex - a.performanceIndex - a.contributionIndex), performance: entries.slice().sort((a, b) => b.performanceIndex - a.performanceIndex), contribution: entries.slice().sort((a, b) => b.contributionIndex - a.contributionIndex), attendance: entries.slice().sort((a, b) => b.attendancePercentage - a.attendancePercentage) };
  }
  function parseBody(options) { try { return typeof options.body === "string" ? JSON.parse(options.body) : options.body || {}; } catch { return {}; } }
  function idFrom(path) { return path.split("?")[0].split("/").filter(Boolean).pop(); }
  async function request(path, options = {}) {
    await ready; await delay();
    const method = (options.method || "GET").toUpperCase();
    const clean = path.split("?")[0]; const params = new URLSearchParams(path.split("?")[1] || ""); const body = parseBody(options);
    if (clean === "/me") return { data: clone(db.users[0]) };
    if (clean === "/settings") { if (method !== "GET") Object.assign(db.settings, body); return { data: clone(db.settings) }; }
    if (clean === "/players") {
      if (method === "GET") return { data: clone(db.players) };
      const player = decoratePlayer({ id: `player-${Date.now()}`, ...body, name: body.name || "New Demo Player", attendance: attendance(db.players.length, 1), stats: body.stats || { goals: 0, assists: 0, yellow: 0, red: 0 }, membership: { memberSinceYear: 2026 }, subscriptions: { year: { "2026": "pending" }, months: { "2026-08": "pending" } }, payments: { yearly: { "2026": payment(5000, 0) }, monthly: { "2026-08": payment(2000, 0) } } }); db.players.push(player); log("player", `${player.name} was added to the squad.`); return { data: clone(player) };
    }
    if (/^\/players\/[^/]+$/.test(clean)) { const id = idFrom(clean); const index = db.players.findIndex((player) => player.id === id); if (method === "DELETE") { const [removed] = db.players.splice(index, 1); log("player", `${removed?.name || "Player"} was removed from the squad.`); return { data: true }; } if (method !== "GET") Object.assign(db.players[index], body); return { data: clone(db.players[index]) }; }
    if (/^\/players\/[^/]+\/stats$/.test(clean)) { const player = db.players.find((item) => item.id === clean.split("/")[2]); if (method !== "GET") Object.assign(player.stats, body); return { data: clone(player?.stats || {}) }; }
    if (clean === "/payments") { if (method === "GET") return { data: clone(db.players.flatMap((player) => Object.entries(player.payments.monthly).map(([monthKey, record]) => ({ player_id: player.id, month_key: monthKey, expected_amount: record.expected, paid_amount: record.paid, type: "monthly" })).concat(Object.entries(player.payments.yearly).map(([yearKey, record]) => ({ player_id: player.id, year_key: yearKey, expected_amount: record.expected, paid_amount: record.paid, type: "yearly" })))) ) }; const player = db.players.find((item) => item.id === body.playerId); const collection = body.type === "yearly" ? player?.payments.yearly : player?.payments.monthly; const key = body.yearKey || body.monthKey || body.key || "2026-08"; if (collection) collection[key] = payment(Number(body.expected || 2000), Number(body.paid || body.paidAmount || 0)); log("payment", `Payment recorded for ${player?.name || "player"}.`); return { data: true }; }
    if (clean === "/attendance") { if (method === "GET") return { data: clone(db.players.flatMap((player) => Object.entries(player.attendance).map(([date, present]) => ({ player_id: player.id, date, present })))) }; const player = db.players.find((item) => item.id === body.player_id || item.id === body.playerId); if (player) player.attendance[body.date || body.session_date] = Boolean(body.present); log("attendance", `Attendance updated for ${player?.name || "player"}.`); return { data: true }; }
    if (clean === "/overview") return { data: overview() };
    if (clean === "/visitors") { if (method === "GET") return { data: clone(db.visitors) }; const visitor = makeVisitor([body.name || "New Demo Visitor", body.nickname || "Guest"], db.visitors.length); db.visitors.push(visitor); return { data: clone(visitor) }; }
    if (/^\/visitors\/[^/]+$/.test(clean)) { const id = idFrom(clean); const index = db.visitors.findIndex((visitor) => visitor.id === id); if (method === "DELETE") { db.visitors.splice(index, 1); return { data: true }; } if (method !== "GET") Object.assign(db.visitors[index], body); return { data: clone(db.visitors[index]) }; }
    if (/^\/visitors\/[^/]+\/payments$/.test(clean)) { const visitor = db.visitors.find((item) => item.id === clean.split("/")[2]); if (visitor) visitor.payments.sessions[body.sessionDate] = payment(1000, Number(body.paid || 0)); return { data: clone(visitor) }; }
    if (/^\/visitors\/[^/]+\/(stats|promote)$/.test(clean)) { const visitor = db.visitors.find((item) => item.id === clean.split("/")[2]); if (clean.endsWith("/stats") && method !== "GET") Object.assign(visitor.stats, body); return { data: clone(visitor) }; }
    if (clean.startsWith("/visitors/attendance/")) { const date = idFrom(clean); if (method !== "GET") Object.entries(body.attendance || body).forEach(([id, present]) => { const visitor = db.visitors.find((item) => item.id === id); if (visitor) visitor.attendance[date] = Boolean(present); }); return { data: clone(db.visitors) }; }
    if (clean === "/ranking-snapshots") { const key = `${params.get("type") || body.snapshot_type}:${params.get("key") || body.ranking_key}`; if (method === "POST") db.snapshots[key] = { rankings: body.rankings, created_at: new Date().toISOString() }; return { data: clone(db.snapshots[key] || { rankings: rankings() }) }; }
    if (clean === "/reports/access") return { data: { allowed: true } };
    if (clean === "/activity") { const page = Number(params.get("page") || 1), limit = Number(params.get("limit") || 10), start = (page - 1) * limit; return { data: { items: clone(db.activity.slice(start, start + limit)), total: db.activity.length, totalPages: Math.ceil(db.activity.length / limit) } }; }
    if (clean === "/notes") { if (method === "POST") { const note = { id: `note-${Date.now()}`, text: body.text, createdAt: new Date().toISOString() }; db.notes.unshift(note); return { data: clone(note) }; } const query = String(params.get("q") || "").toLowerCase(); const items = db.notes.filter((note) => note.text.toLowerCase().includes(query)); return { data: clone(items), items: clone(items), total: items.length }; }
    if (/^\/notes\/[^/]+$/.test(clean)) { const id = idFrom(clean), index = db.notes.findIndex((note) => note.id === id); if (method === "DELETE") db.notes.splice(index, 1); else Object.assign(db.notes[index], body, { updatedAt: new Date().toISOString() }); return { data: true }; }
    if (clean === "/users") return { data: clone(db.users) };
    if (/^\/users\/[^/]+$/.test(clean)) { const user = db.users.find((item) => item.id === idFrom(clean)); if (method !== "GET" && user) Object.assign(user, body); return { data: clone(user) }; }
    if (clean === "/permissions") return { data: { keys: ["view_reports", "manage_players", "manage_payments"], permissions: [{ role: "super_user", view_reports: true, manage_players: true, manage_payments: true }, { role: "manager", view_reports: true, manage_players: true, manage_payments: true }] } };
    if (clean === "/admin/data-health") return { data: { status: "healthy", checks: [{ label: "Demo data", status: "healthy" }, { label: "Browser session", status: "healthy" }] } };
    if (clean.startsWith("/attendance/session-summary")) return { data: { attendance: [], goals: [], cards: [], visitors: [], warnings: [] } };
    return { data: clean === "/ranking-snapshots" ? rankings() : {} };
  }
  window.demoApi = { request, db };
})();
