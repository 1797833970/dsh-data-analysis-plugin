/**
 * Python code runtime: each run starts one sandboxed Python process that
 * executes a model-written `async def` body against host-provided tool
 * bindings over newline-delimited JSON on stdio. This is confinement, not a
 * hard security boundary: model code has bash-equivalent trust, bounded by the
 * mounted `ctx.sandbox` file policy, a Python-side import/attribute guard, a
 * wall-clock budget, and an outer-output cap.
 * @module @andy1797833970/dsh-code-runtime-python
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { CodeRuntime, DUNDER_MEMBER, PORTABLE_RESERVED_WORDS, RESERVED_BINDING_GLOBALS, RESERVED_ERROR_MEMBERS } from '@deepseek-ai/dsh-code-runtime'
import type { CodeBindingNamespace, CodeJsonValue, CodeRunFailure, CodeRunRequest, CodeRunResult } from '@deepseek-ai/dsh-code-runtime'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import { snapshotJsonValue } from '@deepseek-ai/dsh-session'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-subprocess'
import type { Agent } from '@deepseek-ai/dsh-agent'

/** Plugin config: every execution cap, changeable from `cordis.yml` (no hardcoded tunables). */
export interface Config {
  /**
   * Python executable name resolved through `ctx.subprocess`. Absolute paths
   * are verified; bare names use the provider's scrubbed PATH. Defaults to
   * `python` on Windows and `python3` elsewhere when omitted.
   */
  pythonCommand?: string
  /**
   * Module roots the model program may import, in addition to a fixed safe
   * stdlib set. The shim pre-imports these and seeds common aliases
   * (`pd`, `np`, `plt`, `sklearn`). Defaults to the pandas/numpy/matplotlib/
   * sklearn stack.
   */
  allowedModules?: string[]
  /**
   * Explicit environment entries layered after the subprocess provider's
   * scrub; a `VIRTUAL_ENV`/`PATH` here can select a venv interpreter.
   */
  pythonEnv?: Record<string, string>
  /** Wall-clock ceiling in milliseconds; expiry kills the process tree. */
  timeoutMs?: number
  /** Grace period for tree termination after a timeout or abort. */
  graceMs?: number
  /**
   * Directories prepended to the Python program's `sys.path`. A deployment
   * points these at shipped, trusted Python toolboxes so model code can import
   * them by module name. Each must be an absolute path.
   */
  toolboxDirs?: string[]
  /**
   * Hard cap for the combined ordered log text, completion value, and failure
   * message. Exceeding it fails the run with kind `'output-limit'`.
   */
  maxOutputBytes?: number
}

/** {@link Config} after schemastery fills the defaults (every field present). */
type ResolvedConfig = Required<Config>

/** The seam's language-portable identifier subset (shared with every backend). */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Smallest cap that can represent an empty output: an empty logs array. */
const MIN_OUTPUT_BYTES = 2

/**
 * The Python bootstrap shim, shipped inline so source and built runs share one
 * truth and no `.py` artifact needs a separate copy step. It reads one boot
 * line from stdin, guards and runs the model program, and bridges tool calls
 * as newline-delimited JSON requests/responses on the real stdout/stdin.
 */
/**
 * The embedded Python bootstrap, exported so tests can run it against a real
 * interpreter. See {@link PythonCodeRuntime.run} for the wire contract.
 */
