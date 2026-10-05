// Host name check test (BUILD-PLAN N2), run on a PC by tls/hostcheck_test.sh with the X4's wolfSSL settings.
// It runs real TLS 1.3 handshakes in one process, with the client armed by net/hostcheck.cpp's own function (kw_use_sni is the body of the
// __wrap_wolfSSL_UseSNI the x4-tls firmware links in), against a server certificate issued by the pinned CA:
//   - the right host name: the handshake completes
//   - another host name, same CA, same certificate: the handshake FAILS (this is what the SDK's SecureClient alone would accept)
//   - a session whose check could not be armed (a NULL host): the handshake FAILS and kwHostCheckFails() counts it
#include <stdio.h>
#include <string.h>
#include <wolfssl/ssl.h>
#include <wolfssl/certs_test.h>

int kw_use_sni(WOLFSSL*, unsigned char, const void*, unsigned short);
unsigned kwHostChecks(void); unsigned kwHostCheckFails(void);

typedef struct { unsigned char b[40000]; int r, w; } Pipe;
static Pipe pipes[2];
static int ioRecv(WOLFSSL* ssl, char* buf, int sz, void* ctx) { (void)ssl; Pipe* p = ctx; int have = p->w - p->r; if (have <= 0) return WOLFSSL_CBIO_ERR_WANT_READ; if (sz > have) sz = have; memcpy(buf, p->b + p->r, sz); p->r += sz; if (p->r == p->w) p->r = p->w = 0; return sz; }
static int ioSend(WOLFSSL* ssl, char* buf, int sz, void* ctx) { (void)ssl; Pipe* p = ctx; if (p->w + sz > (int)sizeof p->b) return WOLFSSL_CBIO_ERR_WANT_WRITE; memcpy(p->b + p->w, buf, sz); p->w += sz; return sz; }

// returns 1 if the client handshake completed, 0 if it failed
static int handshake(const char* host, int hostLen) {
  memset(pipes, 0, sizeof pipes);
  WOLFSSL_CTX* sctx = wolfSSL_CTX_new(wolfTLSv1_3_server_method());
  wolfSSL_CTX_use_certificate_buffer(sctx, serv_ecc_der_256, sizeof_serv_ecc_der_256, WOLFSSL_FILETYPE_ASN1);
  wolfSSL_CTX_use_PrivateKey_buffer(sctx, ecc_key_der_256, sizeof_ecc_key_der_256, WOLFSSL_FILETYPE_ASN1);
  wolfSSL_SetIORecv(sctx, ioRecv); wolfSSL_SetIOSend(sctx, ioSend);
  WOLFSSL* s = wolfSSL_new(sctx); wolfSSL_SetIOReadCtx(s, &pipes[0]); wolfSSL_SetIOWriteCtx(s, &pipes[1]);
  WOLFSSL_CTX* ctx = wolfSSL_CTX_new(wolfSSLv23_client_method());
  if (wolfSSL_CTX_load_verify_buffer(ctx, ca_ecc_cert_der_256, sizeof_ca_ecc_cert_der_256, WOLFSSL_FILETYPE_ASN1) != WOLFSSL_SUCCESS) { puts("CA load failed"); return -1; }
  wolfSSL_SetIORecv(ctx, ioRecv); wolfSSL_SetIOSend(ctx, ioSend);
  WOLFSSL* c = wolfSSL_new(ctx); wolfSSL_SetIOReadCtx(c, &pipes[1]); wolfSSL_SetIOWriteCtx(c, &pipes[0]);
  kw_use_sni(c, WOLFSSL_SNI_HOST_NAME, host, (unsigned short)hostLen);   // what SecureClient does, through the wrapper
  int cok = 0, sok = 0, cerr = 0;
  for (int i = 0; i < 200 && !(cok && sok) && !cerr; i++) {
    if (!cok) { int r = wolfSSL_connect(c); if (r == WOLFSSL_SUCCESS) cok = 1; else { int e = wolfSSL_get_error(c, r); if (e != WOLFSSL_ERROR_WANT_READ && e != WOLFSSL_ERROR_WANT_WRITE) cerr = e; } }
    if (!sok) { int r = wolfSSL_accept(s); if (r == WOLFSSL_SUCCESS) sok = 1; }
  }
  wolfSSL_free(c); wolfSSL_CTX_free(ctx); wolfSSL_free(s); wolfSSL_CTX_free(sctx);
  return cok && !cerr;
}

int main(void) {
  wolfSSL_Init();
  int bad = 0;
  // the test CA's server certificate: find which names it is good for by trying the names in it
  const char* good = "www.wolfssl.com";
  const unsigned c0 = kwHostChecks();
  int r1 = handshake(good, (int)strlen(good));
  printf("right host name (%s): %s\n", good, r1 == 1 ? "handshake completed" : "handshake FAILED");
  int r2 = handshake("evil.example.net", 16);
  printf("other host name (evil.example.net), same CA and certificate: %s\n", r2 == 0 ? "refused" : "ACCEPTED");
  const unsigned f0 = kwHostCheckFails();
  int r3 = handshake(NULL, 0);
  printf("check that cannot be armed (no host): %s, counted %u\n", r3 == 0 ? "refused" : "ACCEPTED", kwHostCheckFails() - f0);
  if (r1 != 1) bad = 1;
  if (r2 != 0) bad = 1;
  if (r3 != 0 || kwHostCheckFails() - f0 != 1) bad = 1;
  if (kwHostChecks() - c0 < 2) bad = 1;
  puts(bad ? "hostcheck test: FAILED" : "hostcheck test: ok");
  wolfSSL_Cleanup();
  return bad;
}
