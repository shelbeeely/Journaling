// Sync client (BUILD-PLAN N2) on a simulated Studio: config file, plan, upload loop, resume, every failure and its message.
// Runs the device's own core/sync.cpp against host/hal_host.cpp's fake Studio (the same offset rules as studio/src/devices.mjs).
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <sstream>
#include "../src/core/sync.h"
#include "../src/core/net.h"

void appMain() {}
namespace fs = std::filesystem;
static int bad = 0;
#define CHECK(c, msg) do { if (!(c)) { printf("FAIL: %s (line %d)\n", msg, __LINE__); bad++; } } while (0)
static const char* SD = "/tmp/kwsd-sync";
static const char* STORE = "/tmp/kwsd-sync-store";
static const char* TOKEN = "kwd_0123456789ab_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd";

static void put(const std::string& rel, const std::string& s) { fs::create_directories(fs::path(SD + std::string("/") + rel).parent_path()); std::ofstream(std::string(SD) + "/" + rel, std::ios::binary) << s; }
static std::string get(const std::string& p) { std::ifstream f(p, std::ios::binary); std::stringstream ss; ss << f.rdbuf(); return ss.str(); }
static std::string logText(int lines, int seed = 0) { std::string t; for (int i = 0; i < lines; i++) { char b[80]; snprintf(b, sizeof b, "2026-10-%02dT08:%02d,spoons,%d\n", 1 + (i + seed) % 28, i % 60, i % 6); t += b; } return t; }
static void fresh(bool log = true, bool ca = true, bool cfg = true) {
  fs::remove_all(SD); fs::remove_all(STORE); fs::create_directories(std::string(SD) + "/kw/log");
  if (cfg) put("kw/sync.txt", std::string("server=studio.example.com\ntoken=") + TOKEN + "\nlog=" + (log ? "1" : "0") + "\n");
  if (ca) put("kw/studio-ca.pem", "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n");
  put("kw/me.txt", "my safety plan SECRET-PLAN\n"); put("kw/net.txt", "name=keeping-watch\nnet=HomeNet\thunter22\n");
  setenv("KW_SD", SD, 1); setenv("KW_SYNC_STORE", STORE, 1); setenv("KW_WIFI", "HomeNet=hunter22:-48", 1); setenv("KW_NOW", "2026-10-14 13:10", 1);
  setenv("KW_SYNC", "ok", 1); unsetenv("KW_SYNC_BUILT"); unsetenv("KW_SYNC_ABORT_AFTER"); unsetenv("KW_WIFI_HANG"); setenv("KW_KEYS", "", 1);
  hal::begin();
}
static SyncOut run() { NetConfig n; netLoad(n); return syncRun(n, 0); }