export const SHIM_SOURCE = String.raw`import ast
import asyncio
import builtins
import importlib
import json
import sys
import textwrap
import traceback

if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8')
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

_REAL_STDOUT = sys.stdout
_STATE = {'byte_budget': 0, 'max_bytes': 1 << 20}
_LOCK = None

_DENY_ROOTS = {
    'os', 'sys', 'subprocess', 'socket', 'shutil', 'pathlib', 'glob', 'tempfile',
    'builtins', 'importlib', 'ctypes', 'pickle', 'marshal', 'requests',
    'urllib', 'http', 'ftplib', 'smtplib', 'telnetlib', 'threading',
    'multiprocessing', 'signal', 'mmap', 'fcntl', 'resource', 'inspect', 'gc',
    'faulthandler', 'code', 'codeop', 'pty', 'select', 'selectors', 'ssl',
    'runpy', 'site', 'pkgutil', 'linecache', 'webbrowser', 'pydoc', 'curses',
}

_ALLOW_STDLIB = {
    'json', 're', 'math', 'statistics', 'datetime', 'collections', 'itertools',
    'functools', 'typing', 'random', 'decimal', 'fractions', 'numbers', 'string',
    'textwrap', 'csv', 'warnings', 'contextlib', 'dataclasses', 'enum', 'abc',
    'operator', 'copy', 'bisect', 'heapq', 'uuid', 'hashlib', 'base64', 'struct',
    'array', 'colorsys', 'unicodedata', 'asyncio', 'io',
}

_FORBIDDEN_CALLS = {
    'eval', 'exec', 'compile', '__import__', 'open', 'input', 'globals',
    'locals', 'vars', 'breakpoint', 'memoryview',
}

_ATTR_FUNCTIONS = {'getattr', 'setattr', 'delattr'}

_FORBIDDEN_ATTRS = {
    '__globals__', '__subclasses__', '__bases__', '__mro__', '__builtins__',
    '__code__', '__class__', '__getattribute__', '__delattr__', '__setattr__',
    '__import__', 'func_globals', 'im_func', 'gi_code', 'gi_frame', 'cr_frame',
    'tb_frame',
}


def _emit(obj):
    line = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    _REAL_STDOUT.write(line + '\n')
    _REAL_STDOUT.flush()


class _LogWriter:
    def __init__(self):
        self._pending = ''

    def write(self, text):
        self._pending += text
        while '\n' in self._pending:
            line, self._pending = self._pending.split('\n', 1)
            self._emit_line(line)

    def flush(self):
        if self._pending:
            self._emit_line(self._pending)
            self._pending = ''

    def _emit_line(self, line):
        _STATE['byte_budget'] += len(line.encode('utf-8')) + 1
        _emit({'op': 'log', 'text': line})


class ToolCallError(Exception):
    def __init__(self, toolName, message):
        super().__init__(message)
        self.toolName = toolName


class _Callable:
    def __init__(self, global_name, name):
        self._global = global_name
        self._name = name

    async def __call__(self, *args, **kwargs):
        if args and kwargs:
            raise TypeError('tool call accepts positional args or keyword args, not both')
        if len(args) > 1:
            raise TypeError('tool call accepts at most one positional argument')
        payload = kwargs if kwargs else (args[0] if args else None)
        async with _LOCK:
            _emit({'op': 'call', 'global': self._global, 'name': self._name, 'args': payload})
            line = sys.stdin.readline()
            if not line:
                raise RuntimeError('runtime closed stdin before replying to tool call')
            try:
                reply = json.loads(line)
            except Exception:
                raise RuntimeError('runtime sent a malformed tool-call reply')
        if reply.get('ok'):
            return reply.get('value')
        raise ToolCallError(self._name, reply.get('message', 'unknown binding failure'))


class _NamespaceProxy:
    def __init__(self, global_name, names):
        self._global = global_name
        self._names = set(names)

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        return _Callable(self._global, name)

    def __getitem__(self, name):
        if name not in self._names:
            raise KeyError(name)
        return _Callable(self._global, name)


def _check_root(root, allowed, lineno):
    if root in _DENY_ROOTS:
        raise ValueError('import of ' + root + ' is not allowed (line ' + str(lineno) + ')')
    if root not in allowed and root not in _ALLOW_STDLIB:
        raise ValueError('import of ' + root + ' is not in the allowlist (line ' + str(lineno) + ')')


def _check_call(node, lineno):
    func = node.func
    name = None
    if isinstance(func, ast.Name):
        name = func.id
    elif isinstance(func, ast.Attribute):
        name = func.attr
    if name is None:
        return
    if name in _FORBIDDEN_CALLS:
        raise ValueError('call to ' + name + ' is not allowed (line ' + str(lineno) + ')')
    if name in _ATTR_FUNCTIONS and len(node.args) >= 2:
        attr = node.args[1]
        if isinstance(attr, ast.Constant) and isinstance(attr.value, str) and attr.value in _FORBIDDEN_ATTRS:
            raise ValueError('forbidden attribute ' + attr.value + ' (line ' + str(lineno) + ')')


def _guard(source, allowed):
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        raise ValueError('program failed to parse: ' + str(exc))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                _check_root(alias.name.split('.')[0], allowed, node.lineno)
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                raise ValueError('relative imports are not allowed (line ' + str(node.lineno) + ')')
            _check_root((node.module or '').split('.')[0], allowed, node.lineno)
        elif isinstance(node, ast.Call):
            _check_call(node, node.lineno)
        elif isinstance(node, ast.Attribute):
            if node.attr in _FORBIDDEN_ATTRS:
                raise ValueError('forbidden attribute ' + node.attr + ' (line ' + str(node.lineno) + ')')


def _short_traceback(exc):
    if isinstance(exc, ToolCallError):
        return 'ToolCallError(' + str(exc.toolName) + '): ' + str(exc)
    return ''.join(traceback.format_exception(type(exc), exc, exc.__traceback__)).strip()


def _main():
    global _LOCK
    boot_line = sys.stdin.readline()
    if not boot_line:
        raise RuntimeError('missing boot config')
    boot = json.loads(boot_line)
    program = boot['program']
    allowed = set(boot.get('allowedModules', []))
    _STATE['max_bytes'] = int(boot.get('maxOutputBytes', 1 << 20))
    for directory in reversed(boot.get('toolboxDirs', [])):
        sys.path.insert(0, directory)
    _LOCK = asyncio.Lock()

    result = None
    has_result = False
    try:
        _guard(program, allowed)
        for mod in allowed:
            try:
                importlib.import_module(mod)
            except Exception:
                continue

        seed = {}
        for mod, alias in (('pandas', 'pd'), ('numpy', 'np'), ('matplotlib.pyplot', 'plt')):
            try:
                seed[alias] = importlib.import_module(mod)
            except Exception:
                pass
        for name in ('sklearn', 'pandas', 'numpy'):
            if name in sys.modules:
                seed[name] = sys.modules[name]

        globs = globals()
        globs.update(seed)
        for namespace in boot.get('bindings', []):
            globs[namespace['global']] = _NamespaceProxy(namespace['global'], namespace.get('names', []))

        writer = _LogWriter()
        sys.stdout = writer
        wrapped = 'async def __dsh_main__():\n' + textwrap.indent(program, '    ') + '\n'
        exec(compile(wrapped, '<run_code>', 'exec'), globs)
        result = asyncio.run(globs['__dsh_main__']())
        has_result = True
    except BaseException as exc:
        _emit({'op': 'done', 'error': {'kind': 'exception', 'message': _short_traceback(exc)}})
        return
    finally:
        sys.stdout = _REAL_STDOUT

    if not has_result:
        return
    try:
        text = json.dumps(result, ensure_ascii=False, allow_nan=False)
        value = json.loads(text)
        _STATE['byte_budget'] += len(text.encode('utf-8')) + 1
        if _STATE['byte_budget'] > _STATE['max_bytes']:
            _emit({'op': 'done', 'error': {'kind': 'output-limit', 'message': 'outer output exceeded ' + str(_STATE['max_bytes']) + ' bytes'}})
        else:
            _emit({'op': 'done', 'value': value})
    except (TypeError, ValueError):
        _emit({'op': 'done', 'error': {'kind': 'invalid-output', 'message': 'program completion must be lossless JSON'}})


_main()
`

