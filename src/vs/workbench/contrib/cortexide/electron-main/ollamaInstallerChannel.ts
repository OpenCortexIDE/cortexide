/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  OllamaInstallerChannel
 *  ----------------------
 *  Runs in the Electron main process.  Handles:
 *    1. Ollama daemon installation (macOS via Homebrew, Linux via install.sh,
 *       Windows via winget / choco)
 *    2. Model pulling - downloads the chosen model pack via `ollama pull <tag>`
 *       after the daemon is confirmed healthy
 *    3. Hardware detection - reports available VRAM so the UI can recommend an
 *       appropriate model pack without user guesswork
 *
 *  Security contract:
 *  - All shell arguments are passed as explicit string arrays to `spawn()`.
 *    String interpolation into shell commands is NEVER used (no command injection).
 *  - Downloaded model tags are validated against ALLOWED_MODEL_TAGS before pull.
 *  - Ollama is health-checked via HTTP before attempting a model pull.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { spawn, execFile } from 'node:child_process';
import { platform } from 'node:os';
import * as http from 'node:http';
import { MODEL_PACKS, type ModelPackKey } from '../common/ollamaModelPacks.js';

// allow-any-unicode-next-line
// Security allowlist — only these tags may be passed to `ollama pull`
const ALLOWED_MODEL_TAGS = new Set(Object.values(MODEL_PACKS).map(p => p.tag));

type InstallParams = {
	method: 'auto' | 'brew' | 'curl' | 'winget' | 'choco';
	modelTag?: string;
};

type PullParams = {
	modelTag: string;
};

type HardwareInfoResult = {
	vramGB: number | null;
	recommendedPack: ModelPackKey;
};

// allow-any-unicode-next-line
// ─── channel ──────────────────────────────────────────────────────────────────

export class OllamaInstallerChannel implements IServerChannel {

	private readonly _onLog = new Emitter<{ text: string }>();
	private readonly _onDone = new Emitter<{ ok: boolean }>();
	private readonly _onPullProgress = new Emitter<{ modelTag: string; percent: number; status: string }>();

	listen(_: unknown, event: string): Event<any> {
		if (event === 'onLog') return this._onLog.event;
		if (event === 'onDone') return this._onDone.event;
		if (event === 'onPullProgress') return this._onPullProgress.event;
		throw new Error(`Event not found: ${event}`);
	}

	async call(_: unknown, command: string, params: any): Promise<any> {
		switch (command) {
			case 'install':
				this._install(params as InstallParams);
				return;
			case 'pullModel':
				await this._pullModel(params as PullParams);
				return;
			case 'getHardwareInfo':
				return this._getHardwareInfo();
			case 'getModelPacks':
				return MODEL_PACKS;
			case 'isOllamaRunning':
				return this._isOllamaHealthy();
			default:
				throw new Error(`Unknown command: ${command}`);
		}
	}

	// allow-any-unicode-next-line
	// ─── hardware detection ────────────────────────────────────────────────────

	private async _getHardwareInfo(): Promise<HardwareInfoResult> {
		const vramGB = await this._detectVramGB();

		let recommendedPack: ModelPackKey = 'fast';
		if (vramGB === null || vramGB < 8) {
			recommendedPack = 'minimal';
		} else if (vramGB >= 24) {
			recommendedPack = 'powerful';
		} else if (vramGB >= 16) {
			recommendedPack = 'balanced';
		} else if (vramGB >= 12) {
			recommendedPack = 'reasoning';
		} else {
			recommendedPack = 'fast';
		}

		return { vramGB, recommendedPack };
	}

