// A phone on the X4's page, for the preview and the network test (host build only). It calls the same NetCtl entry points the
// device's web routes call, as a client on the hotspot (no PIN needed there).
// Keys: phone-join uses KW_PHONE_SSID / KW_PHONE_PASS; phone-ping is any request (it counts as activity for the idle sleep); phone-badpin is a wrong PIN from the LAN.
#include <cstdlib>
#include <cstring>
#include "../src/core/net.h"

void hostPhone(const char* what) {
  if (!strcmp(what, "join")) {
    const char* s = getenv("KW_PHONE_SSID"); const char* p = getenv("KW_PHONE_PASS");
    NC.join(false, 0x0a000002u, nullptr, s ? s : "", p ? p : "");
  } else if (!strcmp(what, "badpin")) {   // a device on the LAN typing a wrong PIN
    NC.unlock(true, 0xc0a80107u, "000000");
  } else if (!strcmp(what, "ping")) {
    NC.info(false, 0x0a000002u, nullptr);
  }
}
