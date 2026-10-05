// Host name check for the SDK's TLS client (BUILD-PLAN N2).
//
// The FreeInk SDK's SecureClient verifies the certificate chain against the CA it is given but never asks wolfSSL to check that the
// certificate is FOR the host we connected to. So any certificate issued by the pinned CA, for any name, would be accepted. We do not edit
// the pinned SDK: the x4-tls build links with -Wl,--wrap=wolfSSL_UseSNI, and SecureClient calls wolfSSL_UseSNI(ssl, host) once per
// handshake right before connecting, so this wrapper sees the host and arms wolfSSL_check_domain_name(ssl, host) on the same session.
// If it cannot be armed, the session is made to fail (a verify callback that rejects everything) and the failure is counted, so a token
// is never sent over a session without the check. hal_x4.cpp also refuses to continue unless the counter moved (syncOpen), which catches
// a build that forgot the link flag. tls/hostcheck_test.sh runs this exact function on a PC against real certificates.
#if (defined(ARDUINO) && defined(FREEINK_NET_WOLFSSL)) || defined(KW_HOSTCHECK_TEST)
#include <wolfssl/ssl.h>
#include <string.h>

static unsigned g_checks = 0, g_fails = 0;
static int denyAll(int, WOLFSSL_X509_STORE_CTX*) { return 0; }
extern "C" unsigned kwHostChecks() { return g_checks; }
extern "C" unsigned kwHostCheckFails() { return g_fails; }

#ifdef KW_HOSTCHECK_TEST
#define REAL_USESNI wolfSSL_UseSNI
extern "C" int kw_use_sni(WOLFSSL* ssl, unsigned char type, const void* data, unsigned short size)
#else
extern "C" int __real_wolfSSL_UseSNI(WOLFSSL* ssl, unsigned char type, const void* data, unsigned short size);
#define REAL_USESNI __real_wolfSSL_UseSNI
extern "C" int __wrap_wolfSSL_UseSNI(WOLFSSL* ssl, unsigned char type, const void* data, unsigned short size)
#endif
{
  const int r = REAL_USESNI(ssl, type, data, size);
  char host[256];
  if (type == WOLFSSL_SNI_HOST_NAME && data && size > 0 && size < sizeof host) {
    memcpy(host, data, size); host[size] = 0;
    if (wolfSSL_check_domain_name(ssl, host) == WOLFSSL_SUCCESS) { g_checks++; return r; }
  }
  g_fails++;
  wolfSSL_set_verify(ssl, WOLFSSL_VERIFY_PEER, denyAll);   // could not arm the check: this session must not complete
  return r;
}
#endif
