// Tiny stack VM: make.fun tiny-stack-vm-01 ISA v1. Runs /input/<id>/program.bin
// on input.bin, writes /output/<id>/stdout.bin + exit.txt. Node 22, erasable TS.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
// Opcode table, "op[-op] imm pops pushes" (decimal opcodes, later wins):
// 0x00 HALT, 0x01 PUSH8, 0x02 PUSH32, 0x03 POP, 0x04 DUP, 0x05 SWAP, 0x06 OVER,
// 0x07 ROT, 0x10-0x16 + 0x18-0x1e binary, 0x17 NEG, 0x1b NOT, 0x20-0x22 compare,
// 0x30 JMP, 0x31 JZ, 0x32 JNZ, 0x33 CALL, 0x34 RET, 0x40 LOAD, 0x41 STORE,
// 0x50 PRINT, 0x51 PUTC, 0x52 IN, 0x53 EXIT.
const IM = new Uint8Array(256), PO = new Uint8Array(256), PU = new Uint8Array(256), KN = new Uint8Array(256);
for (const e of '1 1 0 1;2 4 0 1;3 0 1 0;4 0 1 2;5 0 2 2;6 0 2 3;7 0 3 3;16-22 0 2 1;23 0 1 1;24-30 0 2 1;27 0 1 1;32-34 0 2 1;48-50 2 0 0;49 2 1 0;50 2 1 0;51 2 0 0;52 0 0 0;64 0 1 1;65 0 2 0;80 0 1 0;81 0 1 0;82 0 0 1;83 0 1 0'.split(';')) {
  const f = e.split(' ');
  const im = +f[1], po = +f[2], pu = +f[3];
  const [a, b] = f[0].includes('-') ? f[0].split('-').map(Number) : [+f[0], +f[0]];
  for (let o = a; o <= b; o++) { IM[o] = im; PO[o] = po; PU[o] = pu; KN[o] = 1; }
}
KN[0] = KN[48] = KN[51] = KN[52] = 1;
function run(p: Uint8Array, inp: Uint8Array): { o: Uint8Array; c: number } {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const out = new Uint8Array(65536), dg = new Uint8Array(12);
  let sp = 0, cp = 0, ol = 0, ip = 0, pc = 0, st = 0;
  const end = (c: number) => ({ o: out.subarray(0, ol), c });
  for (;;) {
    if (st === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = p[pc];
    if (!KN[op]) return end(5);
    const im = IM[op];
    if (pc + im >= n) return end(9);
    st++;
    const nx = pc + 1 + im, po = PO[op], pu = PU[op];
    if (sp < po) return end(2);
    if (sp - po + pu > 256) return end(3);
    pc = nx;
    switch (op) {
      case 0: return end(0);
      case 1: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = D[sp - 1], a = D[sp - 2];
        let r: number;
        switch (op) {
          case 16: r = (a + b) | 0; break;
          case 17: r = (a - b) | 0; break;
          case 18: r = Math.imul(a, b); break;
          case 19: if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; break;
          case 20: if (!b) return end(4); r = b === -1 ? 0 : (a % b) | 0; break;
          case 21: if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
          case 22: if (!b) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; break;
          case 24: r = a & b; break;
          case 25: r = a | b; break;
          case 26: r = a ^ b; break;
          case 28: r = a << (b & 31); break;
          case 29: r = a >> (b & 31); break;
          case 30: r = (a >>> (b & 31)) | 0; break;
          case 32: r = a === b ? 1 : 0; break;
          case 33: r = a < b ? 1 : 0; break;
          default: r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        }
        sp -= 2; D[sp++] = r; break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) { const v = D[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (cp === 64) return end(7);
        C[cp++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8); break;
      case 52:
        if (!cp) return end(8);
        pc = C[--cp]; break;
      case 64: {
        const a = D[sp - 1];
        if (a < 0 || a >= 256) return end(6);
        D[sp - 1] = M[a]; break;
      }
      case 65: {
        const a = D[sp - 1], v = D[sp - 2];
        if (a < 0 || a >= 256) return end(6);
        sp -= 2; M[a] = v; break;
      }
      case 80: {
        const v = D[sp - 1];
        let u = v, neg = false, dl = 0;
        if (u < 0) { neg = true; u = -u; }
        if (!u) dg[dl++] = 48;
        while (u > 0) { dg[dl++] = 48 + (u % 10); u = Math.floor(u / 10); }
        if (ol + dl + (neg ? 1 : 0) > 65536) return end(11);
        sp--;
        if (neg) out[ol++] = 45;
        while (dl > 0) out[ol++] = dg[--dl];
        break;
      }
      case 81:
        if (ol + 1 > 65536) return end(11);
        out[ol++] = D[--sp] & 255; break;
      case 82: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: return end(D[--sp] & 255);
      default: return end(5);
    }
  }
}
for (const id of readdirSync(I).sort()) {
  const { o, c } = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), o);
  writeFileSync(join(O, id, 'exit.txt'), c + '\n');
}