/** A message the shim may send on its stdout. */
type ShimToHost =
  | { op: 'call'; global: string; name: string; args: unknown }
  | { op: 'log'; text: string }
  | { op: 'done'; value?: unknown; error?: { kind: string; message: string } }

/**
 * Parse one shim stdout line; junk returns `undefined` and is dropped.
 * @param raw - the parsed JSON value from one newline-delimited line.
 * @returns the recognized shim message, or `undefined` for junk.
 */
export function parseShimMessage(raw: unknown): ShimToHost | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const message = raw as Record<string, unknown>
  switch (message.op) {
    case 'call': {
      if (typeof message.global !== 'string' || typeof message.name !== 'string') return undefined
      return { op: 'call', global: message.global, name: message.name, args: message.args }
    }
    case 'log': {
      if (typeof message.text !== 'string') return undefined
      return { op: 'log', text: message.text }
    }
    case 'done': {
      if (message.error !== undefined) {
        if (typeof message.error !== 'object' || message.error === null) return undefined
        const error = message.error as Record<string, unknown>
        if ((error.kind !== 'exception' && error.kind !== 'invalid-output' && error.kind !== 'output-limit') || typeof error.message !== 'string') return undefined
        return { op: 'done', error: { kind: error.kind, message: error.message } }
      }
      return { op: 'done', ...message.value !== undefined ? { value: message.value } : {} }
    }
    default:
      return undefined
  }
}

