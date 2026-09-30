#!/usr/bin/env python3
"""Memory budget for the X4 Wi-Fi and TLS work (BUILD-PLAN section 19, slice N1). Run by CI after the two builds and the heap probe.

  budget.py x4.log x4-tls.log heap-probe.txt [baseline-static-ram baseline-flash]

Reads the numbers PlatformIO printed (static RAM, flash, free DRAM after the static data) and the heap probe's wolfSSL peak, adds the
documented cost of the Wi-Fi stack, and prints how much heap is left while a TLS session is open. Fails (exit 1) if that is under
MIN_SPARE, so a change that eats the headroom stops CI instead of surprising us on the device.
The Wi-Fi and TCP figures are ESTIMATES: the device reports the real free heap at every stage (serial "[mem]" lines and the "heap"
object in GET /api/info), and those replace these constants once measured on hardware.
"""
import os
import re
import sys

WIFI_STACK = 75_000   # bytes of heap the radio driver, lwIP, the web server and mDNS hold while the hotspot or station is up (estimate)
TCP_AND_TLS_IO = 12_000  # sockets and packet buffers for one TLS connection (estimate)
MIN_SPARE = 32_000    # bytes that must remain free after all of the above


def num(m):
    return int(m.group(1).replace(',', ''))


def pio(path):
    t = open(path, errors='replace').read()
    ram = num(re.search(r'RAM:.*?used (\d+) bytes', t))
    flash = num(re.search(r'Flash:.*?used (\d+) bytes', t))
    # the IDF size table: | DRAM | used | % | free | total |
    m = re.search(r'DRAM\s*│\s*(\d+)\s*│\s*[\d.]+\s*│\s*(\d+)\s*│\s*(\d+)', t)
    return ram, flash, int(m.group(2)) if m else None


def probe(path):
    peaks = []
    for line in open(path):
        m = re.search(r'^(.*?)\s+ctx\+CA.*peak \(with 6 KB reply\)\s+(\d+)', line)
        if m:
            peaks.append((m.group(1).strip(), int(m.group(2))))
    return peaks


def main():
    x4, tls, pr = sys.argv[1:4]
    r0, f0, d0 = pio(x4)
    r1, f1, d1 = pio(tls)
    peaks = probe(pr)
    if not peaks or d0 is None:
        print('budget: could not read the inputs')
        return 2
    worst = max(p for _, p in peaks)
    spare = d1 - WIFI_STACK - TCP_AND_TLS_IO - worst
    out = []
    out.append('### X4 memory (N1)')
    out.append('')
    if len(sys.argv) >= 6:
        b_ram, b_flash = int(sys.argv[4]), int(sys.argv[5])
        out.append(f'| | static RAM | flash |')
        out.append('|---|---:|---:|')
        out.append(f'| main before N1 | {b_ram:,} | {b_flash:,} |')
        out.append(f'| x4 (this change) | {r0:,} ({r0 - b_ram:+,}) | {f0:,} ({f0 - b_flash:+,}) |')
    else:
        out.append('| | static RAM | flash |')
        out.append('|---|---:|---:|')
        out.append(f'| x4 (this change) | {r0:,} | {f0:,} |')
    out.append(f'| x4-tls (wolfSSL TLS 1.3 linked) | {r1:,} ({r1 - r0:+,} vs x4) | {f1:,} ({f1 - f0:+,} vs x4) |')
    out.append('')
    out.append('wolfSSL client heap in a real TLS 1.3 handshake plus a 6 KB reply (PC, counting allocator; RISC-V 32-bit reads a little lower):')
    out.append('')
    for n, p in peaks:
        out.append(f'- {n}: {p:,} bytes')
    out.append('')
    out.append('Heap budget while a TLS session is open (free DRAM after static data, less the estimates below):')
    out.append('')
    out.append(f'- free DRAM after static data (x4-tls): {d1:,}')
    out.append(f'- Wi-Fi driver, lwIP, web server, mDNS (estimate): -{WIFI_STACK:,}')
    out.append(f'- sockets and packet buffers for one connection (estimate): -{TCP_AND_TLS_IO:,}')
    out.append(f'- wolfSSL worst case above: -{worst:,}')
    out.append(f'- **spare: {spare:,} bytes** (must stay at or above {MIN_SPARE:,})')
    text = '\n'.join(out)
    print(text)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as f:
            f.write(text + '\n')
    return 0 if spare >= MIN_SPARE else 1


if __name__ == '__main__':
    sys.exit(main())
