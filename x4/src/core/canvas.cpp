#include "canvas.h"
#include <string.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include "../gen/assets.h"

uint32_t utf8Next(const char*& s) {
  const unsigned char c = (unsigned char)*s;
  if (!c) return 0;
  if (c < 0x80) { s++; return c; }
  int n = (c >= 0xF0) ? 3 : (c >= 0xE0) ? 2 : (c >= 0xC0) ? 1 : 0;
  uint32_t cp = c & (0x3F >> n);
  s++;
  while (n-- > 0 && (*s & 0xC0) == 0x80) cp = (cp << 6) | (*s++ & 0x3F);
  return cp;
}

void Canvas::clear(bool black) { memset(fb_, black ? 0x00 : 0xFF, BYTES); }

void Canvas::pixel(int x, int y, bool black) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const int px = y, py = PANEL_H - 1 - x;
  const uint32_t i = py * (PANEL_W / 8) + (px >> 3);
  const uint8_t bit = 0x80 >> (px & 7);
  if (black) fb_[i] &= ~bit; else fb_[i] |= bit;
}

bool Canvas::get(int x, int y) const {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const int px = y, py = PANEL_H - 1 - x;
  return !(fb_[py * (PANEL_W / 8) + (px >> 3)] & (0x80 >> (px & 7)));
}

void Canvas::row(int x, int y, int w, bool b) { for (int i = 0; i < w; i++) pixel(x + i, y, b); }
void Canvas::hline(int x, int y, int w, bool b) { row(x, y, w, b); if (bold_) row(x, y + 1, w, b); }
void Canvas::vline(int x, int y, int h, bool b) { for (int i = 0; i < h; i++) { pixel(x, y + i, b); if (bold_) pixel(x + 1, y + i, b); } }
void Canvas::fill(int x, int y, int w, int h, bool b) { for (int j = 0; j < h; j++) row(x, y + j, w, b); }
void Canvas::rect(int x, int y, int w, int h, int t, bool b) {
  if (bold_ && t < 2) t = 2;
  fill(x, y, w, t, b); fill(x, y + h - t, w, t, b); fill(x, y, t, h, b); fill(x + w - t, y, t, h, b);
}
void Canvas::invert(int x, int y, int w, int h) {
  for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) pixel(x + i, y + j, !get(x + i, y + j));
}

void Canvas::fillRound(int x, int y, int w, int h, int r, bool b) {
  for (int j = 0; j < h; j++) {
    int inset = 0;
    const int dy = j < r ? r - j : (j >= h - r ? j - (h - r - 1) : 0);
    if (dy) inset = r - (int)floorf(sqrtf((float)(r * r - dy * dy)) + 0.5f);
    row(x + inset, y + j, w - 2 * inset, b);
  }
}
void Canvas::roundRect(int x, int y, int w, int h, int r, int t) {
  if (bold_ && t < 2) t = 2;
  fillRound(x, y, w, h, r, true);
  fillRound(x + t, y + t, w - 2 * t, h - 2 * t, r > t ? r - t : 0, false);
}