/** Message of an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Counted outer-output ledger; binding values never enter it. */
class OutputLedger {
  private bytes = 0
  constructor(private readonly maxBytes: number) {}

  admit(text: string, sink: string[]): boolean {
    const size = Buffer.byteLength(text, 'utf8')
    if (this.bytes + size > this.maxBytes) return false
    this.bytes += size
    sink.push(text)
    return true
  }

  success(logs: string[], value?: CodeJsonValue): CodeRunResult {
    if (value !== undefined && this.bytes + Buffer.byteLength(JSON.stringify(value), 'utf8') > this.maxBytes) return this.limit(logs)
    return { logs, ...value !== undefined ? { value } : {} }
  }

  failure(logs: string[], error: CodeRunFailure): CodeRunResult {
    if (this.bytes + Buffer.byteLength(error.message, 'utf8') > this.maxBytes) return this.limit(logs)
    return { logs, error }
  }

  limit(logs: string[]): CodeRunResult {
    const message = `outer output exceeded ${this.maxBytes} bytes`
    return { logs, error: { kind: 'output-limit', message } }
  }
}

/**
 * The shipped Python {@link CodeRuntime} backend (`ctx.codeRuntime`). Registers
 * as the `codeRuntime` service; every cap comes from validated config. The
 * program runs in a fresh process, so no state survives between runs.
 */
export class PythonCodeRuntime extends CodeRuntime {
  static Config: z<Config> = z.object({
    pythonCommand: z.string(),
    allowedModules: z.array(z.string()).default(['pandas', 'numpy', 'matplotlib', 'sklearn']),
    pythonEnv: z.dict(z.string()).default({}),
    timeoutMs: z.number().default(60_000),
    graceMs: z.number().default(5_000),
    toolboxDirs: z.array(z.string()).default([]),
    maxOutputBytes: z.number().default(1_048_576),
  })

  static inject = ['subprocess', 'sandbox', 'sandboxPolicy']

  readonly language = 'python'
  readonly isolation = 'process'

  private readonly config: ResolvedConfig
  private readonly live = new Set<SubprocessHandle>()
  private disposed = false

  constructor(ctx: Context, config: Config) {
    super(ctx)
    const pythonCommand = config.pythonCommand ?? (process.platform === 'win32' ? 'python' : 'python3')
    this.config = { ...config, pythonCommand } as ResolvedConfig
    for (const key of ['timeoutMs', 'graceMs', 'maxOutputBytes'] as const) {
      const value = this.config[key]
      if (!(Number.isFinite(value) && value > 0)) throw new Error(`dsh-code-runtime-python: config.${key} must be a positive number, got ${String(value)}`)
    }
    if (this.config.timeoutMs > MAX_TIMER_DELAY_MS) throw new Error(`dsh-code-runtime-python: config.timeoutMs must be at most ${MAX_TIMER_DELAY_MS}, got ${String(this.config.timeoutMs)}`)
    if (!Number.isSafeInteger(this.config.maxOutputBytes) || this.config.maxOutputBytes < MIN_OUTPUT_BYTES) {
      throw new Error(`dsh-code-runtime-python: config.maxOutputBytes must be a safe integer of at least ${MIN_OUTPUT_BYTES}, got ${String(this.config.maxOutputBytes)}`)
    }
    ctx.effect(() => () => { this.teardown() }, 'python code-runtime teardown')
  }

