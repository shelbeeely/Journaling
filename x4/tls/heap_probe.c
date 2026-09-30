// Heap probe for the X4's TLS settings (tls/user_settings.h), run on a PC in CI (tls/heap_probe.sh).
// It runs a real TLS 1.3 handshake between a client and a server that live in this one process, over in-memory
// pipes, and counts every byte wolfSSL allocates for the CLIENT side (the X4 is the client). The counting
// allocator tags each block with the side that asked for it, so the server half is not billed to the client.
//
// What it measures: wolfSSL's own heap (context, CA parse, session, handshake temporaries, record buffers), the
// part of a sync session that lives on the heap. What it does not: lwIP/TCP buffers and the Wi-Fi stack (see
// tls/budget.py, which adds them from documented constants). A PC is 64-bit, so pointer-heavy structs read a
// little larger than they will on the RISC-V: treat the numbers as slightly high.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wolfssl/ssl.h>
#include <wolfssl/certs_test.h>

enum { CLIENT = 0, SERVER = 1, OTHER = 2 };
static int side = OTHER;
static size_t cur[3], peak[3], total[3];
typedef struct { size_t sz; int side; } Hdr;   // 16 bytes so the payload stays aligned

static void note(int s, long d) { cur[s] += d; total[s] += d > 0 ? d : 0; if (cur[s] > peak[s]) peak[s] = cur[s]; }
static void* cmalloc(size_t n) { Hdr* h = malloc(sizeof(Hdr) + 0 + n + 16); if (!h) return 0; h->sz = n; h->side = side; note(side, (long)n); return (char*)h + 16; }
static void cfree(void* p) { if (!p) return; Hdr* h = (Hdr*)((char*)p - 16); note(h->side, -(long)h->sz); free(h); }
static void* crealloc(void* p, size_t n) {
  if (!p) return cmalloc(n);
  Hdr* h = (Hdr*)((char*)p - 16); void* q = cmalloc(n); if (!q) return 0;
  memcpy(q, p, h->sz < n ? h->sz : n); cfree(p); return q;
}

// in-memory pipes: pipe[0] carries client->server, pipe[1] server->client
typedef struct { unsigned char b[40000]; int r, w; } Pipe;
static Pipe pipes[2];
static int ioRecv(WOLFSSL* ssl, char* buf, int sz, void* ctx) {
  (void)ssl; Pipe* p = ctx; int have = p->w - p->r;
  if (have <= 0) return WOLFSSL_CBIO_ERR_WANT_READ;
  if (sz > have) sz = have;
  memcpy(buf, p->b + p->r, sz); p->r += sz; if (p->r == p->w) p->r = p->w = 0; return sz;
}
static int ioSend(WOLFSSL* ssl, char* buf, int sz, void* ctx) {
  (void)ssl; Pipe* p = ctx; if (p->w + sz > (int)sizeof p->b) return WOLFSSL_CBIO_ERR_WANT_WRITE;
  memcpy(p->b + p->w, buf, sz); p->w += sz; return sz;
}

