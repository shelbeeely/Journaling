#pragma once
#include <stdint.h>
#include "font.h"

// 1-bit drawing surface. The X4 panel is 800x480 in landscape; the device is held upright, so the
// app draws on a 480x800 portrait canvas and every pixel is rotated into the panel's framebuffer
// (same mapping as CrossPoint's Portrait: phyX = y, phyY = 479 - x). Bit set = white, clear = black.
class Canvas {
 public:
  static constexpr int PANEL_W = 800, PANEL_H = 480;
  static constexpr int W = 480, H = 800;  // logical portrait size
  static constexpr int BYTES = PANEL_W * PANEL_H / 8;

  explicit Canvas(uint8_t* fb) : fb_(fb) {}
  // Bold / high-contrast mode (Settings): text and icons are struck twice one pixel apart, and every hairline, frame,
  // ring and dotted rule is at least 2 px, so no content is drawn in a thin stroke.
  void setBold(bool b) { bold_ = b; }
  bool bold() const { return bold_; }
  uint8_t* buffer() { return fb_; }

  void clear(bool black = false);
  void pixel(int x, int y, bool black = true);
  bool get(int x, int y) const;
  void hline(int x, int y, int w, bool black = true);
  void vline(int x, int y, int h, bool black = true);
  void rect(int x, int y, int w, int h, int t = 1, bool black = true);
  void fill(int x, int y, int w, int h, bool black = true);
  void roundRect(int x, int y, int w, int h, int r, int t = 1);
  void fillRound(int x, int y, int w, int h, int r, bool black = true);
  void line(int x0, int y0, int x1, int y1, int t = 1);
  void dotted(int x, int y, int w, int gap = 4);
  void circle(int cx, int cy, int r, int t = 1);
  void fillCircle(int cx, int cy, int r, bool black = true);
  void bitmap(const uint8_t* bits, int x, int y, int w, int h, bool black = true);
  void icon(int id, int x, int y, int px = 24, bool black = true);
  // Moon at phase angle (0 new, 90 first quarter, 180 full, 270 last quarter); lit side white, dark side black.
  void moon(int cx, int cy, int r, float phaseDeg);
  void checkbox(int x, int y, int s, bool on);
  void bubbles(int x, int y, int n, int value, int r = 9, int gap = 8);  // value -1 = none selected

  // Text. UTF-8; code points missing from `f` fall back to `sym` (astro glyphs). Returns end x.
  int text(const Font& f, int x, int baseline, const char* s, bool black = true, const Font* sym = nullptr);
  int width(const Font& f, const char* s, const Font* sym = nullptr) const;
  void textRight(const Font& f, int right, int baseline, const char* s, const Font* sym = nullptr);
  void textCenter(const Font& f, int cx, int baseline, const char* s, const Font* sym = nullptr);
  // Word-wrap into a box. Returns the baseline after the last line; stops at maxLines (adds "…").
  int wrap(const Font& f, int x, int baseline, int w, const char* s, int maxLines = 99, int lineGap = 0,
           const Font* sym = nullptr);

  // Invert a region (used for the selected row highlight).
  void invert(int x, int y, int w, int h);

 private:
  uint8_t* fb_;
  bool bold_ = false;
  void row(int x, int y, int w, bool black);  // raw one-pixel row, never thickened
  int arrow(const Font& f, int dir, int x, int baseline, bool black);  // U+2190 / U+2192 drawn as a shape (Inter has neither)
  static const Glyph* find(const Font& f, uint32_t cp);
  int glyph(const Font& f, const Glyph* g, int x, int baseline, bool black);
};

uint32_t utf8Next(const char*& s);