void Canvas::line(int x0, int y0, int x1, int y1, int t) {
  if (bold_ && t < 2) t = 2;
  int dx = abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (;;) {
    fill(x0 - t / 2, y0 - t / 2, t, t);
    if (x0 == x1 && y0 == y1) break;
    const int e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
void Canvas::dotted(int x, int y, int w, int gap) { for (int i = 0; i < w; i += gap) { pixel(x + i, y); if (bold_) { pixel(x + i + 1, y); pixel(x + i, y + 1); pixel(x + i + 1, y + 1); } } }

void Canvas::fillCircle(int cx, int cy, int r, bool b) {
  for (int dy = -r; dy <= r; dy++) {
    const int dx = (int)floorf(sqrtf((float)(r * r - dy * dy)) + 0.5f);
    row(cx - dx, cy + dy, 2 * dx + 1, b);
  }
}
void Canvas::circle(int cx, int cy, int r, int t) {
  if (bold_ && t < 2) t = 2;
  for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++) {
    const float d = sqrtf((float)(dx * dx + dy * dy));
    if (d <= r + 0.5f && d > r - t + 0.5f) pixel(cx + dx, cy + dy);
  }
}

void Canvas::moon(int cx, int cy, int r, float deg) {
  // Terminator is an ellipse with half-width |cos(phase)| * r; lit on the right while waxing.
  const float k = cosf(deg * (float)M_PI / 180.0f);
  const bool waxing = deg < 180.0f;
  for (int dy = -r; dy <= r; dy++) {
    const float half = sqrtf((float)(r * r - dy * dy));
    for (int dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const float term = k * half;  // x of the terminator on this row
      bool lit = waxing ? (dx > term) : (dx < -term);
      pixel(cx + dx, cy + dy, !lit);
    }
  }
  circle(cx, cy, r, 2);
}

void Canvas::checkbox(int x, int y, int s, bool on) {
  rect(x, y, s, s, 2);
  if (on) { fill(x + 4, y + 4, s - 8, s - 8); }
}

void Canvas::bubbles(int x, int y, int n, int value, int r, int gap) {
  for (int i = 0; i < n; i++) {
    const int cx = x + r + i * (2 * r + gap);
    if (i == value) fillCircle(cx, y, r); else circle(cx, y, r, 2);
  }
}

void Canvas::bitmap(const uint8_t* bits, int x, int y, int w, int h, bool b) {
  const int bw = (w + 7) / 8;
  for (int j = 0; j < h; j++)
    for (int i = 0; i < w; i++)
      if (bits[j * bw + (i >> 3)] & (0x80 >> (i & 7))) pixel(x + i, y + j, b);
}

void Canvas::icon(int id, int x, int y, int px, bool b) {
  if (id < 0 || id >= IC_COUNT) return;
  const uint8_t* bits = px >= 36 ? ICONS36[id] : ICONS24[id];
  const int n = px >= 36 ? 36 : 24;
  bitmap(bits, x, y, n, n, b);
  if (bold_) { bitmap(bits, x + 1, y, n, n, b); bitmap(bits, x, y + 1, n, n, b); }  // strokes 2 px -> 3 px
}

const Glyph* Canvas::find(const Font& f, uint32_t cp) {
  int lo = 0, hi = f.count - 1;
  while (lo <= hi) {
    const int mid = (lo + hi) / 2;
    if (f.glyphs[mid].cp == cp) return &f.glyphs[mid];
    if (f.glyphs[mid].cp < cp) lo = mid + 1; else hi = mid - 1;
  }
  return nullptr;
}

int Canvas::glyph(const Font& f, const Glyph* g, int x, int baseline, bool b) {
  if (g->w && g->h) {
    bitmap(f.bits + g->offset, x + g->xo, baseline + g->yo + f.ascent, g->w, g->h, b);
    if (bold_) bitmap(f.bits + g->offset, x + g->xo + 1, baseline + g->yo + f.ascent, g->w, g->h, b);
  }
  return g->adv + (bold_ ? 1 : 0);
}

// Inter has no arrows (they printed as a missing-glyph box, A11Y-51), so they are drawn: a shaft and a two-stroke head,
// sized from the font's ascent so they sit in the line at any text size. Returns the advance.
static int arrowSpan(const Font& f) { return f.ascent * 3 / 4 + 6; }
int Canvas::arrow(const Font& f, int dir, int x, int baseline, bool b) {
  const int len = f.ascent * 3 / 4, h = f.ascent / 5 + 2, t = (f.ascent >= 27 || bold_) ? 3 : 2, cy = baseline - f.ascent * 3 / 8;
  const int x0 = x + 2, x1 = x0 + len;
  const bool wasBold = bold_; bold_ = false;
  fill(x0, cy - t / 2, len, t, b);
  const int tip = dir > 0 ? x1 : x0, back = dir > 0 ? -h : h;
  line(tip, cy, tip + back, cy - h, t);
  line(tip, cy, tip + back, cy + h, t);
  bold_ = wasBold;
  return arrowSpan(f);
}

// Glyph yo is stored relative to the font's ascent line; shift so `baseline` means the text baseline.
int Canvas::text(const Font& f, int x, int baseline, const char* s, bool b, const Font* sym) {
  const int top = baseline - f.ascent;
  while (*s) {
    const uint32_t cp = utf8Next(s);
    if (cp == 0xFE0E || cp == 0xFE0F) continue;
    if (cp == 0x2192 || cp == 0x2190) { x += arrow(f, cp == 0x2192 ? 1 : -1, x, baseline, b); continue; }
    const Glyph* g = find(f, cp);
    if (g) { x += glyph(f, g, x, top, b); continue; }
    if (sym) {
      const Glyph* sg = find(*sym, cp);
      if (sg) {
        // align the symbol font's baseline with the text baseline
        x += glyph(*sym, sg, x, baseline - sym->ascent, b);
        continue;
      }
    }
    const Glyph* q = find(f, '?');
    if (q) x += glyph(f, q, x, top, b);
  }
  return x;
}

int Canvas::width(const Font& f, const char* s, const Font* sym) const {
  int w = 0;
  while (*s) {
    const uint32_t cp = utf8Next(s);
    if (cp == 0xFE0E || cp == 0xFE0F) continue;
    if (cp == 0x2192 || cp == 0x2190) { w += arrowSpan(f); continue; }
    const Glyph* g = find(f, cp);
    if (!g && sym) g = find(*sym, cp);
    if (!g) g = find(f, '?');
    if (g) w += g->adv + (bold_ ? 1 : 0);
  }
  return w;
}

void Canvas::textRight(const Font& f, int right, int baseline, const char* s, const Font* sym) {
  text(f, right - width(f, s, sym), baseline, s, true, sym);
}
void Canvas::textCenter(const Font& f, int cx, int baseline, const char* s, const Font* sym) {
  text(f, cx - width(f, s, sym) / 2, baseline, s, true, sym);
}

int Canvas::wrap(const Font& f, int x, int baseline, int w, const char* s, int maxLines, int lineGap, const Font* sym) {
  char line[256], word[128];
  int lines = 0, ll = 0;
  line[0] = 0;
  const int lh = f.lineHeight + lineGap;
  const char* p = s;
  auto flush = [&](bool last) {
    if (lines == maxLines - 1 && !last) {  // out of room: ellipsize this line
      while (ll > 0 && width(f, line, sym) + width(f, "…", sym) > w) line[--ll] = 0;
      strcat(line, "…");
    }
    text(f, x, baseline + lines * lh, line, true, sym);
    lines++; ll = 0; line[0] = 0;
  };
  while (*p && lines < maxLines) {
    while (*p == ' ') p++;
    int wl = 0;
    while (*p && *p != ' ' && *p != '\n' && wl < 127) word[wl++] = *p++;
    word[wl] = 0;
    char trial[256];
    snprintf(trial, sizeof trial, "%s%s%s", line, ll ? " " : "", word);
    if (ll && width(f, trial, sym) > w) {
      flush(false);
      if (lines >= maxLines) break;
      strncpy(line, word, sizeof line - 1); line[sizeof line - 1] = 0; ll = strlen(line);
    } else {
      strncpy(line, trial, sizeof line - 1); line[sizeof line - 1] = 0; ll = strlen(line);
    }
    if (*p == '\n') { p++; if (lines < maxLines) flush(!*p); }
  }
  if (ll && lines < maxLines) flush(true);
  return baseline + lines * lh;
}