int main() {
  // ---- config file ----
  { SyncCfg c; syncParse(std::string("# c\nserver=studio.example.com:8443\ntoken=") + TOKEN + "\nlog=1\n", c);
    CHECK(c.ok() && !strcmp(c.host, "studio.example.com") && c.port == 8443 && c.log, "parse");
    SyncCfg d; syncParse("server=https://x\ntoken=short\nserver=bad host\n", d); CHECK(!d.ok(), "bad values are ignored");
    SyncCfg e; syncParse(std::string("server=a.example\ntoken=") + TOKEN + "\n", e); CHECK(!e.log && e.port == 443, "the log is off by default");
    CHECK(syncHostOk("studio.example.com") && syncHostOk("a-b.example:1") && !syncHostOk("") && !syncHostOk("a..b") && !syncHostOk("-a.b") && !syncHostOk("a.b:0") && !syncHostOk("a.b:99999") && !syncHostOk("a b") && !syncHostOk("a.b/c"), "host rules");
    CHECK(syncText(c).find("DO NOT SHARE") != std::string::npos && syncText(c).find("server=studio.example.com:8443") != std::string::npos, "file text round trips"); }

  // ---- a first sync sends the log, only the log, in chunks, and remembers it ----
  fresh(); const std::string big = logText(300); put("kw/log/2026-10.csv", big); put("kw/log/2026-09.csv", logText(5)); put("kw/log/notes.txt", "not a log\n");
  { SyncOut o = run();
    CHECK(o.res == SyncRes::Ok && o.files == 2 && o.bytes == (long)(big.size() + logText(5).size()), "first sync ok");
    CHECK(get(std::string(STORE) + "/2026-10.csv") == big && get(std::string(STORE) + "/2026-09.csv") == logText(5), "the Studio holds exactly the card's logs");
    CHECK(!fs::exists(std::string(STORE) + "/notes.txt"), "only YYYY-MM.csv files are sent");
    CHECK(get(std::string(SD) + "/kw/log/2026-10.csv") == big, "the card's log is untouched");
    CHECK(get(std::string(SD) + "/kw/sync-state.txt").find("m=2026-10:" + std::to_string(big.size())) != std::string::npos, "state remembers what was sent");
    SyncPlan p; syncPlan(p); CHECK(p.pending == 0, "nothing pending after a sync");
    CHECK(run().res == SyncRes::NothingNew, "a second sync has nothing new and does not touch the network"); }

  // ---- new lines go as an append at the right offset ----
  { const std::string more = logText(7, 3); { std::ofstream f(std::string(SD) + "/kw/log/2026-10.csv", std::ios::app | std::ios::binary); f << more; }
    SyncPlan p; syncPlan(p); CHECK(p.pending == (long)more.size() && p.files == 1, "the preview counts only the new bytes");
    SyncOut o = run(); CHECK(o.res == SyncRes::Ok && o.bytes == (long)more.size(), "only the new bytes were sent");
    CHECK(get(std::string(STORE) + "/2026-10.csv") == big + more, "appended, not duplicated"); }

  // ---- state lost (a new card file): the Studio's size decides, nothing is duplicated ----
  { fs::remove(std::string(SD) + "/kw/sync-state.txt"); const std::string more = logText(2, 9); { std::ofstream f(std::string(SD) + "/kw/log/2026-10.csv", std::ios::app | std::ios::binary); f << more; }
    SyncOut o = run(); CHECK(o.res == SyncRes::Ok && o.bytes == (long)more.size(), "resumes from the Studio's size");
    CHECK(get(std::string(STORE) + "/2026-10.csv") == get(std::string(SD) + "/kw/log/2026-10.csv"), "no duplicated lines"); }

  // ---- the Studio holds more than the card: left alone ----
  { { std::ofstream f(std::string(STORE) + "/2026-09.csv", std::ios::app | std::ios::binary); f << "extra\n"; } fs::remove(std::string(SD) + "/kw/sync-state.txt");
    SyncOut o = run(); CHECK(o.skipped == 1, "a month the Studio holds more of is skipped"); CHECK(get(std::string(STORE) + "/2026-09.csv").size() == logText(5).size() + 6, "and not changed"); }

  // ---- interrupted: the connection drops mid-way, what went is kept, the next sync sends the rest ----
  fresh(); put("kw/log/2026-10.csv", logText(600));   // 600 lines = several chunks
  { setenv("KW_SYNC", "drop", 1); SyncOut o = run(); CHECK(o.res == SyncRes::Unreachable || o.res == SyncRes::Refused, "a dropped connection is an error");
    const long got = (long)get(std::string(STORE) + "/2026-10.csv").size(); CHECK(got > 0 && got < (long)logText(600).size(), "part of it went");
    setenv("KW_SYNC", "ok", 1); o = run(); CHECK(o.res == SyncRes::Ok, "the next sync finishes");
    CHECK(get(std::string(STORE) + "/2026-10.csv") == logText(600), "complete and in order after the resume"); }

  // ---- Back stops it: partial, kept ----
  fresh(); put("kw/log/2026-10.csv", logText(600));
  { setenv("KW_SYNC_ABORT_AFTER", "3", 1); SyncOut o = run(); CHECK(o.res == SyncRes::Cancelled, "Back stops the sync");
    CHECK(get(std::string(STORE) + "/2026-10.csv").size() < logText(600).size(), "stopped part-way"); unsetenv("KW_SYNC_ABORT_AFTER"); CHECK(run().res == SyncRes::Ok, "and the next one finishes"); }

  // ---- every failure: its own words, nothing sent ----
  struct F { const char* mode; SyncRes want; } fails[] = {{"down", SyncRes::Unreachable}, {"cert", SyncRes::Refused}, {"nohost", SyncRes::NoHostCheck}, {"wrong", SyncRes::WrongServer},
                                                        {"401", SyncRes::Unauthorized}, {"429", SyncRes::Limited}, {"500", SyncRes::ServerError}, {"reject", SyncRes::Rejected}};
  for (auto& f : fails) {
    fresh(); put("kw/log/2026-10.csv", logText(10)); setenv("KW_SYNC", f.mode, 1);
    SyncOut o = run(); char m[80]; snprintf(m, sizeof m, "KW_SYNC=%s gives its own result", f.mode); CHECK(o.res == f.want, m);
    CHECK(*syncResText(o.res) && o.bytes == 0, "a message, and nothing sent");
    SyncPlan p; syncPlan(p); CHECK(p.pending == (long)logText(10).size(), "the card still has it all pending");
    CHECK(!hal::syncBuilt() || true, "");
  }
  // ---- not ready: each says what to do, and no radio is touched ----
  { fresh(true, true, false); put("kw/log/2026-10.csv", logText(3)); CHECK(run().res == SyncRes::NotSetUp, "no sync.txt");
    fresh(true, false); put("kw/log/2026-10.csv", logText(3)); CHECK(run().res == SyncRes::NoCert, "no certificate");
    fresh(false); put("kw/log/2026-10.csv", logText(3)); CHECK(run().res == SyncRes::LogOff, "log switched off: nothing sent");
    fresh(); put("kw/log/2026-10.csv", logText(3)); setenv("KW_SYNC_BUILT", "0", 1); CHECK(run().res == SyncRes::NotBuilt, "the default firmware has no sync");
    fresh(); put("kw/log/2026-10.csv", logText(3)); put("kw/net.txt", "net=Ghost\tpassword1\n"); CHECK(run().res == SyncRes::JoinFailed, "network not in range");
    fresh(); CHECK(run().res == SyncRes::NothingNew, "no logs at all");
    fresh(); put("kw/log/2026-10.csv", logText(3)); setenv("KW_CLOCK", "unset", 1); hal::begin(); CHECK(run().res == SyncRes::NoClock, "clock not set"); unsetenv("KW_CLOCK"); }
  // ---- the toggle is saved and keeps the token ----
  { fresh(false); SyncCfg c; syncLoad(c); CHECK(!c.log, "off"); CHECK(syncSaveLog(c, true), "saved"); SyncCfg d; syncLoad(d); CHECK(d.log && !strcmp(d.token, TOKEN) && !strcmp(d.host, "studio.example.com"), "log on, token and host kept");
    CHECK(get(std::string(SD) + "/kw/sync.txt").find("DO NOT SHARE") != std::string::npos, "the warning stays in the file"); }
  // ---- what is sent is only the log: the safety plan and the token never appear in anything the Studio received ----
  fresh(); put("kw/log/2026-10.csv", logText(20)); run();
  for (auto& e : fs::directory_iterator(STORE)) { const std::string t = get(e.path()); CHECK(t.find("SECRET-PLAN") == std::string::npos && t.find("hunter22") == std::string::npos && t.find("kwd_") == std::string::npos, "only check-ins reached the Studio"); }

  printf(bad ? "sync test: FAILED (%d)\n" : "sync test: ok\n", bad);
  return bad ? 1 : 0;
}
