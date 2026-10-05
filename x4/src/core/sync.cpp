#include "sync.h"
#include "net.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

bool syncHostOk(const char* s) {
  if (!s) return false;
  const size_t n = strlen(s);
  if (n < 1 || n > (size_t)SYNC_HOST_MAX) return false;
  size_t colon = n;
  for (size_t i = 0; i < n; i++) if (s[i] == ':') { colon = i; break; }
  if (colon == 0) return false;
  for (size_t i = 0; i < colon; i++) {
    const char c = s[i];
    const bool al = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
    if (!al && c != '-' && c != '.') return false;
    if ((i == 0 || i == colon - 1) && !al) return false;
    if (c == '.' && i + 1 < colon && s[i + 1] == '.') return false;
  }
  if (colon < n) {
    const size_t pl = n - colon - 1;
    if (pl < 1 || pl > 5) return false;
    for (size_t i = colon + 1; i < n; i++) if (s[i] < '0' || s[i] > '9') return false;
    const int p = atoi(s + colon + 1); if (p < 1 || p > 65535) return false;
  }
  return true;
}

void syncParse(const std::string& text, SyncCfg& c) {
  c = SyncCfg();
  size_t a = 0;
  while (a < text.size()) {
    size_t b = text.find('\n', a); if (b == std::string::npos) b = text.size();
    std::string line = text.substr(a, b - a); a = b + 1;
    while (!line.empty() && (line.back() == '\r' || line.back() == ' ')) line.pop_back();
    if (line.empty() || line[0] == '#') continue;
    if (line.compare(0, 7, "server=") == 0) {
      const std::string v = line.substr(7);
      if (!syncHostOk(v.c_str())) continue;
      const size_t colon = v.find(':');
      snprintf(c.host, sizeof c.host, "%s", v.substr(0, colon).c_str());
      c.port = colon == std::string::npos ? 443 : (uint16_t)atoi(v.c_str() + colon + 1);
    } else if (line.compare(0, 6, "token=") == 0) {
      const std::string v = line.substr(6);
      bool good = v.size() >= 20 && v.size() <= (size_t)SYNC_TOKEN_MAX;
      for (char ch : v) if ((unsigned char)ch <= 0x20 || (unsigned char)ch > 0x7e) good = false;
      if (good) snprintf(c.token, sizeof c.token, "%s", v.c_str());
    } else if (line.compare(0, 4, "log=") == 0) c.log = line[4] == '1';
  }
}

std::string syncText(const SyncCfg& c) {
  std::string t;
  t += "# KEEPING WATCH STUDIO SYNC. THIS FILE HOLDS A SECRET TOKEN: DO NOT SHARE THE CARD OR THE FILE.\n";
  t += "# It stays on this card: never uploaded, never shown, never logged. Revoke the device in the Studio if the card is lost.\n";
  t += std::string("server=") + c.host + (c.port != 443 ? ":" + std::to_string(c.port) : "") + "\n";
  t += std::string("token=") + c.token + "\n";
  t += std::string("log=") + (c.log ? "1" : "0") + "\n";
  return t;
}

void syncLoad(SyncCfg& c) { std::string s; if (!hal::readFile(SYNC_PATH, s)) s.clear(); syncParse(s, c); }

bool syncSaveLog(SyncCfg& c, bool on) {
  SyncCfg n = c; n.log = on;
  if (!hal::writeFile("/kw/sync.tmp", syncText(n))) return false;
  hal::removeFile(SYNC_PATH);
  if (!hal::renameFile("/kw/sync.tmp", SYNC_PATH)) return false;
  c.log = on; return true;
}

static bool ymName(const char* n) {   // YYYY-MM.csv
  if (strlen(n) != 11 || strcmp(n + 7, ".csv") != 0 || n[4] != '-') return false;
  for (int i : {0, 1, 2, 3, 5, 6}) if (n[i] < '0' || n[i] > '9') return false;
  const int mo = atoi(n + 5); return mo >= 1 && mo <= 12;
}

