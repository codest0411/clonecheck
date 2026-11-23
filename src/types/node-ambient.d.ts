declare namespace NodeJS {
  interface ProcessEnv extends Record<string, string | undefined> {}
}

declare const process: {
  cwd(): string;
  platform: string;
  execPath: string;
  argv: string[];
  env: NodeJS.ProcessEnv;
  exit(code?: number): never;
  stdout?: {
    isTTY?: boolean;
    [key: string]: any;
  };
  stderr?: {
    isTTY?: boolean;
    [key: string]: any;
  };
  exitCode?: number;
  [key: string]: any;
};

declare class Buffer extends Uint8Array {
  static alloc(size: number): Buffer;
  static from(...args: any[]): Buffer;
  static concat(list: readonly Uint8Array[], totalLength?: number): Buffer;
  toString(encoding?: string): string;
  subarray(start?: number, end?: number): Buffer;
  includes(value: any): boolean;
  [key: string]: any;
}

declare module 'node:fs' {
  const fs: any;
  export default fs;
  export const openSync: any;
  export const readSync: any;
  export const closeSync: any;
  export const readFileSync: any;
  export const writeFileSync: any;
  export const existsSync: any;
  export const lstatSync: any;
  export const statSync: any;
  export const chmodSync: any;
  export const renameSync: any;
  export const unlinkSync: any;
  export const mkdirSync: any;
  export const mkdtempSync: any;
  export const readdirSync: any;
  export const realpathSync: any;
  export const rmSync: any;
}

declare module 'node:path' {
  const path: any;
  export default path;
  export const resolve: any;
  export const join: any;
  export const dirname: any;
  export const basename: any;
  export const extname: any;
  export const relative: any;
  export const isAbsolute: any;
}

declare module 'node:os' {
  const os: any;
  export default os;
  export const tmpdir: any;
}

declare module 'node:child_process' {
  const cp: any;
  export default cp;
  export const execFileSync: any;
  export const spawnSync: any;
  export const spawn: any;
  export interface ExecFileSyncOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: string;
    timeout?: number;
    maxBuffer?: number;
    shell?: boolean | string;
    stdio?: any;
    windowsVerbatimArguments?: boolean;
    [key: string]: any;
  }
}

declare module 'node:util' {
  const util: any;
  export default util;
  export const parseArgs: any;
}

declare module 'node:url' {
  export const fileURLToPath: any;
  export const pathToFileURL: any;
}

declare module 'node:test' {
  const test: any;
  export default test;
  export { test };
}

declare module 'node:assert/strict' {
  const assert: any;
  export default assert;
  export * from 'assert';
}
