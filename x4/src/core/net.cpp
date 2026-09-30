#include "net.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

NetCtl NC;

// ---------------------------------------------------------------------------------------------
// Names, text checks and the saved-network file (/kw/net.txt)
// ---------------------------------------------------------------------------------------------
static bool isAlnum(char c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'); }

bool netNameValid(const char* s) {
  if (!s) return false;
  const size_t n = strlen(s);
  if (n < 1 || n > (size_t)NETNAME_MAX || s[0] == '-' || s[n - 1] == '-') return false;
  for (size_t i = 0; i < n; i++) if (!isAlnum(s[i]) && s[i] != '-') return false;
  return true;
}

void netNameClean(const char* in, char* out, int cap) {
  int o = 0;
  for (const char* p = in ? in : ""; *p && o < cap - 1 && o < NETNAME_MAX; p++) {
    char c = *p;
    if (c >= 'A' && c <= 'Z') c = (char)(c - 'A' + 'a');
    if (isAlnum(c) || c == '-') out[o++] = c;
  }
  out[o] = 0;
  while (o > 0 && out[o - 1] == '-') out[--o] = 0;
  int lead = 0; while (out[lead] == '-') lead++;
  if (lead) memmove(out, out + lead, strlen(out + lead) + 1);
}

bool netTextOk(const char* s, int maxLen, bool allowEmpty) {
  if (!s) return false;
  const size_t n = strlen(s);
  if ((n == 0 && !allowEmpty) || n > (size_t)maxLen) return false;
  for (size_t i = 0; i < n; i++) if ((unsigned char)s[i] < 0x20 || s[i] == 0x7f) return false;   // a tab or newline would break the file
  return true;
}

std::string netText(const NetConfig& c) {
  std::string t;
  t += "# KEEPING WATCH WI-FI. THIS FILE HOLDS WI-FI PASSWORDS IN PLAIN TEXT.\n";
  t += "# It stays on this card: never uploaded, never logged, never synced. Delete the file to forget every network.\n";
  t += std::string("name=") + c.name + "\n";
  if (c.last >= 0 && c.last < c.n) t += "last=" + std::to_string(c.last) + "\n";
  for (int i = 0; i < c.n; i++) t += std::string("net=") + c.nets[i].ssid + "\t" + c.nets[i].pass + "\n";
  return t;
}

void netParse(const std::string& text, NetConfig& c) {
  c = NetConfig();
  size_t a = 0;
  while (a < text.size()) {
    size_t b = text.find('\n', a); if (b == std::string::npos) b = text.size();
    std::string line = text.substr(a, b - a); a = b + 1;
    while (!line.empty() && (line.back() == '\r' || line.back() == ' ')) line.pop_back();
    if (line.empty() || line[0] == '#') continue;
    if (line.compare(0, 5, "name=") == 0) { if (netNameValid(line.c_str() + 5)) { char clean[NETNAME_MAX + 1]; netNameClean(line.c_str() + 5, clean, sizeof clean); strcpy(c.name, clean); } }
    else if (line.compare(0, 5, "last=") == 0) c.last = atoi(line.c_str() + 5);
    else if (line.compare(0, 4, "net=") == 0 && c.n < NET_MAX) {
      const size_t tab = line.find('\t', 4);
      const std::string ssid = line.substr(4, tab == std::string::npos ? std::string::npos : tab - 4);
      const std::string pass = tab == std::string::npos ? "" : line.substr(tab + 1);
      if (!netTextOk(ssid.c_str(), SSID_MAX, false) || !netTextOk(pass.c_str(), PASS_MAX, true)) continue;
      strcpy(c.nets[c.n].ssid, ssid.c_str()); strcpy(c.nets[c.n].pass, pass.c_str()); c.n++;
    }
  }
  if (c.last < 0 || c.last >= c.n) c.last = -1;
}

// Written to a temporary file first, so a flat battery in the middle of a save cannot leave half a file (and lose every network).
void netLoad(NetConfig& c) {
  std::string s;
  if (!hal::readFile(NET_PATH, s) && !hal::readFile("/kw/net.tmp", s)) s.clear();
  netParse(s, c);
}
bool netSave(const NetConfig& c) {
  if (!hal::writeFile("/kw/net.tmp", netText(c))) return false;
  hal::removeFile(NET_PATH);
  return hal::renameFile("/kw/net.tmp", NET_PATH);
}

int netFind(const NetConfig& c, const char* ssid) {
  for (int i = 0; i < c.n; i++) if (strcmp(c.nets[i].ssid, ssid) == 0) return i;
  return -1;
}
bool netAdd(NetConfig& c, const char* ssid, const char* pass) {
  int i = netFind(c, ssid);
  if (i < 0) { if (c.n >= NET_MAX) return false; i = c.n++; }
  snprintf(c.nets[i].ssid, sizeof c.nets[i].ssid, "%s", ssid);
  snprintf(c.nets[i].pass, sizeof c.nets[i].pass, "%s", pass);
  return true;
}
void netForgetAt(NetConfig& c, int i) {
  if (i < 0 || i >= c.n) return;
  for (int k = i; k + 1 < c.n; k++) c.nets[k] = c.nets[k + 1];
  memset(&c.nets[c.n - 1], 0, sizeof c.nets[0]);
  c.n--;
  if (c.last == i) c.last = -1; else if (c.last > i) c.last--;
}

const char* netWhyText(NetWhy w) {
  switch (w) {
    case NetWhy::NotFound: return "That network isn't in range. Move closer to the router, or check the name.";
    case NetWhy::BadPassword: return "The network turned the X4 away. The password is probably wrong.";
    case NetWhy::Timeout: return "The network didn't answer in time.";
    case NetWhy::Lost: return "The X4 lost the network.";
    case NetWhy::Radio: return "The X4 couldn't start its Wi-Fi radio.";
    case NetWhy::NoCard: return "Connected, but the card wouldn't save the network, so it will not be remembered.";
    case NetWhy::Full: return "Connected, but 8 networks are already saved, so this one will not be remembered. Forget one first.";
    case NetWhy::Bad: return "That network name or password can't be used.";
    default: return "";
  }
}

// ---------------------------------------------------------------------------------------------
// The PIN and the one-client rule
// ---------------------------------------------------------------------------------------------
static bool ctEq(const char* a, const char* b) {   // compares all 16 bytes whatever the input, so timing tells nothing
  const size_t la = strnlen(a, 17), lb = strnlen(b, 17);
  unsigned d = (unsigned)(la ^ lb);
  for (size_t i = 0; i < 16; i++) d |= (unsigned)((i < la ? (unsigned char)a[i] : 0) ^ (i < lb ? (unsigned char)b[i] : 0));
  return d == 0;
}

void NetGuard::begin(uint32_t r1) {
  snprintf(pin, sizeof pin, "%06u", (unsigned)(r1 % 1000000u));
  token[0] = 0; owner = 0; lastUse = 0; fails = 0; locked = false;
}

Verdict NetGuard::check(Route r, bool lan, uint32_t ip, const char* tok, uint32_t now) {
  if (!lan || r == Route::Info) return Verdict::Ok;   // the hotspot's own password is its gate; info pages are read-only
  if (locked) return Verdict::Locked;
  const bool mine = token[0] && tok && *tok && ctEq(tok, token) && ip == owner && held(now);
  if (mine) { lastUse = now; return Verdict::Ok; }
  if (held(now) && ip != owner) return Verdict::Busy;
  return Verdict::NeedPin;
}

Verdict NetGuard::unlock(uint32_t ip, const char* given, uint32_t now, uint32_t r1, uint32_t r2) {
  if (locked || !pin[0]) return Verdict::Locked;
  if (held(now) && ip != owner) return Verdict::Busy;
  char clean[12]; int n = 0;
  for (const char* p = given ? given : ""; *p && n < 11; p++) if (*p >= '0' && *p <= '9') clean[n++] = *p;   // "483 921" works
  clean[n] = 0;
  if (!ctEq(clean, pin)) {
    if (++fails >= PIN_TRIES) { locked = true; token[0] = 0; owner = 0; return Verdict::Locked; }
    return Verdict::NeedPin;
  }
  fails = 0; owner = ip; lastUse = now;
  snprintf(token, sizeof token, "%08x%08x", (unsigned)r1, (unsigned)r2);
  return Verdict::Ok;
}

// ---------------------------------------------------------------------------------------------
// The mode the screen is in
// ---------------------------------------------------------------------------------------------
void NetCtl::stop() {
  hal::wifiStop();   // web server, mDNS and radio off, memory freed
  phase = NetPhase::Off; why = NetWhy::None; joinPage = false; fromPhone = false; apUp = false; dropApAt = 0; target = -1;
  memset(pend, 0, sizeof pend); apSsid[0] = apPass[0] = ssid[0] = ip[0] = 0;
  guard = NetGuard();
}

void NetCtl::begin(NetPhase p) { phase = p; why = NetWhy::None; guard.begin(hal::random32()); lastReq = hal::millis(); }

void NetCtl::fail(NetWhy w) {
  memset(pend, 0, sizeof pend);
  why = w;
  if (fromPhone && apUp && w != NetWhy::Radio) { phase = NetPhase::Hotspot; fromPhone = false; return; }   // the hotspot stays up: the phone page shows the reason and she can try again
  hal::wifiStop(); apUp = false; dropApAt = 0; ip[0] = 0; fromPhone = false;
  phase = NetPhase::Failed;
}

bool NetCtl::startHotspot(bool forJoin) {
  stop(); load();
  const uint32_t r = hal::random32();
  snprintf(apSsid, sizeof apSsid, "KeepingWatch-%04X", (unsigned)(r & 0xFFFF));
  snprintf(apPass, sizeof apPass, "%08u", (unsigned)((r >> 3) % 100000000u));
  begin(NetPhase::Hotspot); joinPage = forJoin; target = -2;   // -2: the screen's "try again" restarts the hotspot
  if (!hal::wifiStart(apSsid, apPass)) { apSsid[0] = apPass[0] = 0; fail(NetWhy::Radio); return false; }
  apUp = true;
  return true;
}

bool NetCtl::beginJoin(const char* s, const char* pass, bool phone, int idx) {
  snprintf(ssid, sizeof ssid, "%s", s);
  snprintf(pend, sizeof pend, "%s", pass);
  fromPhone = phone; target = idx; ip[0] = 0; why = NetWhy::None;
  if (!hal::wifiJoin(ssid, pend)) { fail(NetWhy::Radio); return false; }
  phase = NetPhase::Joining; joinAt = hal::millis();
  return true;
}

bool NetCtl::startWifi(int i) {
  stop(); load();
  if (i < 0 || i >= cfg.n) { begin(NetPhase::Failed); why = NetWhy::Bad; return false; }
  begin(NetPhase::Joining);
  if (!hal::wifiStartStation(cfg.name)) { fail(NetWhy::Radio); return false; }
  apUp = false;
  const SavedNet n = cfg.nets[i];
  return beginJoin(n.ssid, n.pass, false, i);
}

void NetCtl::retry() {
  const int t = target;
  if (t >= 0) startWifi(t); else startHotspot(joinPage);
}

void NetCtl::up() {
  if (!hal::wifiAddress(ip, sizeof ip)) ip[0] = 0;
  why = NetWhy::None;
  if (fromPhone) {
    const int had = netFind(cfg, ssid);
    if (!netAdd(cfg, ssid, pend)) why = NetWhy::Full;
    else { cfg.last = netFind(cfg, ssid); if (!netSave(cfg)) { why = NetWhy::NoCard; if (had < 0) netForgetAt(cfg, cfg.n - 1); } }
  } else if (cfg.last != target) { cfg.last = target; netSave(cfg); }
  memset(pend, 0, sizeof pend);
  hal::wifiMdns(cfg.name);
  phase = NetPhase::Wifi;
  guard.begin(hal::random32());                       // a new PIN for the session on her Wi-Fi
  dropApAt = apUp ? hal::millis() + 8000 : 0;         // the phone's page gets a few seconds to read the result before the hotspot goes
  fromPhone = false;
}

void NetCtl::tick() {
  const uint32_t now = hal::millis();
  if (phase == NetPhase::Joining) {
    hal::LinkErr e = hal::LinkErr::None;
    const hal::Link l = hal::wifiLink(&e);
    if (l == hal::Link::Up) up();
    else if (l == hal::Link::Failed) fail(e == hal::LinkErr::NotFound ? NetWhy::NotFound : e == hal::LinkErr::BadPassword ? NetWhy::BadPassword : NetWhy::Timeout);
    else if ((uint32_t)(now - joinAt) > JOIN_MS) { hal::wifiJoinCancel(); fail(NetWhy::Timeout); }
  } else if (phase == NetPhase::Wifi) {
    if (hal::wifiLink(nullptr) != hal::Link::Up) fail(NetWhy::Lost);   // no silent reconnect loop: she sees it and chooses
  }
  if (dropApAt && (int32_t)(now - dropApAt) >= 0) { hal::wifiDropHotspot(); apUp = false; dropApAt = 0; }
}

// ---------------------------------------------------------------------------------------------
// Web API answers. Bodies are built in one static buffer; nothing here echoes a password or the PIN.
// ---------------------------------------------------------------------------------------------
namespace {
char OUT[3072];
struct Out {
  size_t n = 0;
  Out() { OUT[0] = 0; }
  void s(const char* t) { const size_t l = strlen(t); if (n + l + 1 < sizeof OUT) { memcpy(OUT + n, t, l + 1); n += l; } }
  void esc(const char* t) {
    for (; *t; t++) {
      char b[8];
      if (*t == '"' || *t == '\\') { b[0] = '\\'; b[1] = *t; b[2] = 0; }
      else if ((unsigned char)*t < 0x20) snprintf(b, sizeof b, "\\u%04x", (unsigned char)*t);
      else { b[0] = *t; b[1] = 0; }
      s(b);
    }
  }
  void kv(const char* k, const char* v, bool last = false) { s("\""); s(k); s("\":\""); esc(v); s(last ? "\"" : "\","); }
  void kn(const char* k, long v, bool last = false) { char b[24]; snprintf(b, sizeof b, "%ld", v); s("\""); s(k); s("\":"); s(b); if (!last) s(","); }
  void kb(const char* k, bool v, bool last = false) { s("\""); s(k); s(v ? "\":true" : "\":false"); if (!last) s(","); }
};
NetResp json(int code, const char* body, const char* cookie = nullptr) { return NetResp{code, "application/json", body, cookie}; }
}  // namespace

NetResp NetCtl::denied(Verdict v) {
  Out o;
  if (v == Verdict::Busy) { o.s("{\"error\":\"busy\",\"message\":\"Another device is using this X4. Try again in a couple of minutes.\"}"); return json(423, OUT); }
  if (v == Verdict::Locked) { o.s("{\"error\":\"locked\",\"message\":\"Too many wrong PINs. On the X4, press Back and open Wi-Fi again for a new PIN.\"}"); return json(429, OUT); }
  o.s("{\"error\":\"pin\",\"message\":\"Type the PIN shown on the X4.\"}");
  return json(401, OUT);
}

Verdict NetCtl::gate(Route r, bool lanClient, uint32_t cip, const char* token) {
  lastReq = hal::millis();
  return guard.check(r, lanClient, cip, token, lastReq);
}

NetResp NetCtl::info(bool lanClient, uint32_t cip, const char* token) {
  lastReq = hal::millis();
  const Verdict v = guard.check(Route::Read, lanClient, cip, token, lastReq);
  static const char* const PH[] = {"off", "hotspot", "joining", "wifi", "failed"};
  Out o;
  o.s("{");
  o.kv("phase", PH[(int)phase]); o.kv("name", cfg.name); o.kb("lan", lanClient);
  o.kb("needPin", lanClient); o.kb("unlocked", v == Verdict::Ok); o.kb("busy", v == Verdict::Busy); o.kb("locked", v == Verdict::Locked);
  o.kn("tries", guard.triesLeft());
  o.kv("ssid", phase == NetPhase::Joining || phase == NetPhase::Wifi ? ssid : ""); o.kv("ip", phase == NetPhase::Wifi ? ip : "");
  o.kv("why", netWhyText(why)); o.kb("joinPage", joinPage); o.kn("clients", hal::wifiClients());
  uint32_t f = 0, lo = 0, blk = 0; hal::memInfo(&f, &lo, &blk);
  o.s("\"heap\":{"); o.kn("free", f); o.kn("low", lo); o.kn("block", blk, true); o.s("}}");
  return json(200, OUT);
}

NetResp NetCtl::unlock(bool lanClient, uint32_t cip, const char* pin) {
  lastReq = hal::millis();
  if (!lanClient) { Out o; o.s("{\"ok\":true}"); return json(200, OUT); }
  const Verdict v = guard.unlock(cip, pin, lastReq, hal::random32(), hal::random32());
  if (v == Verdict::Ok) {
    static char cookie[64]; snprintf(cookie, sizeof cookie, "kw=%s; Path=/; SameSite=Strict; HttpOnly", guard.token);
    Out o; o.s("{\"ok\":true}"); return json(200, OUT, cookie);
  }
  if (v == Verdict::NeedPin) {
    Out o; char m[80]; snprintf(m, sizeof m, "That isn't the PIN. %d %s left.", guard.triesLeft(), guard.triesLeft() == 1 ? "try" : "tries");
    o.s("{"); o.kv("error", "pin"); o.kv("message", m, true); o.s("}"); return json(403, OUT);
  }
  return denied(v);
}

NetResp NetCtl::scan(bool lanClient, uint32_t cip, const char* token) {
  const Verdict v = gate(Route::Write, lanClient, cip, token);
  if (v != Verdict::Ok) return denied(v);
  static hal::WifiNet found[16];
  const int n = hal::wifiScan(found, 16);
  Out o; o.s("{\"nets\":[");
  for (int i = 0; i < n; i++) {
    if (i) o.s(",");
    o.s("{"); o.kv("s", found[i].ssid); o.kn("r", found[i].rssi); o.kb("l", found[i].secure); o.kb("saved", netFind(cfg, found[i].ssid) >= 0, true); o.s("}");
  }
  o.s("],\"saved\":[");
  for (int i = 0; i < cfg.n; i++) { if (i) o.s(","); o.s("{"); o.kv("s", cfg.nets[i].ssid); o.kb("last", i == cfg.last, true); o.s("}"); }
  o.s("]}");
  return json(200, OUT);
}

NetResp NetCtl::join(bool lanClient, uint32_t cip, const char* token, const char* s, const char* pass) {
  const Verdict v = gate(Route::Write, lanClient, cip, token);
  if (v != Verdict::Ok) return denied(v);
  Out o;
  if (!s || !pass || !netTextOk(s, SSID_MAX, false) || !netTextOk(pass, PASS_MAX, true) || (*pass && strlen(pass) < 8)) {
    o.s("{\"error\":\"bad\",\"message\":\"A Wi-Fi password is 8 to 63 characters, or empty for an open network.\"}"); return json(400, OUT);
  }
  if (phase != NetPhase::Hotspot) {
    o.s("{\"error\":\"mode\",\"message\":\"Joining another network is done from the hotspot. On the X4 open Wi-Fi, then Join a network.\"}"); return json(409, OUT);
  }
  const int saved = netFind(cfg, s);
  const char* use = (*pass || saved < 0) ? pass : cfg.nets[saved].pass;   // no password typed for a network she already saved: use that one
  if (!beginJoin(s, use, true, -1)) { o.s("{\"error\":\"radio\",\"message\":\"The X4 couldn't start joining.\"}"); return json(500, OUT); }
  o.s("{\"state\":\"joining\"}");
  return json(202, OUT);
}

NetResp NetCtl::forget(bool lanClient, uint32_t cip, const char* token, const char* s) {
  const Verdict v = gate(Route::Write, lanClient, cip, token);
  if (v != Verdict::Ok) return denied(v);
  Out o;
  const int i = s ? netFind(cfg, s) : -1;
  if (i < 0) { o.s("{\"error\":\"none\",\"message\":\"That network isn't saved.\"}"); return json(404, OUT); }
  netForgetAt(cfg, i);
  if (!netSave(cfg)) { o.s("{\"error\":\"card\",\"message\":\"The card wouldn't save that.\"}"); return json(500, OUT); }
  o.s("{\"ok\":true}");
  return json(200, OUT);
}

NetResp NetCtl::rename(bool lanClient, uint32_t cip, const char* token, const char* name) {
  const Verdict v = gate(Route::Write, lanClient, cip, token);
  if (v != Verdict::Ok) return denied(v);
  Out o;
  char clean[NETNAME_MAX + 1]; netNameClean(name, clean, sizeof clean);
  if (!netNameValid(clean)) { o.s("{\"error\":\"bad\",\"message\":\"Use letters, digits and hyphens, up to 24.\"}"); return json(400, OUT); }
  snprintf(cfg.name, sizeof cfg.name, "%s", clean);
  if (!netSave(cfg)) { o.s("{\"error\":\"card\",\"message\":\"The card wouldn't save that.\"}"); return json(500, OUT); }
  if (phase == NetPhase::Wifi) hal::wifiMdns(cfg.name);
  o.s("{"); o.kv("name", cfg.name, true); o.s("}");
  return json(200, OUT);
}
