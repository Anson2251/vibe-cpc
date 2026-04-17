declare var scriptArgs: string[];

declare module "std" {
    export interface QuickJSFile {
        close(): number;
        puts(str: string): void;
        printf(fmt: string, ...args: any[]): void;
        flush(): void;
        seek(offset: number, whence: number): number;
        tell(): number;
        tello(): bigint;
        eof(): boolean;
        fileno(): number;
        error(): boolean;
        clearerr(): void;
        read(buffer: ArrayBuffer, position: number, length: number): void;
        write(buffer: ArrayBuffer, position: number, length: number): void;
        getline(): string;
        readAsString(max_size?: number): string;
        getByte(): number;
        putByte(c: number): void;
    }

    export const SEEK_SET: number;
    export const SEEK_CUR: number;
    export const SEEK_END: number;

    export function exit(n: number): void;
    export function evalScript(
        script: string,
        options?: { backtrace_barrier?: boolean; async?: boolean },
    ): any;
    export function loadScript(filename: string): void;
    export function loadFile(filename: string): string | null;
    export function open(filename: string, flags: string, errorObj?: object): QuickJSFile | null;
    export function popen(command: string, flags: string, errorObj?: object): QuickJSFile | null;
    export function fdopen(fd: number, flags: string, errorObj?: object): QuickJSFile | null;
    export function tmpfile(errorObj?: object): QuickJSFile | null;
    export function puts(str: string): void;
    export function printf(fmt: string, ...args: any[]): void;
    export function sprintf(fmt: string, ...args: any[]): string;
    export function strerror(errno: number): string;
    export function gc(): void;
    export function getenv(name: string): string | undefined;
    export function setenv(name: string, value: string): void;
    export function unsetenv(name: string): void;
    export function getenviron(): { readonly [key: string]: string };

    const _in: QuickJSFile;
    export { _in as in };
    export const out: QuickJSFile;
    export const err: QuickJSFile;
}

declare module "os" {
    interface FileStatus {
        readonly dev: number;
        readonly ino: number;
        readonly mode: number;
        readonly nlink: number;
        readonly uid: number;
        readonly gid: number;
        readonly rdev: number;
        readonly size: number;
        readonly blocks: number;
        readonly atime: number;
        readonly mtime: number;
        readonly ctime: number;
    }

    export const O_RDONLY: number;
    export const O_WRONLY: number;
    export const O_RDWR: number;
    export const O_CREAT: number;
    export const O_EXCL: number;
    export const O_TRUNC: number;
    export const O_APPEND: number;

    export function open(filename: string, flags: number, mode?: number): number;
    export function close(fd: number): number;
    export function seek(fd: number, offset: number, whence: number): number;
    export function read(fd: number, buffer: ArrayBuffer, offset: number, length: number): number;
    export function write(fd: number, buffer: ArrayBuffer, offset: number, length: number): number;
    export function isatty(fd: number): boolean;
    export function remove(filename: string): number;
    export function rename(oldname: string, newname: string): number;
    export function realpath(path: string): [string, number];
    export function getcwd(): [string, number];
    export function chdir(path: string): number;
    export function mkdir(path: string, mode?: number): number;
    export function stat(path: string): [FileStatus | null, number];
    export function lstat(path: string): [FileStatus | null, number];
    export function readdir(path: string): [string[] | null, number];
    export function sleep(delay: number): void;
    export function now(): number;
}
