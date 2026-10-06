# Licensing

| What | Licence |
|---|---|
| Code: the editor, render pipeline, Studio, firmware and everything else that is not docs | [MIT](LICENSE) |
| Docs and guide content: `docs/` (including the methods library), the `/docs/` and `/guide/` site pages, and the docs rules in `CONTRIBUTING.md` | [CC0 1.0](docs/LICENSE-docs) (public domain dedication) |
| A built `x4-tls` firmware image | GPL-2.0 as a whole |
| Content packs | Each `pack.json` declares its own licence |

## The x4-tls firmware build

The `x4-tls` firmware build (`pio run -e x4-tls`) links wolfSSL, which is GPL-2.0. A built `x4-tls` image is therefore GPL-2.0 as a whole, and if you distribute that binary you must offer its source under GPL-2.0. The source of our own glue code (`x4/src/net/`, `x4/tls/`) stays MIT. The default `x4` image does not link wolfSSL and is MIT.

## Contributing

- Text you contribute to the docs and guide is offered under CC0 1.0.
- Code you contribute is offered under MIT.
- Packs keep the licence their `pack.json` declares. The build refuses a pack with none.

Copyright holder for the code: Shelbee and Journalwright Studio contributors (see `LICENSE`).
