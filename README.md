# tiny-stack-vm

[![make.fun](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![Node](https://img.shields.io/badge/node-22-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A tiny stack virtual machine for make.fun's tiny-stack-vm-01 bounty.
Referral code: `7n5rt0bc`

## Run

```sh
node main.ts
```

It reads `/input/<id>/program.bin` + `input.bin` for all 40 instances and
writes `/output/<id>/stdout.bin` + `exit.txt` in one run.

## How it works

`main.ts` is a single-file interpreter of the ISA in the kit
(`ISA.md` v1): 32-bit wrapping integers (`Math.imul` for exact low-32
multiplication), a 256-value data stack, a 64-deep call stack, 256 words
of memory, and the 1,000,000-step / 65,536-byte output limits.

The edge cases are implemented exactly as the reference VM orders
them: step limit first, then pc-out-of-range, unknown opcode, cut-off
immediate, stack underflow/overflow, then the instruction's own traps.
Division by zero is trap 4; `INT_MIN / -1` stays `INT_MIN`,
`x % -1` is 0, and `DIVU`/`MODU`/`LTU` read operands unsigned.
Shifts mask the count to 5 bits, `SHR` is arithmetic and `SHRU`
logical. `PUSH8` sign-extends, `EXIT` takes the low byte, a trap
keeps the output written before it, and falling off the end of the
program is trap 9. No clock, randomness or environment input, so two
runs are byte-identical.

Practice set: 40/40, score 1,000,000.
