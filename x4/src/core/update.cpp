// Card update. The export (tools/export_pack.py) writes /kw-update, never /kw. She copies that one folder
// onto the card; on boot we move the files inside into /kw and remove /kw-update. So a copy, a "Replace" of
// the folder, or a partial copy can never delete or overwrite what only the X4 holds:
//   /kw/log/   her check-ins       (never listed, never touched)
//   /kw/me.txt her safety plan     (replaced by nothing; a me.txt in the update is used only if there is none yet)
// Only these names are taken: YYYY-MM.txt, support.txt, checkins.txt, and library/*.pdf|*.epub. Anything else
// in /kw-update (me.example.txt, .DS_Store, stray files) is deleted with the folder. A file that fails to move
// stays put, so the next boot tries again.
#include "update.h"
#include <stdio.h>
#include <string.h>
#include "../hal/hal.h"

namespace kwupdate {
static constexpr int NAME = 48, MAXN = 64;
static char names[MAXN][NAME];  // static: the loop stack is 16 KB

bool packName(const char* n) {
  if (strlen(n) != 11 || strcmp(n + 7, ".txt") != 0 || n[4] != '-') return false;
  for (int i : {0, 1, 2, 3, 5, 6}) if (n[i] < '0' || n[i] > '9') return false;
  return true;
}
static bool endsWith(const char* n, const char* e) { const size_t a = strlen(n), b = strlen(e); return a > b && strcmp(n + a - b, e) == 0; }

static int moveAll(const char* from, const char* to, bool library) {
  int moved = 0;
  for (int pass = 0; pass < 6; pass++) {  // a full list means there may be more; try again
    const int n = hal::listFiles(from, names, MAXN);
    if (n == 0) break;
    int handled = 0;
    for (int i = 0; i < n; i++) {
      char src[96], dst[96];
      snprintf(src, sizeof src, "%s/%s", from, names[i]);
      snprintf(dst, sizeof dst, "%s/%s", to, names[i]);
      const char* nm = names[i];
      bool take = library ? (endsWith(nm, ".pdf") || endsWith(nm, ".epub")) && nm[0] != '.'
                          : packName(nm) || !strcmp(nm, "support.txt") || !strcmp(nm, "checkins.txt") || (!strcmp(nm, "me.txt") && !hal::exists("/kw/me.txt"));
      if (!take) { if (hal::removeFile(src)) handled++; continue; }  // never adopted: me.txt over an existing plan, junk
      hal::removeFile(dst);  // the new pack replaces the old one (dst is never me.txt over an existing plan, see above)
      if (hal::renameFile(src, dst)) { moved++; handled++; }
    }
    if (handled == 0 || n < MAXN) break;
  }
  return moved;
}

int apply() {
  if (!hal::exists("/kw-update")) return 0;
  hal::makeDir("/kw"); hal::makeDir("/kw/library");
  int moved = moveAll("/kw-update", "/kw", false);
  if (hal::exists("/kw-update/library")) { moved += moveAll("/kw-update/library", "/kw/library", true); hal::removeEmptyDir("/kw-update/library"); }
  hal::removeEmptyDir("/kw-update");  // refuses if anything is left, so a failed move is retried next boot
  return moved;
}
}  // namespace kwupdate