  /** Fail every in-flight run as aborted and terminate its process tree. */
  private teardown(): void {
    this.disposed = true
    for (const proc of [...this.live]) proc.terminate()
  }

  /**
   * Execute one program in a fresh Python process. Program outcomes resolve
   * with `result.error`; rejection means Service Definition contract misuse
   * (disposal, an invalid binding namespace, or unavailable sandbox).
   * @param request - the program, its bindings, and the abort signal.
   * @returns the run's outcome per the seam contract.
   */
  async run(request: CodeRunRequest): Promise<CodeRunResult> {
    if (this.disposed) throw new Error('dsh-code-runtime-python: run() after disposal')
    const bindings = this.validateBindings(request)
    if (request.signal?.aborted) return { logs: [], error: { kind: 'abort', message: String(request.signal.reason) } }

    const agent: Agent | undefined = this.ctx.get('agents')?.currentInitiator()
    const policy = this.ctx.sandboxPolicy.resolve(agent === undefined ? {} : { session: agent.session })
    const executable = await this.ctx.subprocess.resolveExecutable(this.config.pythonCommand, this.config.pythonEnv, request.signal)
    let argv: string[] = [executable, '-u', '-c', SHIM_SOURCE]
    if (policy.mode !== 'danger-full-access') {
      const confined = this.ctx.sandbox.confine(argv, { ...policy, mode: policy.mode })
      argv = confined.argv
    }

    const boot = JSON.stringify({
      program: request.program,
      bindings: [...bindings].map(([global, namespace]) => ({
        global,
        names: Object.keys(namespace.functions),
        ...namespace.errorClass ? { errorClass: namespace.errorClass } : {},
      })),
      allowedModules: this.config.allowedModules,
      toolboxDirs: this.config.toolboxDirs,
      maxOutputBytes: this.config.maxOutputBytes,
    })

    const proc = this.ctx.subprocess.spawn({
      argv,
      cwd: policy.workspaceRoot,
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
      graceMs: this.config.graceMs,
      signal: request.signal,
      env: this.config.pythonEnv,
    })
    this.live.add(proc)
    return await this.execute(request, proc, boot, bindings)
  }

  /** Reject malformed binding globals or typed-error declarations as contract misuse. */
  private validateBindings(request: CodeRunRequest): Map<string, CodeBindingNamespace> {
    const bindings = new Map<string, CodeBindingNamespace>()
    for (const namespace of request.bindings) {
      if (
        !IDENTIFIER.test(namespace.global)
        || PORTABLE_RESERVED_WORDS.has(namespace.global)
        || RESERVED_BINDING_GLOBALS.has(namespace.global)
      ) {
        throw new Error(`dsh-code-runtime-python: binding global ${JSON.stringify(namespace.global)} is not usable`)
      }
      if (bindings.has(namespace.global)) throw new Error(`dsh-code-runtime-python: duplicate binding global ${JSON.stringify(namespace.global)}`)
      bindings.set(namespace.global, namespace)
    }
    const errorClassNames = new Set<string>()
    for (const namespace of request.bindings) {
      const descriptor = namespace.errorClass
      if (!descriptor) continue
      if (
        !IDENTIFIER.test(descriptor.name)
        || PORTABLE_RESERVED_WORDS.has(descriptor.name)
        || RESERVED_BINDING_GLOBALS.has(descriptor.name)
      ) {
        throw new Error(`dsh-code-runtime-python: binding error class ${JSON.stringify(descriptor.name)} is not usable`)
      }
      if (bindings.has(descriptor.name) || errorClassNames.has(descriptor.name)) throw new Error(`dsh-code-runtime-python: duplicate injected global ${JSON.stringify(descriptor.name)}`)
      const member = descriptor.memberNameProperty
      if (member.length === 0 || RESERVED_ERROR_MEMBERS.has(member) || DUNDER_MEMBER.test(member)) {
        throw new Error(`dsh-code-runtime-python: binding error member property ${JSON.stringify(member)} is not usable`)
      }
      errorClassNames.add(descriptor.name)
    }
    return bindings
  }