	/**
	 * Best-effort VRAM detection across platforms.
	 * Returns null if detection is not possible (no GPU, or detection fails).
	 */
	private _detectVramGB(): Promise<number | null> {
		return new Promise(resolve => {
			const p = platform();

			if (p === 'darwin') {
				// Apple Silicon: `system_profiler SPDisplaysDataType` reports Metal GPU family
				// We approximate VRAM from unified memory (reported as GPU memory on M-series)
				execFile('system_profiler', ['SPDisplaysDataType'], { timeout: 5000 }, (err, stdout) => {
					if (err) { resolve(null); return; }
					const match = stdout.match(/VRAM.*?:\s*(\d+)\s*(MB|GB)/i);
					if (match) {
						const val = parseInt(match[1]);
						resolve(match[2].toUpperCase() === 'GB' ? val : Math.floor(val / 1024));
					} else {
						// Apple Silicon: use total RAM as proxy (unified memory)
						const ramMatch = stdout.match(/Memory:\s*(\d+)\s*GB/i);
						resolve(ramMatch ? parseInt(ramMatch[1]) : null);
					}
				});
				return;
			}

			if (p === 'linux') {
				execFile('nvidia-smi', ['--query-gpu=memory.total', '--format=csv,noheader,nounits'], { timeout: 5000 }, (err, stdout) => {
					if (!err) {
						const mb = parseInt(stdout.trim());
						if (!isNaN(mb)) { resolve(Math.floor(mb / 1024)); return; }
					}
					// AMD: try rocm-smi
					execFile('rocm-smi', ['--showmeminfo', 'vram'], { timeout: 5000 }, (err2, stdout2) => {
						if (!err2) {
							const match = stdout2.match(/Total Memory.*?:\s*(\d+)/i);
							if (match) { resolve(Math.floor(parseInt(match[1]) / 1024)); return; }
						}
						resolve(null);
					});
				});
				return;
			}

			if (p === 'win32') {
				execFile('powershell.exe', [
					'-NoProfile', '-Command',
					'(Get-WmiObject Win32_VideoController | Select-Object -First 1 AdapterRAM).AdapterRAM'
				], { timeout: 5000 }, (err, stdout) => {
					if (err) { resolve(null); return; }
					const bytes = parseInt(stdout.trim());
					resolve(!isNaN(bytes) ? Math.floor(bytes / (1024 ** 3)) : null);
				});
				return;
			}

			resolve(null);
		});
	}

	// allow-any-unicode-next-line
	// ─── model pull ────────────────────────────────────────────────────────────

	private async _pullModel(params: PullParams): Promise<void> {
		const { modelTag } = params;

		// Security: validate tag against allowlist before spawning
		if (!ALLOWED_MODEL_TAGS.has(modelTag as any)) {
			this._onLog.fire({ text: `[CortexIDE] Rejected unknown model tag: ${modelTag}` });
			this._onDone.fire({ ok: false });
			return;
		}

		// Wait for Ollama to be healthy (up to 30s)
		const ready = await this._waitForOllama(30);
		if (!ready) {
			this._onLog.fire({ text: '[CortexIDE] Ollama did not become ready in time; cannot pull model.' });
			this._onDone.fire({ ok: false });
			return;
		}

		this._onLog.fire({ text: `[CortexIDE] Pulling model: ${modelTag}` });

		// Use Ollama REST API for pull so we get progress events
		await this._pullViaAPI(modelTag);
	}