static char NAMES[SYNC_MONTHS + 8][48];
void syncPlan(SyncPlan& p) {
  p = SyncPlan();
  std::string st; hal::readFile(SYNC_STATE_PATH, st);
  const int k = hal::listFiles("/kw/log", NAMES, SYNC_MONTHS + 8);
  for (int i = 0; i < k && p.n < SYNC_MONTHS; i++) {
    if (!ymName(NAMES[i])) continue;
    SyncMonth& m = p.m[p.n];
    memcpy(m.ym, NAMES[i], 7); m.ym[7] = 0;
    char path[40]; snprintf(path, sizeof path, "/kw/log/%s", NAMES[i]);
    m.size = hal::fileSize(path); if (m.size < 0) m.size = 0;
    m.sent = 0;
    const std::string key = std::string("m=") + m.ym + ":";
    const size_t at = st.find(key);
    if (at != std::string::npos && (at == 0 || st[at - 1] == '\n')) m.sent = atol(st.c_str() + at + key.size());
    if (m.sent > m.size) m.sent = m.size;
    if (m.size > m.sent) { p.pending += m.size - m.sent; p.files++; }
    p.n++;
  }
  for (int a = 1; a < p.n; a++) { SyncMonth t = p.m[a]; int b = a - 1; while (b >= 0 && strcmp(p.m[b].ym, t.ym) > 0) { p.m[b + 1] = p.m[b]; b--; } p.m[b + 1] = t; }
  const size_t at = st.find("last="); if (at != std::string::npos && (at == 0 || st[at - 1] == '\n')) p.last = (time_t)atoll(st.c_str() + at + 5);
}

const char* syncResText(SyncRes r) {
  switch (r) {
    case SyncRes::Ok: return "Sent.";
    case SyncRes::NothingNew: return "Nothing new to send: the Studio already has everything.";
    case SyncRes::NotBuilt: return "This firmware build has no sync. Flash the build with sync (x4-tls) to use it.";
    case SyncRes::NotSetUp: return "Sync isn't set up. In the Studio, add this X4 as a device and copy its sync.txt to the card's kw-update folder.";
    case SyncRes::NoCert: return "The Studio's certificate is missing. Put studio-ca.pem (your server's root certificate) in the card's kw-update folder.";
    case SyncRes::NoClock: return "The clock isn't set. The Studio's certificate has dates, so set the clock first (Menu, Clock).";
    case SyncRes::LogOff: return "The check-in log is switched off, so there is nothing to send. Switch it on to send it.";
    case SyncRes::NoNetwork: return "No Wi-Fi network is saved. Use Join a network first.";
    case SyncRes::JoinFailed: return "The X4 couldn't join that Wi-Fi network. Nothing was sent.";
    case SyncRes::Unreachable: return "The X4 is on Wi-Fi but couldn't reach the Studio. Check the server name in sync.txt and that the Studio is running. Nothing was sent.";
    case SyncRes::Refused: return "The Studio's certificate was refused: it isn't signed by studio-ca.pem, is for a different host name, or has expired. Nothing was sent.";
    case SyncRes::WrongServer: return "That server answered, but it isn't a Journalwright Studio. Nothing was sent.";
    case SyncRes::NoHostCheck: return "This build can't check the server's host name, so it refuses to send. Nothing was sent.";
    case SyncRes::Unauthorized: return "The Studio doesn't accept this device any more. It was revoked or the token is wrong. Add the device again in the Studio.";
    case SyncRes::Limited: return "The Studio asked the X4 to slow down. Try again in a few minutes.";
    case SyncRes::ServerError: return "The Studio had a problem. Nothing is lost: try again later.";
    case SyncRes::Rejected: return "The Studio refused the data (it may be full). Nothing is lost on the card.";
    case SyncRes::Card: return "The card couldn't be read. Nothing was sent.";
    case SyncRes::Cancelled: return "Stopped. What was already sent is kept, and the rest goes next time.";
  }
  return "";
}

static char CA[SYNC_CA_MAX + 1];
static char REPLY[1536];
static uint8_t BUF[SYNC_CHUNK];

static long numAfter(const char* s, const char* key) { const char* p = strstr(s, key); return p ? atol(p + strlen(key)) : -1; }
// The Studio's size for a month, from {"logs":[{"month":"2026-10","size":123},...]}.
static long serverSize(const char* body, const char* ym) {
  char key[40]; snprintf(key, sizeof key, "\"month\":\"%s\",\"size\":", ym);
  const long n = numAfter(body, key); return n < 0 ? 0 : n;
}
static SyncRes codeRes(int code) {
  if (code == 401) return SyncRes::Unauthorized;
  if (code == 429) return SyncRes::Limited;
  if (code >= 500) return SyncRes::ServerError;
  return SyncRes::Rejected;
}
static SyncRes netRes(hal::SyncNet n) {
  switch (n) {
    case hal::SyncNet::NotBuilt: return SyncRes::NotBuilt;
    case hal::SyncNet::Unreachable: return SyncRes::Unreachable;
    case hal::SyncNet::Tls: return SyncRes::Refused;
    case hal::SyncNet::NoHostCheck: return SyncRes::NoHostCheck;
    case hal::SyncNet::WrongServer: return SyncRes::WrongServer;
    case hal::SyncNet::Aborted: return SyncRes::Cancelled;
    default: return SyncRes::Unreachable;
  }
}

