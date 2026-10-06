# Licensing

| What | Licence |
|---|---|
| Code: the editor, render pipeline, Studio, firmware and everything else that is not docs | [MIT](LICENSE) |
| Docs and guide content, and only this: `docs/journaling/methods/` (the research docs and `TEMPLATE.md`), the `/docs/` and `/guide/` site pages and their source (`site/guide/`, `site/tools/guide-content.mjs`, the docs page builders), and the docs rules in `CONTRIBUTING.md` | [CC0 1.0](docs/journaling/methods/LICENSE) (public domain dedication) |
| A built `x4-tls` firmware image | GPL-2.0 as a whole |
| Content packs | Each `pack.json` declares its own licence |

Everything else under `docs/` (`BUILD-PLAN.md`, `docs/review/`, any other planning or review notes) is not granted CC0: all rights reserved unless a file states otherwise.

## The x4-tls firmware build

The `x4-tls` firmware build (`pio run -e x4-tls`) links wolfSSL, which is GPL-2.0. A built `x4-tls` image is therefore GPL-2.0 as a whole, and if you distribute that binary you must offer its source under GPL-2.0. The source of our own glue code (`x4/src/net/`, `x4/tls/`) stays MIT. The default `x4` image does not link wolfSSL and is MIT.

## Contributing

- Text you contribute to the docs and guide is offered under CC0 1.0.
- Code you contribute is offered under MIT.
- Packs keep the licence their `pack.json` declares. The build refuses a pack with none.

Copyright holder for the code: Shelbee and Journalwright Studio contributors (see `LICENSE`).
