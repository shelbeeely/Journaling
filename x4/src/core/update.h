#pragma once
// Card update: move packs from /kw-update into /kw. See update.cpp.
namespace kwupdate {
bool packName(const char* n);  // "YYYY-MM.txt"
int apply();                   // returns how many files were moved into /kw (0 if there is no /kw-update)
}