	private _pullViaAPI(modelTag: string): Promise<void> {
		return new Promise<void>((resolve) => {
			const body = JSON.stringify({ name: modelTag, stream: true });
			const req = http.request({
				hostname: '127.0.0.1',
				port: 11434,
				path: '/api/pull',
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
			}, (res) => {
				let buf = '';
				res.on('data', chunk => {
					buf += chunk.toString();
					const lines = buf.split('\n');
					buf = lines.pop() ?? '';
					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const evt = JSON.parse(line);
							const status: string = evt.status ?? '';
							const completed: number = evt.completed ?? 0;
							const total: number = evt.total ?? 0;
							const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

							this._onLog.fire({ text: `[CortexIDE] ${status}${total ? ` ${percent}%` : ''}` });
							this._onPullProgress.fire({ modelTag, percent, status });

							if (status === 'success') {
								this._onLog.fire({ text: `[CortexIDE] Model ${modelTag} ready.` });
								this._onDone.fire({ ok: true });
								resolve();
							}
						// allow-any-unicode-next-line
						} catch { /* partial JSON line — ignore */ }
					}
				});
				res.on('end', () => {
					this._onDone.fire({ ok: true });
					resolve();
				});
				res.on('error', err => {
					this._onLog.fire({ text: `[CortexIDE] Pull stream error: ${err.message}` });
					this._onDone.fire({ ok: false });
					resolve();
				});
			});
			req.on('error', err => {
				this._onLog.fire({ text: `[CortexIDE] Could not connect to Ollama: ${err.message}` });
				this._onDone.fire({ ok: false });
				resolve();
			});
			req.write(body);
			req.end();
		});
	}

	// allow-any-unicode-next-line
	// ─── health check ──────────────────────────────────────────────────────────

	private _isOllamaHealthy(): Promise<boolean> {
		return new Promise(resolve => {
			const req = http.get('http://127.0.0.1:11434/api/tags', { timeout: 3000 }, res => {
				resolve(res.statusCode === 200);
			});
			req.on('error', () => resolve(false));
			req.on('timeout', () => { req.destroy(); resolve(false); });
		});
	}

	private async _waitForOllama(timeoutSeconds: number): Promise<boolean> {
		const deadline = Date.now() + timeoutSeconds * 1000;
		while (Date.now() < deadline) {
			if (await this._isOllamaHealthy()) return true;
			await new Promise(r => setTimeout(r, 1000));
		}
		return false;
	}

	// allow-any-unicode-next-line
	// ─── Ollama installation ────────────────────────────────────────────────────

	private _install(params: InstallParams) {
		const p = platform();
		const isMac = p === 'darwin';
		const isWin = p === 'win32';
		const isLinux = !isMac && !isWin;

		if (isMac) {
			const script = [
				'set -e',
				'echo "[CortexIDE] macOS Ollama install starting..."',
				'if [ -d /Applications/Ollama.app ]; then',
				// allow-any-unicode-next-line
				'  echo "[CortexIDE] Found /Applications/Ollama.app — launching..."',
				'  open -a Ollama',
				'else',
				'  if [ -x /opt/homebrew/bin/brew ] || [ -x /usr/local/bin/brew ]; then',
				'    eval "$([ -x /opt/homebrew/bin/brew ] && /opt/homebrew/bin/brew shellenv || /usr/local/bin/brew shellenv)"',
				'  else',
				// allow-any-unicode-next-line
				'    echo "[CortexIDE] Homebrew not found — installing..."',
				'    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
				'    eval "$([ -x /opt/homebrew/bin/brew ] && /opt/homebrew/bin/brew shellenv || /usr/local/bin/brew shellenv)"',
				'  fi',
				'  echo "[CortexIDE] Installing Ollama via Homebrew Cask..."',
				'  brew install --cask ollama || true',
				'  open -a Ollama',
				'fi',
				'echo "[CortexIDE] Waiting for Ollama daemon..."',
				'for i in $(seq 1 15); do',
				'  curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && echo "[CortexIDE] Ollama is running." && exit 0',
				'  sleep 1',
				'done',
				// allow-any-unicode-next-line
				'echo "[CortexIDE] Ollama may still be starting — proceeding."',
			].join('\n');
			this._exec('/bin/bash', ['-lc', script]);
			return;
		}

		if (isLinux) {
			const script = [
				'set -e',
				'echo "[CortexIDE] Linux Ollama install starting..."',
				'curl -fsSL https://ollama.com/install.sh | sh',
				'(ollama serve >/dev/null 2>&1 &) || true',
				'echo "[CortexIDE] Waiting for Ollama daemon..."',
				'for i in $(seq 1 15); do',
				'  curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && echo "[CortexIDE] Ollama is running." && exit 0',
				'  sleep 1',
				'done',
				// allow-any-unicode-next-line
				'echo "[CortexIDE] Ollama may still be starting — proceeding."',
			].join('\n');
			this._exec('/bin/bash', ['-lc', script]);
			return;
		}

		// allow-any-unicode-next-line
		// Windows — only winget/choco, no string interpolation
		const ps = [
			'$ErrorActionPreference = "Stop"',
			'Write-Host "[CortexIDE] Windows Ollama install starting..."',
			'if (Get-Command winget -ErrorAction SilentlyContinue) {',
			'  winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements',
			'} elseif (Get-Command choco -ErrorAction SilentlyContinue) {',
			'  choco install ollama -y',
			'} else {',
			'  Write-Error "No package manager found. Install winget or Chocolatey first."',
			'}',
			'Start-Process -FilePath ollama -ArgumentList serve -WindowStyle Hidden',
			'Write-Host "[CortexIDE] Waiting for Ollama daemon..."',
			'$deadline = (Get-Date).AddSeconds(15)',
			'while ((Get-Date) -lt $deadline) {',
			'  try {',
			'    $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:11434/api/tags -TimeoutSec 2',
			'    if ($r.StatusCode -eq 200) { Write-Host "[CortexIDE] Ollama is running."; exit 0 }',
			'  } catch {}',
			'  Start-Sleep -Seconds 1',
			'}',
			// allow-any-unicode-next-line
			'Write-Host "[CortexIDE] Ollama may still be starting — proceeding."',
		].join('\n');
		this._exec('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
	}

	private _log(line: string) { this._onLog.fire({ text: line }); }

	private _exec(command: string, args: string[]) {
		const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		child.stdout.on('data', d => this._log(d.toString()));
		child.stderr.on('data', d => this._log(d.toString()));
		child.on('close', code => this._onDone.fire({ ok: code === 0 }));
		child.on('error', err => { this._log(`[CortexIDE] spawn error: ${String(err)}`); this._onDone.fire({ ok: false }); });
	}
}
