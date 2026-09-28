#pragma once
#include <stdint.h>

// 1-bit bitmap font produced by tools/gen_assets.py. Glyph rows are MSB-first, (w+7)/8 bytes each.
struct Glyph {
  uint32_t cp;      // Unicode code point
  uint32_t offset;  // into bits[]
  uint8_t w, h;     // bitmap size
  uint8_t adv;      // horizontal advance
  int8_t xo, yo;    // bitmap offset from the pen position; yo is relative to the baseline
};
struct Font {
  const uint8_t* bits;
  const Glyph* glyphs;
  uint16_t count;
  uint8_t ascent, descent, lineHeight;
};