static int scenario(const char* name, int mfl, const unsigned char* ca, int caLen, const unsigned char* cert, int certLen,
                    const unsigned char* key, int keyLen, int chainLen) {
  memset(cur, 0, sizeof cur); memset(peak, 0, sizeof peak); memset(total, 0, sizeof total);
  memset(pipes, 0, sizeof pipes);
  (void)chainLen;
  side = SERVER;
  WOLFSSL_CTX* sctx = wolfSSL_CTX_new(wolfTLSv1_3_server_method());
  wolfSSL_CTX_use_certificate_buffer(sctx, cert, certLen, WOLFSSL_FILETYPE_ASN1);
  wolfSSL_CTX_use_PrivateKey_buffer(sctx, key, keyLen, WOLFSSL_FILETYPE_ASN1);
  wolfSSL_SetIORecv(sctx, ioRecv); wolfSSL_SetIOSend(sctx, ioSend);
  if (mfl) wolfSSL_CTX_UseMaxFragment(sctx, WOLFSSL_MFL_2_11);
  WOLFSSL* s = wolfSSL_new(sctx);
  wolfSSL_SetIOReadCtx(s, &pipes[0]); wolfSSL_SetIOWriteCtx(s, &pipes[1]);
  wolfSSL_UseKeyShare(s, WOLFSSL_ECC_X25519);

  // --- the client, in the order SecureClient does it ---
  side = CLIENT;
  const size_t c0 = cur[CLIENT];
  WOLFSSL_CTX* ctx = wolfSSL_CTX_new(wolfSSLv23_client_method());
  { int lr = wolfSSL_CTX_load_verify_buffer(ctx, ca, caLen, WOLFSSL_FILETYPE_ASN1); if (lr != WOLFSSL_SUCCESS) printf("CA load failed %d\n", lr); }   // the pinned CA (PEM on the card in the product)
  wolfSSL_SetIORecv(ctx, ioRecv); wolfSSL_SetIOSend(ctx, ioSend);
  const size_t afterCtx = cur[CLIENT] - c0;
  WOLFSSL* c = wolfSSL_new(ctx);
  wolfSSL_SetIOReadCtx(c, &pipes[1]); wolfSSL_SetIOWriteCtx(c, &pipes[0]);
  wolfSSL_UseSNI(c, WOLFSSL_SNI_HOST_NAME, "studio.example", 14);
  wolfSSL_UseKeyShare(c, WOLFSSL_ECC_X25519);
  if (mfl) wolfSSL_UseMaxFragment(c, WOLFSSL_MFL_2_11);
  const size_t afterSsl = cur[CLIENT] - c0;

  int done = 0, cok = 0, sok = 0;
  for (int i = 0; i < 400 && !(cok && sok); i++) {
    side = CLIENT; if (!cok) { int r = wolfSSL_connect(c); if (r == WOLFSSL_SUCCESS) cok = 1; else { int e = wolfSSL_get_error(c, r); if (e != WOLFSSL_ERROR_WANT_READ && e != WOLFSSL_ERROR_WANT_WRITE) { printf("client error %d\n", e); return 1; } } }
    side = SERVER; if (!sok) { int r = wolfSSL_accept(s); if (r == WOLFSSL_SUCCESS) sok = 1; else { int e = wolfSSL_get_error(s, r); if (e != WOLFSSL_ERROR_WANT_READ && e != WOLFSSL_ERROR_WANT_WRITE) { printf("server error %d\n", e); return 1; } } }
  }
  if (!(cok && sok)) { printf("handshake did not finish\n"); return 1; }
  const size_t afterHs = cur[CLIENT] - c0, peakHs = peak[CLIENT] - c0;
  // a request out and a 6 KB answer back (the sync's biggest reply is a few KB of JSON)
  static unsigned char msg[6000], rd[6000];
  side = CLIENT; wolfSSL_write(c, "GET /v1/x4 HTTP/1.1\r\n\r\n", 24);
  side = SERVER; { char t[64]; wolfSSL_read(s, t, sizeof t); memset(msg, 'a', sizeof msg); int off = 0; while (off < (int)sizeof msg) { int n = wolfSSL_write(s, msg + off, sizeof msg - off); if (n <= 0) break; off += n; } }
  side = CLIENT; { int got = 0, n; while (got < (int)sizeof rd && (n = wolfSSL_read(c, rd + got, sizeof rd - got)) > 0) got += n; if (got != (int)sizeof msg) { printf("read %d of %d\n", got, (int)sizeof msg); return 1; } }
  const size_t peakAll = peak[CLIENT] - c0;
  const int inCtx = (int)afterCtx, inSsl = (int)(afterSsl - afterCtx);
  side = CLIENT; wolfSSL_free(c); wolfSSL_CTX_free(ctx);
  side = SERVER; wolfSSL_free(s); wolfSSL_CTX_free(sctx);
  side = OTHER;
  printf("%-28s ctx+CA %6d  session %6d  after handshake %6zu  peak (handshake) %6zu  peak (with 6 KB reply) %6zu  leaked %zu\n",
         name, inCtx, inSsl, afterHs, peakHs, peakAll, cur[CLIENT] + cur[SERVER]);
  done = 1; (void)done;
  return 0;
}

int main(void) {
  wolfSSL_SetAllocators(cmalloc, cfree, crealloc);
  wolfSSL_Init();
  puts("wolfSSL client heap, bytes (this PC is 64-bit: the X4's 32-bit RISC-V reads a little lower)");
  int bad = 0;
  bad |= scenario("ECDSA P-256, 2 KB records", 1, ca_ecc_cert_der_256, sizeof_ca_ecc_cert_der_256, serv_ecc_der_256, sizeof_serv_ecc_der_256, ecc_key_der_256, sizeof_ecc_key_der_256, 0);
  bad |= scenario("ECDSA P-256, 16 KB records", 0, ca_ecc_cert_der_256, sizeof_ca_ecc_cert_der_256, serv_ecc_der_256, sizeof_serv_ecc_der_256, ecc_key_der_256, sizeof_ecc_key_der_256, 0);
  bad |= scenario("RSA-2048, 2 KB records", 1, ca_cert_der_2048, sizeof_ca_cert_der_2048, server_cert_der_2048, sizeof_server_cert_der_2048, server_key_der_2048, sizeof_server_key_der_2048, 0);
  bad |= scenario("RSA-2048, 16 KB records", 0, ca_cert_der_2048, sizeof_ca_cert_der_2048, server_cert_der_2048, sizeof_server_cert_der_2048, server_key_der_2048, sizeof_server_key_der_2048, 0);
  wolfSSL_Cleanup();
  return bad;
}
