#pragma once
// Sync with the user's own Studio account (BUILD-PLAN section 19, slice N2). Portable: the config file, the plan, the upload loop and the
// messages live here so host/test_sync.sh runs the device's code against a simulated Studio.
//
// Rules this file keeps:
//  - Nothing here runs unless syncRun() is called, and the app calls it from exactly one place: Confirm on the preview screen.
//  - Only check-in log files (/kw/log/YYYY-MM.csv) are ever read for upload. Nothing else on the card is sent: not the safety plan,
//    the Wi-Fi file, the packs, the token or the library. The log is off by default (log=0 in /kw/sync.txt) because it is health data.
//  - /kw/sync.txt holds the device token (a secret) and is never uploaded, shown, logged or served by the page.
//  - The certificate in /kw/studio-ca.pem is the ONLY trust anchor; the host name must match it; without both, nothing is sent.
#include <stdint.h>
#include <string>
#include "../hal/hal.h"

static const char* const SYNC_PATH = "/kw/sync.txt";
static const char* const SYNC_CA_PATH = "/kw/studio-ca.pem";
static const char* const SYNC_STATE_PATH = "/kw/sync-state.txt";
static const int SYNC_HOST_MAX = 80, SYNC_TOKEN_MAX = 95, SYNC_MONTHS = 36, SYNC_CHUNK = 3072, SYNC_CA_MAX = 4096;

struct SyncCfg {
  char host[SYNC_HOST_MAX + 1] = "";
  uint16_t port = 443;
  char token[SYNC_TOKEN_MAX + 1] = "";
  bool log = false;            // upload the check-in log (and Focus counts, which live in it). Off until the user turns it on.
  bool ok() const { return host[0] && token[0]; }
};
bool syncHostOk(const char* s);                       // host name with optional :port, as the Studio's own check
void syncParse(const std::string& text, SyncCfg& c);  // tolerant: unknown lines and bad values are ignored
std::string syncText(const SyncCfg& c);               // the file, with its warning header
void syncLoad(SyncCfg& c);
bool syncSaveLog(SyncCfg& c, bool on);                // flips log=, keeps everything else; false if the card refuses

struct SyncMonth { char ym[8]; long size; long sent; };   // local size, and what the last good sync left on the Studio
struct SyncPlan { SyncMonth m[SYNC_MONTHS]; int n = 0; long pending = 0; int files = 0; time_t last = 0; };
void syncPlan(SyncPlan& p);                           // reads the card only (no network)

enum class SyncRes : uint8_t { Ok, NothingNew, NotBuilt, NotSetUp, NoCert, NoClock, LogOff, NoNetwork, JoinFailed, Unreachable, Refused, WrongServer,
                               NoHostCheck, Unauthorized, Limited, ServerError, Rejected, Card, Cancelled };
const char* syncResText(SyncRes r);                   // plain words, for the screen
struct SyncOut { SyncRes res = SyncRes::Ok; int files = 0; long bytes = 0; int skipped = 0; int net = -1; };
struct NetConfig;
// Joins the chosen saved network (index into NetConfig), talks to the Studio, uploads, leaves the radio off. Blocking; Back cancels.
SyncOut syncRun(const NetConfig& nets, int netIndex);