static void saveState(const SyncPlan& p, const long* sent) {
  std::string s = "last=" + std::to_string((long long)hal::now()) + "\n";
  for (int i = 0; i < p.n; i++) s += std::string("m=") + p.m[i].ym + ":" + std::to_string(sent[i]) + "\n";
  hal::writeFile(SYNC_STATE_PATH, s);
}

static SyncRes upload(const SyncCfg& c, SyncPlan& p, SyncOut& o) {
  int code = 0, retry = 0;
  hal::SyncNet r = hal::syncRequest("GET", "/api/device/info", c.token, -1, nullptr, 0, &code, REPLY, sizeof REPLY, &retry);
  if (r != hal::SyncNet::Ok) return netRes(r);
  if (code != 200) return codeRes(code);
  static long sent[SYNC_MONTHS];
  for (int i = 0; i < p.n; i++) sent[i] = p.m[i].sent;
  SyncRes res = SyncRes::Ok;
  for (int i = 0; i < p.n && res == SyncRes::Ok; i++) {
    SyncMonth& m = p.m[i];
    long at = serverSize(REPLY, m.ym);
    if (at > m.size) { o.skipped++; sent[i] = m.size; continue; }   // the Studio holds more than the card: leave it alone
    if (at == m.size) { sent[i] = m.size; continue; }
    char path[40], file[40]; snprintf(path, sizeof path, "/api/device/log/%s", m.ym); snprintf(file, sizeof file, "/kw/log/%s.csv", m.ym);
    int tries = 0; bool any = false;
    while (at < m.size && res == SyncRes::Ok) {
      if (hal::syncAbort()) { res = SyncRes::Cancelled; break; }
      int n = hal::readAt(file, (uint32_t)at, BUF, (int)sizeof BUF);
      if (n <= 0) { res = SyncRes::Card; break; }
      if (at + n > m.size) n = (int)(m.size - at);
      r = hal::syncRequest("POST", path, c.token, at, BUF, (size_t)n, &code, REPLY, sizeof REPLY, &retry);
      if (r != hal::SyncNet::Ok) { res = netRes(r); break; }
      if (code == 200) { at += n; o.bytes += n; sent[i] = at; any = true; tries = 0; continue; }
      if (code == 409 && tries++ < 3) { const long s = numAfter(REPLY, "\"size\":"); if (s >= 0 && s <= m.size) { at = s; continue; } }
      res = codeRes(code);
    }
    if (any) o.files++;
  }
  saveState(p, sent);   // whatever went is remembered, so the next sync sends only the rest
  return res;
}

SyncOut syncRun(const NetConfig& nets, int netIndex) {
  SyncOut o; o.net = netIndex;
  SyncCfg c; syncLoad(c);
  auto done = [&](SyncRes r) { o.res = r; hal::syncClose(); hal::wifiStop(); memset(c.token, 0, sizeof c.token); return o; };
  if (!hal::syncBuilt()) return done(SyncRes::NotBuilt);
  if (!c.ok()) return done(SyncRes::NotSetUp);
  std::string ca;
  if (!hal::readFile(SYNC_CA_PATH, ca) || ca.size() > (size_t)SYNC_CA_MAX || ca.find("BEGIN CERTIFICATE") == std::string::npos) return done(SyncRes::NoCert);
  memcpy(CA, ca.data(), ca.size()); CA[ca.size()] = 0;
  if (!hal::timeValid()) return done(SyncRes::NoClock);
  if (!c.log) return done(SyncRes::LogOff);
  if (netIndex < 0 || netIndex >= nets.n) return done(SyncRes::NoNetwork);
  static SyncPlan plan; syncPlan(plan);
  if (plan.pending == 0) return done(SyncRes::NothingNew);
  // Radio on, station only: no web page, no name announcement, no hotspot. Joins the one network the user chose.
  if (!hal::wifiStartSync()) return done(SyncRes::JoinFailed);
  hal::wifiJoin(nets.nets[netIndex].ssid, nets.nets[netIndex].pass);
  const uint32_t t0 = hal::millis();
  for (;;) {
    hal::LinkErr e = hal::LinkErr::None; const hal::Link l = hal::wifiLink(&e);
    if (l == hal::Link::Up) break;
    if (l == hal::Link::Failed) return done(SyncRes::JoinFailed);
    if (hal::syncAbort()) { hal::wifiJoinCancel(); return done(SyncRes::Cancelled); }
    if ((uint32_t)(hal::millis() - t0) > JOIN_MS) { hal::wifiJoinCancel(); return done(SyncRes::JoinFailed); }
    hal::pauseMs(250);
  }
  const hal::SyncNet r = hal::syncOpen(c.host, c.port, CA);
  if (r != hal::SyncNet::Ok) return done(netRes(r));
  const SyncRes res = upload(c, plan, o);
  return done(res);
}
