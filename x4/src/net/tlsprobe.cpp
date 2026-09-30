// TLS probe: only built in env x4-tls. It links the SDK's SecureClient (and so wolfSSL) so the RAM and
// flash numbers CI prints are real. The shipped firmware (env x4) makes no TLS call in N1.
#if defined(ARDUINO) && defined(FREEINK_NET_WOLFSSL)
#include <Arduino.h>
#include <esp_random.h>
#include <SecureClient.h>
extern "C" int kw_rand_seed(unsigned char* out, unsigned int sz) { esp_fill_random(out, sz); return 0; }
bool kwTlsProbe() {
  static freeink::SecureClient c;
  return freeink::SecureClient::tls13Available() && c.connected() == 0;
}
#endif
