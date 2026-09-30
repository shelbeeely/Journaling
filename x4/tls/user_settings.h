#pragma once
// wolfSSL settings for the optional TLS build (env x4-tls; BUILD-PLAN section 19, sync slice N2).
// Client only, TLS 1.3 (falls back to 1.2), the smallest set that verifies a Let's Encrypt style chain
// (RSA and P-256/P-384 signatures, SHA-256/384) and negotiates X25519 or P-256 with AES-GCM.
// The SDK's SecureClient pins the key share to X25519 and asks for 2 KB records (max fragment length),
// so the two things that make TLS big on a chip with no PSRAM are already turned down.
// tls/host_probe.sh builds the same settings on a PC (KW_HOST_PROBE adds the server half) to count heap.
#define WOLFSSL_USER_SETTINGS_ID "keeping-watch-x4"
// Built as an Arduino project (not ESP-IDF), so wolfSSL takes its Arduino path and we supply the entropy:
// the ESP32's hardware RNG (esp_fill_random; it is true random while the radio is on, which it always is when TLS runs).
#ifndef KW_HOST_PROBE
  #undef WOLFSSL_ESPIDF            // PlatformIO sets it for any ESP32; it clashes with ARDUINO (settings.h #error)
  #ifdef __cplusplus
  extern "C" {
  #endif
  int kw_rand_seed(unsigned char* out, unsigned int sz);
  #ifdef __cplusplus
  }
  #endif
  #define CUSTOM_RAND_GENERATE_SEED kw_rand_seed
#endif
#define SINGLE_THREADED
#define NO_FILESYSTEM
#define NO_WRITEV
#ifndef KW_HOST_PROBE
  #define NO_DEV_RANDOM            // (the PC probe reads /dev/urandom)
#endif
#define WOLFSSL_USER_IO            // the SDK supplies send/recv over WiFiClient
#define WOLFSSL_IGNORE_FILE_WARN
#define WOLFSSL_SMALL_STACK        // big temporaries go on the heap: nothing large on the 16 KB loop stack
#ifndef KW_HOST_PROBE
  #define NO_WOLFSSL_SERVER
#endif
#define NO_SESSION_CACHE
#define NO_OLD_TLS
#define WOLFSSL_TLS13
#define HAVE_TLS_EXTENSIONS
#define HAVE_SNI
#define HAVE_SUPPORTED_CURVES
#define HAVE_MAX_FRAGMENT
#define HAVE_EXTENDED_MASTER
#define HAVE_ENCRYPT_THEN_MAC
#define HAVE_HKDF
#define HAVE_AEAD
#define HAVE_AESGCM
#define GCM_TABLE_4BIT             // small AES-GCM tables
#define WC_RSA_PSS
#define WC_RSA_BLINDING
#define HAVE_ECC
#define ECC_TIMING_RESISTANT
#define HAVE_ECC384
#define HAVE_CURVE25519
#define CURVE25519_SMALL
#define WOLFSSL_SHA384
#define WOLFSSL_SHA512
#define WOLFSSL_SP_MATH_ALL          // sizes big numbers to the key, not to a worst case (fast math costs 1 KB+ per temporary at 8192 bits)
#define WOLFSSL_SP_SMALL
#define WOLFSSL_ASN_TEMPLATE
#define NO_DSA
#define NO_DH
#define NO_DES3
#define NO_RC4
#define NO_MD4
#define NO_MD5
#define NO_SHA                     // SHA-1 signatures are refused
#define NO_PSK
#define NO_PWDBASED
#define NO_ERROR_STRINGS
#define NO_MAIN_DRIVER