  /** Drive one spawned process to settlement over the NDJSON bridge. */
  private execute(
    request: CodeRunRequest,
    proc: SubprocessHandle,
    boot: string,
    bindings: Map<string, CodeBindingNamespace>,
  ): Promise<CodeRunResult> {
    return new Promise<CodeRunResult>((resolve) => {
      let settled = false
      let buffer = ''
      const logs: string[] = []
      const stray: string[] = []
      const output = new OutputLedger(this.config.maxOutputBytes)

      const finish = (finalize: CodeRunResult | (() => CodeRunResult)): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        request.signal?.removeEventListener('abort', onAbort)
        this.live.delete(proc)
        proc.stdin?.end()
        const result = typeof finalize === 'function' ? finalize() : finalize
        resolve(result)
      }

      const appendStray = (chunk: Buffer): void => {
        if (settled) return
        const text = chunk.toString('utf8')
        if (!output.admit(text, stray)) finish(() => output.limit([...logs, ...stray]))
      }

      const onLine = (line: string): void => {
        if (settled) return
        const message = parseShimMessage(JSON.parse(line))
        if (!message) return
        if (message.op === 'log') {
          if (!output.admit(message.text, logs)) finish(() => output.limit([...logs, ...stray]))
          return
        }
        if (message.op === 'call') {
          const record = bindings.get(message.global)?.functions
          const fn = record && Object.hasOwn(record, message.name) ? record[message.name] : undefined
          if (typeof fn !== 'function') {
            proc.stdin?.write(`${JSON.stringify({ op: 'reply', ok: false, message: `unknown binding ${JSON.stringify(`${message.global}.${message.name}`)}` })}\n`)
            return
          }
          void (async () => {
            try {
              const resolved = await fn(message.args)
              const value = snapshotJsonValue(resolved)
              if (value === undefined) {
                proc.stdin?.write(`${JSON.stringify({ op: 'reply', ok: false, message: 'binding resolution must be lossless JSON' })}\n`)
              } else {
                proc.stdin?.write(`${JSON.stringify({ op: 'reply', ok: true, value })}\n`)
              }
            } catch (error: unknown) {
              proc.stdin?.write(`${JSON.stringify({ op: 'reply', ok: false, message: messageOf(error) })}\n`)
            }
          })()
          return
        }
        if (message.error) {
          const error = { kind: message.error.kind, message: message.error.message } as CodeRunFailure
          finish(() => output.failure([...logs, ...stray], error))
        } else {
          finish(() => output.success([...logs, ...stray], message.value as CodeJsonValue | undefined))
        }
      }

      proc.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8')
        let index = buffer.indexOf('\n')
        while (index >= 0) {
          const line = buffer.slice(0, index)
          buffer = buffer.slice(index + 1)
          if (line.length > 0) {
            try {
              onLine(line)
            } catch {
              // A malformed protocol line is dropped rather than crashing the host.
            }
          }
          index = buffer.indexOf('\n')
        }
      })
      proc.stderr?.on('data', appendStray)

      const timer = setTimeout(() => {
        proc.terminate()
        finish(() => output.failure([...logs, ...stray], { kind: 'timeout', message: `wall-clock ceiling reached (${this.config.timeoutMs}ms)` }))
      }, this.config.timeoutMs)
      const onAbort = (): void => {
        proc.terminate()
        finish(() => output.failure([...logs, ...stray], { kind: 'abort', message: String(request.signal?.reason) }))
      }
      request.signal?.addEventListener('abort', onAbort, { once: true })

      void proc.done.then(
        () => {
          if (!settled) finish(() => output.failure([...logs, ...stray], { kind: 'worker-exit', message: 'python process exited before completing' }))
        },
        (error: unknown) => {
          if (!settled) finish(() => output.failure([...logs, ...stray], { kind: 'worker-exit', message: `python spawn failed: ${messageOf(error)}` }))
        },
      )

      proc.stdin?.write(`${boot}\n`)
    })
  }
}

export default PythonCodeRuntime
