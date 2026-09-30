#!/bin/sh
# Builds wolfSSL with the X4's settings (tls/user_settings.h) on this PC and runs tls/heap_probe.c.
# Needs the wolfSSL library that `pio run -e x4-tls` installs (x4/.pio/libdeps/x4-tls/wolfssl), or WOLFSSL_SRC=<dir with wolfssl/ and wolfcrypt/>.
set -e
cd "$(dirname "$0")"
W=${WOLFSSL_SRC:-../.pio/libdeps/x4-tls/wolfssl/src}
[ -d "$W/wolfssl" ] || { echo "wolfSSL not found at $W: run 'pio run -e x4-tls' first"; exit 2; }
B=${TMPDIR:-/tmp}/kw-heap-probe; mkdir -p $B
F="-O1 -w -DWOLFSSL_USER_SETTINGS -DKW_HOST_PROBE -DNO_ASN_TIME -DUSE_CERT_BUFFERS_256 -DUSE_CERT_BUFFERS_2048 -iquote . -I$W"
OBJS=""
for f in $W/src/*.c $W/wolfcrypt/src/*.c; do
  case $(basename $f) in sniffer.c|quic.c|dtls.c|dtls13.c|conf.c|bio.c|crl.c|ocsp.c|ssl_bn.c|ssl_asn1.c|ssl_p7p12.c|x509.c|x509_str.c|evp.c|ext_*|fips*|selftest.c|async.c|cryptocb.c|ecc_fp.c|eccsi.c|sakke.c|dilithium.c|falcon.c|sm*.c|fe_448.c|ge_448.c|curve448.c|ed448.c|ed25519.c|md2.c|md4.c|ripemd.c|camellia.c|arc4.c|rc2.c|des3.c|blake2*.c|cmac.c|pkcs*.c|hpke.c|siphash.c|dsa.c|dh.c|coding.c.bak|compress.c|asm.c|cpuid.c|kdf.c.bak) continue ;; esac
  o=$B/$(basename $f .c).o
  if [ ! -f $o ] || [ $f -nt $o ] || [ user_settings.h -nt $o ]; then gcc $F -c $f -o $o; fi
  OBJS="$OBJS $o"
done
gcc $F -c heap_probe.c -o $B/heap_probe.o
gcc -o $B/heap_probe $B/heap_probe.o $OBJS -lm
$B/heap_probe
