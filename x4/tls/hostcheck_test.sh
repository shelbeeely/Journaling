#!/bin/sh
# Proves the host name check (net/hostcheck.cpp) on a PC with the X4's wolfSSL settings (tls/user_settings.h): see hostcheck_test.c.
# Needs the wolfSSL library that `pio run -e x4-tls` installs, or WOLFSSL_SRC=<dir with wolfssl/ and wolfcrypt/>.
set -e
cd "$(dirname "$0")"
W=${WOLFSSL_SRC:-../.pio/libdeps/x4-tls/wolfssl/src}
[ -d "$W/wolfssl" ] || { echo "wolfSSL not found at $W: run 'pio run -e x4-tls' first"; exit 2; }
B=${TMPDIR:-/tmp}/kw-hostcheck; mkdir -p $B
F="-O1 -w -DWOLFSSL_USER_SETTINGS -DKW_HOST_PROBE -DNO_ASN_TIME -DUSE_CERT_BUFFERS_256 -DUSE_CERT_BUFFERS_2048 -DOPENSSL_EXTRA -iquote . -I$W"
OBJS=""
for f in $W/src/*.c $W/wolfcrypt/src/*.c; do
  case $(basename $f) in sniffer.c|quic.c|dtls.c|dtls13.c|conf.c|bio.c|crl.c|ocsp.c|ssl_bn.c|ssl_asn1.c|ssl_p7p12.c|x509_str.c|evp.c|ext_*|fips*|selftest.c|async.c|cryptocb.c|ecc_fp.c|eccsi.c|sakke.c|dilithium.c|falcon.c|sm*.c|fe_448.c|ge_448.c|curve448.c|ed448.c|ed25519.c|md2.c|md4.c|ripemd.c|camellia.c|arc4.c|rc2.c|des3.c|blake2*.c|cmac.c|pkcs*.c|hpke.c|siphash.c|dsa.c|dh.c|compress.c|asm.c|cpuid.c) continue ;; esac
  o=$B/$(basename $f .c).o
  if [ ! -f $o ] || [ $f -nt $o ] || [ user_settings.h -nt $o ]; then gcc $F -c $f -o $o; fi
  OBJS="$OBJS $o"
done
g++ $F -DKW_HOSTCHECK_TEST -x c++ -c ../src/net/hostcheck.cpp -o $B/hostcheck.o
gcc $F -c hostcheck_test.c -o $B/hostcheck_test.o
g++ -o $B/hostcheck_test $B/hostcheck_test.o $B/hostcheck.o $OBJS -lm
$B/hostcheck_test
