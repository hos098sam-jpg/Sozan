import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegStatic from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
const FFMPEG_BIN =
  typeof ffmpegStatic === 'string' && ffmpegStatic && fs.existsSync(ffmpegStatic)
    ? ffmpegStatic
    : 'ffmpeg';

// Persistent HTTPS Keep-Alive Agent to eliminate TCP + TLS handshake latency on every chunk upload/download
const githubHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 16,
  keepAliveMsecs: 30000,
});

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'github_hls_config.json');
const VIDEOS_DB_PATH = path.join(DATA_DIR, 'github_hls_videos.json');
const WORK_DIR = path.join('/tmp', 'gh_hls_work');

export const RAW_AES_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per encrypted chunk for instant <0.5s playback start

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });
} catch {}

export interface GitHubVaultShard {
  id: string;
  token: string;
  username: string;
  activeRepo: string;
  repoIndex: number;
  isPrimary?: boolean;
  videosCount?: number;
  totalSizeBytes?: number;
  status?: 'active' | 'rate_limited' | 'error';
  addedAt: string;
  lastUsedAt?: string;
}

export interface GitHubHlsConfig {
  token: string;
  username: string;
  activeRepo: string;
  repoIndex: number;
  connectedAt: string;
  shards?: GitHubVaultShard[];
  lastShardCursor?: number;
}

export interface GitHubHlsVideoRecord {
  videoId: string;
  title: string;
  durationSec: number;
  sizeBytes: number;
  keyBase64: string;
  ivHex: string;
  repoOwner: string;
  repoName: string;
  releaseTag: string;
  releaseId: number;
  storageMode?: 'hls' | 'node-aes128';
  rawChunkSize?: number;
  m3u8Template: string;
  segments: Record<string, { downloadUrl: string; assetId: number; size: number; rawSize?: number }>;
  createdAt: string;
}

// High-Concurrency Shared RAM LRU Cache (up to 96 MB) + In-Flight Request Coalescing
// So if 500 students watch at the same time, GitHub is called ONCE and AES-128 decryption runs ONCE!
const MAX_RAM_CACHE_BYTES = 96 * 1024 * 1024; // 96 MB max RAM budget
let currentCacheBytes = 0;
const decryptedChunkCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const inFlightChunkPromises = new Map<string, Promise<Buffer>>();

function getCachedDecryptedChunk(cacheKey: string): Buffer | null {
  const entry = decryptedChunkCache.get(cacheKey);
  if (!entry) return null;
  entry.timestamp = Date.now();
  return entry.buffer;
}

function setCachedDecryptedChunk(cacheKey: string, buffer: Buffer): void {
  const existing = decryptedChunkCache.get(cacheKey);
  if (existing) {
    currentCacheBytes -= existing.buffer.byteLength;
    decryptedChunkCache.delete(cacheKey);
  }

  while (
    decryptedChunkCache.size > 0 &&
    currentCacheBytes + buffer.byteLength > MAX_RAM_CACHE_BYTES
  ) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [k, v] of decryptedChunkCache.entries()) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      const removed = decryptedChunkCache.get(oldestKey);
      if (removed) currentCacheBytes -= removed.buffer.byteLength;
      decryptedChunkCache.delete(oldestKey);
    } else {
      break;
    }
  }

  decryptedChunkCache.set(cacheKey, { buffer, timestamp: Date.now() });
  currentCacheBytes += buffer.byteLength;
}

export function generateStealthRepoName(
  username?: string,
  repoIndex: number = 1,
  token?: string
): string {
  const cleanUser = String(username || 'hos098sam-jpg').trim().toLowerCase();
  const idx = Number(repoIndex || 1);
  if (cleanUser === 'hos098sam-jpg' && idx <= 1) {
    return 'x3bb48b-c76c300b';
  }
  const seed = `stealth:${cleanUser}:${idx}:${String(token || 'qalb').trim().slice(0, 12)}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `x${hash.slice(0, 6)}-${hash.slice(6, 14)}`;
}

export function isIdentifiableRepoName(name?: string): boolean {
  if (!name || typeof name !== 'string') return true;
  const lower = name.trim().toLowerCase();
  return (
    lower.length < 4 ||
    lower.includes('qalb') ||
    lower.includes('hls') ||
    lower.includes('vault') ||
    lower.includes('video') ||
    lower.includes('elm')
  );
}

export function getGitHubHlsConfig(): GitHubHlsConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (parsed && parsed.token && parsed.username) {
        let mutated = false;
        if (isIdentifiableRepoName(parsed.activeRepo)) {
          parsed.activeRepo = generateStealthRepoName(
            parsed.username,
            parsed.repoIndex || 1,
            parsed.token
          );
          mutated = true;
        }
        if (Array.isArray(parsed.shards)) {
          for (const s of parsed.shards) {
            if (isIdentifiableRepoName(s.activeRepo)) {
              s.activeRepo =
                s.username?.toLowerCase() === parsed.username?.toLowerCase()
                  ? parsed.activeRepo
                  : generateStealthRepoName(s.username, s.repoIndex || 1, s.token);
              mutated = true;
            }
          }
        }
        if (mutated) {
          saveGitHubHlsConfig(parsed);
        }
        return parsed;
      }
    }
  } catch {}
  return {
    token: process.env.GITHUB_VAULT_TOKEN || process.env.VITE_GITHUB_TOKEN || '',
    username: 'hos098sam-jpg',
    activeRepo: 'x3bb48b-c76c300b',
    repoIndex: 1,
    connectedAt: '2026-10-31T22:47:17.796Z',
  };
}

export function saveGitHubHlsConfig(cfg: GitHubHlsConfig): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    console.error('[GitHub HLS Config Save Error]:', err);
  }
}

export function getAllGitHubHlsVideos(): Record<string, GitHubHlsVideoRecord> {
  try {
    if (fs.existsSync(VIDEOS_DB_PATH)) {
      return JSON.parse(fs.readFileSync(VIDEOS_DB_PATH, 'utf-8')) || {};
    }
  } catch {}
  return {};
}

export function getGitHubHlsVideo(videoId: string): GitHubHlsVideoRecord | null {
  const all = getAllGitHubHlsVideos();
  return all[videoId] || null;
}

export function saveGitHubHlsVideo(record: GitHubHlsVideoRecord): void {
  try {
    const all = getAllGitHubHlsVideos();
    all[record.videoId] = record;
    fs.writeFileSync(VIDEOS_DB_PATH, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.error('[GitHub HLS Video DB Save Error]:', err);
  }
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Node-Octet-Sync/2.0',
  };
}

/**
 * Resolves the appropriate GitHub Personal Access Token for a specific repository owner
 * across the primary account and all auto-sharded secondary accounts.
 */
export function resolveTokenForOwner(repoOwner: string, cfg?: GitHubHlsConfig | null): string {
  const activeCfg = cfg || getGitHubHlsConfig();
  if (!activeCfg) return '';
  const target = String(repoOwner || '').trim().toLowerCase();
  if (target && Array.isArray(activeCfg.shards)) {
    const matchedShard = activeCfg.shards.find(
      (s) => s.token && String(s.username || '').trim().toLowerCase() === target
    );
    if (matchedShard) return matchedShard.token.trim();
  }
  return (activeCfg.token || '').trim();
}

export function getAuthenticatedSegmentRequestConfig(
  video: GitHubHlsVideoRecord,
  segName: string
): { url: string; headers: Record<string, string> } | null {
  const seg = video?.segments?.[segName];
  if (!seg) return null;
  const cfg = getGitHubHlsConfig();
  const ownerToken = resolveTokenForOwner(video.repoOwner, cfg);

  // If we have assetId and token, use GitHub API with Accept: application/octet-stream
  // This works 100% identically whether the repository is Private OR Public across any shard account!
  if (seg.assetId && ownerToken) {
    return {
      url: `https://api.github.com/repos/${encodeURIComponent(video.repoOwner)}/${encodeURIComponent(video.repoName)}/releases/assets/${seg.assetId}`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        Accept: 'application/octet-stream',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Node-Octet-Sync/2.0',
      },
    };
  }

  if (seg.downloadUrl) {
    const headers: Record<string, string> = {
      'User-Agent': 'Node-Octet-Sync/2.0',
    };
    if (ownerToken) {
      headers.Authorization = `Bearer ${ownerToken}`;
    }
    return { url: seg.downloadUrl, headers };
  }

  return null;
}

/**
 * Syncs the encrypted `vault_db.json` and a meaningless opaque `README.md` into the repository
 * so deployed Cloud Run containers can recover the encrypted index while revealing zero info publicly.
 */
export async function syncCatalogToGitHubRepo(cfg: GitHubHlsConfig): Promise<void> {
  try {
    const allVideos = getAllGitHubHlsVideos();

    // 1. Keep README.md completely opaque with a random hash (no platform name, no titles, no explanation)
    const opaqueHash = crypto
      .createHash('sha256')
      .update(`${cfg.activeRepo}:${Object.keys(allVideos).length}`)
      .digest('hex')
      .slice(0, 16);
    const readmeContent = `# ${cfg.activeRepo}\n\n\`${opaqueHash}\`\n`;

    await upsertGitHubRepoFile(
      cfg.token,
      cfg.username,
      cfg.activeRepo,
      'README.md',
      readmeContent,
      `sync ${opaqueHash.slice(0, 7)}`
    );

    // 2. Sync vault_db.json (AES-256-CBC encrypted with token hash so nothing is readable publicly)
    const masterKey = crypto.createHash('sha256').update(cfg.token.trim()).digest();
    const dbIv = crypto.randomBytes(16);
    const dbCipher = crypto.createCipheriv('aes-256-cbc', masterKey, dbIv);
    const rawJson = JSON.stringify(allVideos);
    const encDb = Buffer.concat([dbCipher.update(rawJson, 'utf-8'), dbCipher.final()]).toString('base64');
    const vaultPayload = JSON.stringify({ encrypted: true, iv: dbIv.toString('hex'), payload: encDb }, null, 2);

    await upsertGitHubRepoFile(
      cfg.token,
      cfg.username,
      cfg.activeRepo,
      'vault_db.json',
      vaultPayload,
      `sync ${opaqueHash.slice(0, 7)}`
    );

    // Keep legacy vault_db.json in sync as well so any instance checking either repo sees all videos
    if (cfg.activeRepo !== 'qalbelm-hls-vault-1') {
      upsertGitHubRepoFile(
        cfg.token,
        cfg.username,
        'qalbelm-hls-vault-1',
        'vault_db.json',
        vaultPayload,
        `sync ${opaqueHash.slice(0, 7)}`
      ).catch(() => {});
    }
  } catch (err: any) {
    console.warn('[GitHub Catalog Sync Notice]:', err?.message || err);
  }
}

async function upsertGitHubRepoFile(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  contentUtf8: string,
  commitMessage: string
): Promise<void> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath}`;
  let sha: string | undefined;

  const getRes = await axios.get(url, {
    headers: ghHeaders(token),
    timeout: 10000,
    validateStatus: () => true,
  });
  if (getRes.status === 200 && getRes.data?.sha) {
    sha = getRes.data.sha;
  }

  await axios.put(
    url,
    {
      message: commitMessage,
      content: Buffer.from(contentUtf8, 'utf-8').toString('base64'),
      ...(sha ? { sha } : {}),
    },
    {
      headers: ghHeaders(token),
      timeout: 15000,
      validateStatus: () => true,
    }
  );
}

/**
 * Restores missing video metadata from `vault_db.json` across both the active stealth repository
 * and any legacy vault repositories so pre-existing and newly uploaded videos always work seamlessly.
 */
export async function ensureGitHubHlsVideoLoaded(videoId: string): Promise<GitHubHlsVideoRecord | null> {
  if (videoId !== '__init__') {
    const local = getGitHubHlsVideo(videoId);
    if (local) return local;
  }

  const cfg = getGitHubHlsConfig();
  if (!cfg || !cfg.token || !cfg.username) return null;

  const candidateRepos = Array.from(
    new Set(
      [
        cfg.activeRepo,
        'x3bb48b-c76c300b',
        'qalbelm-hls-vault-1',
        ...(Array.isArray(cfg.shards) ? cfg.shards.map((s) => s.activeRepo) : []),
      ].filter(Boolean)
    )
  );

  let merged = { ...getAllGitHubHlsVideos() };
  let updated = false;

  await Promise.all(
    candidateRepos.map(async (repoName) => {
      try {
        const url = `https://api.github.com/repos/${encodeURIComponent(cfg.username)}/${encodeURIComponent(repoName)}/contents/vault_db.json`;
        const res = await axios.get(url, {
          headers: ghHeaders(cfg.token),
          timeout: 10000,
          validateStatus: () => true,
        });
        if (res.status === 200 && res.data?.content) {
          const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          let remoteDb: Record<string, GitHubHlsVideoRecord> | null = null;

          if (parsed && parsed.encrypted && parsed.iv && parsed.payload) {
            const masterKey = crypto.createHash('sha256').update(cfg.token.trim()).digest();
            const decipher = crypto.createDecipheriv(
              'aes-256-cbc',
              masterKey,
              Buffer.from(parsed.iv, 'hex')
            );
            const decryptedJson = Buffer.concat([
              decipher.update(Buffer.from(parsed.payload, 'base64')),
              decipher.final(),
            ]).toString('utf-8');
            remoteDb = JSON.parse(decryptedJson);
          } else if (parsed && typeof parsed === 'object') {
            remoteDb = parsed;
          }

          if (remoteDb && typeof remoteDb === 'object') {
            merged = { ...remoteDb, ...merged };
            for (const [k, v] of Object.entries(remoteDb)) {
              if (
                !merged[k] ||
                Object.keys(v?.segments || {}).length >= Object.keys(merged[k]?.segments || {}).length
              ) {
                merged[k] = v;
              }
            }
            updated = true;
          }
        }
      } catch {}
    })
  );

  if (updated) {
    try {
      fs.writeFileSync(VIDEOS_DB_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    } catch {}
  }

  return videoId === '__init__' ? null : (merged[videoId] || null);
}

export interface PlatformCloudVaultSnapshot {
  updatedAt: string;
  courses?: any[];
  users?: any[];
  exams?: any[];
  submissions?: any[];
  deletedIds?: any;
  settings?: any;
  walletCodes?: any[];
  bundles?: any[];
  lessonQa?: any[];
}

export async function savePlatformStateToCloudVault(state: PlatformCloudVaultSnapshot): Promise<boolean> {
  const cfg = getGitHubHlsConfig();
  if (!cfg || !cfg.token || !cfg.username) return false;

  try {
    const masterKey = crypto.createHash('sha256').update(cfg.token.trim()).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', masterKey, iv);
    const jsonStr = JSON.stringify({
      ...state,
      updatedAt: state.updatedAt || new Date().toISOString(),
    });
    const encryptedPayload = Buffer.concat([
      cipher.update(Buffer.from(jsonStr, 'utf-8')),
      cipher.final(),
    ]).toString('base64');

    const fileContent = JSON.stringify(
      { encrypted: true, iv: iv.toString('hex'), payload: encryptedPayload, updatedAt: new Date().toISOString() },
      null,
      2
    );

    await upsertGitHubRepoFile(
      cfg.token,
      cfg.username,
      cfg.activeRepo,
      'platform_db_vault.json',
      fileContent,
      `sync state`
    );
    return true;
  } catch (err: any) {
    console.warn('[Cloud Vault State Save Notice]:', err?.message || err);
    return false;
  }
}

export async function loadPlatformStateFromCloudVault(): Promise<PlatformCloudVaultSnapshot | null> {
  const cfg = getGitHubHlsConfig();
  if (!cfg || !cfg.token || !cfg.username) return null;

  const candidateRepos = Array.from(
    new Set([cfg.activeRepo, 'x3bb48b-c76c300b', 'qalbelm-hls-vault-1'].filter(Boolean))
  );

  let newestSnapshot: PlatformCloudVaultSnapshot | null = null;
  let newestTs = 0;

  await Promise.all(
    candidateRepos.map(async (repoName) => {
      try {
        const url = `https://api.github.com/repos/${encodeURIComponent(cfg.username)}/${encodeURIComponent(repoName)}/contents/platform_db_vault.json`;
        const res = await axios.get(url, {
          headers: ghHeaders(cfg.token),
          timeout: 10000,
          validateStatus: () => true,
        });
        if (res.status === 200 && res.data?.content) {
          const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          let snapshot: PlatformCloudVaultSnapshot | null = null;
          if (parsed && parsed.encrypted && parsed.iv && parsed.payload) {
            const masterKey = crypto.createHash('sha256').update(cfg.token.trim()).digest();
            const decipher = crypto.createDecipheriv(
              'aes-256-cbc',
              masterKey,
              Buffer.from(parsed.iv, 'hex')
            );
            const decryptedJson = Buffer.concat([
              decipher.update(Buffer.from(parsed.payload, 'base64')),
              decipher.final(),
            ]).toString('utf-8');
            const decObj = JSON.parse(decryptedJson);
            if (decObj && typeof decObj === 'object') {
              snapshot = decObj as PlatformCloudVaultSnapshot;
            }
          } else if (parsed && typeof parsed === 'object') {
            snapshot = parsed as PlatformCloudVaultSnapshot;
          }

          if (snapshot) {
            const ts = new Date(snapshot.updatedAt || parsed.updatedAt || 0).getTime() || 0;
            if (!newestSnapshot || ts >= newestTs) {
              newestSnapshot = snapshot;
              newestTs = ts;
            }
          }
        }
      } catch {}
    })
  );

  return newestSnapshot;
}

export async function hydrateGitHubVaultOnStartup(): Promise<void> {
  try {
    await ensureGitHubHlsVideoLoaded('__init__');
  } catch {}
}

setTimeout(() => {
  hydrateGitHubVaultOnStartup().catch(() => {});
}, 500);

/**
 * Verifies a GitHub Personal Access Token, fetches the owner's username,
 * and ensures the initial vault repository (qalbelm-hls-vault-1) exists.
 */
export async function connectGitHubHlsAccount(rawToken: string): Promise<{
  success: boolean;
  username?: string;
  activeRepo?: string;
  repoUrl?: string;
  message: string;
}> {
  const token = String(rawToken || '').trim();
  if (!token) {
    return { success: false, message: 'يرجى إدخال مفتاح الربط السري أولاً.' };
  }

  try {
    const userRes = await axios.get('https://api.github.com/user', {
      headers: ghHeaders(token),
      timeout: 10000,
      validateStatus: () => true,
    });

    if (userRes.status !== 200 || !userRes.data?.login) {
      return {
        success: false,
        message: 'المفتاح السري غير صالح أو منتهي الصلاحية.',
      };
    }

    const username = userRes.data.login;
    const existingCfg = getGitHubHlsConfig();
    const repoIndex = existingCfg?.repoIndex || 1;
    const activeRepo =
      existingCfg?.activeRepo && !isIdentifiableRepoName(existingCfg.activeRepo)
        ? existingCfg.activeRepo
        : generateStealthRepoName();

    await ensureVaultRepoExists(token, username, activeRepo);

    const existingShards = Array.isArray(existingCfg?.shards) ? existingCfg!.shards : [];
    const primaryShard: GitHubVaultShard = {
      id: `shard_${username.toLowerCase()}`,
      token,
      username,
      activeRepo,
      repoIndex,
      isPrimary: true,
      status: 'active',
      addedAt: new Date().toISOString(),
    };
    const mergedShards = [
      primaryShard,
      ...existingShards.filter((s) => s.username.toLowerCase() !== username.toLowerCase()),
    ];

    const newCfg: GitHubHlsConfig = {
      token,
      username,
      activeRepo,
      repoIndex,
      connectedAt: new Date().toISOString(),
      shards: mergedShards,
      lastShardCursor: existingCfg?.lastShardCursor || 0,
    };
    saveGitHubHlsConfig(newCfg);

    // Pull any existing vault_db.json from the repo and update opaque sync state
    await ensureGitHubHlsVideoLoaded('__init__');
    syncCatalogToGitHubRepo(newCfg).catch(() => {});

    return {
      success: true,
      username,
      activeRepo,
      repoUrl: `https://github.com/${username}/${activeRepo}`,
      message: `تم تفعيل المخزن السحابي المشفر بنجاح! 🚀`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `تعذر الاتصال بالسحابة المشفرة: ${err?.message || 'خطأ في الشبكة'}`,
    };
  }
}

/**
 * AUTO-SHARDING PROVISIONING ENGINE:
 * Automatically verifies, initializes, and provisions one or multiple secondary GitHub accounts
 * with random, unidentifiable public repository names and registers them in the active shard pool.
 */
export async function autoInitializeVaultShards(rawTokensInput: string[] | string): Promise<{
  success: boolean;
  initializedCount: number;
  failedCount: number;
  shards: Array<{
    id: string;
    username: string;
    activeRepo: string;
    repoIndex: number;
    isPrimary: boolean;
    videosCount: number;
    totalSizeMB: number;
    status: string;
    repoUrl: string;
  }>;
  errors: string[];
  message: string;
}> {
  const tokenList = (
    Array.isArray(rawTokensInput)
      ? rawTokensInput
      : String(rawTokensInput || '').split(/[\r\n,;]+/)
  )
    .map((t) => String(t || '').trim())
    .filter((t) => t.length >= 10);

  if (tokenList.length === 0) {
    return {
      success: false,
      initializedCount: 0,
      failedCount: 0,
      shards: getFormattedShardsSummary(),
      errors: ['يرجى إدخال مفتاح سري واحد على الأقل لتهيئة الحسابات الثانوية.'],
      message: 'يرجى إدخال مفتاح سري واحد على الأقل لتهيئة الحسابات الثانوية.',
    };
  }

  let cfg = getGitHubHlsConfig();
  const errors: string[] = [];
  let initializedCount = 0;

  const existingShards: GitHubVaultShard[] = Array.isArray(cfg?.shards) ? [...cfg!.shards!] : [];
  if (cfg && cfg.token && cfg.username) {
    const hasPrimary = existingShards.some(
      (s) => s.username.toLowerCase() === cfg!.username.toLowerCase()
    );
    if (!hasPrimary) {
      existingShards.unshift({
        id: `shard_${cfg.username.toLowerCase()}`,
        token: cfg.token,
        username: cfg.username,
        activeRepo:
          cfg.activeRepo && !isIdentifiableRepoName(cfg.activeRepo)
            ? cfg.activeRepo
            : generateStealthRepoName(),
        repoIndex: cfg.repoIndex || 1,
        isPrimary: true,
        status: 'active',
        addedAt: cfg.connectedAt || new Date().toISOString(),
      });
    }
  }

  // Provision all provided tokens in parallel
  await Promise.all(
    tokenList.map(async (token) => {
      try {
        const userRes = await axios.get('https://api.github.com/user', {
          headers: ghHeaders(token),
          httpsAgent: githubHttpsAgent,
          timeout: 12000,
          validateStatus: () => true,
        });

        if (userRes.status !== 200 || !userRes.data?.login) {
          errors.push(`مفتاح غير صالح (${token.slice(0, 7)}...): HTTP ${userRes.status}`);
          return;
        }

        const username = String(userRes.data.login).trim();
        const existingIdx = existingShards.findIndex(
          (s) => s.username.toLowerCase() === username.toLowerCase()
        );
        const repoIndex = existingIdx >= 0 ? existingShards[existingIdx].repoIndex || 1 : 1;
        const existingRepoName = existingIdx >= 0 ? existingShards[existingIdx].activeRepo : '';
        const initialRepo =
          existingRepoName && !isIdentifiableRepoName(existingRepoName)
            ? existingRepoName
            : generateStealthRepoName();

        const verifiedRepo = await ensureVaultRepoExistsForShard(
          token,
          username,
          initialRepo,
          repoIndex
        );

        const shardObj: GitHubVaultShard = {
          id: `shard_${username.toLowerCase()}`,
          token,
          username,
          activeRepo: verifiedRepo.repoName,
          repoIndex: verifiedRepo.repoIndex,
          isPrimary: cfg ? cfg.username.toLowerCase() === username.toLowerCase() : existingShards.length === 0,
          status: 'active',
          addedAt:
            existingIdx >= 0
              ? existingShards[existingIdx].addedAt
              : new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          existingShards[existingIdx] = shardObj;
        } else {
          existingShards.push(shardObj);
        }

        if (!cfg || !cfg.token || !cfg.username) {
          cfg = {
            token,
            username,
            activeRepo: verifiedRepo.repoName,
            repoIndex: verifiedRepo.repoIndex,
            connectedAt: new Date().toISOString(),
            shards: existingShards,
            lastShardCursor: 0,
          };
        }
        initializedCount++;
      } catch (err: any) {
        errors.push(`فشل تهيئة الحساب (${token.slice(0, 7)}...): ${err?.message || 'خطأ شبكة'}`);
      }
    })
  );

  if (cfg) {
    cfg.shards = existingShards;
    saveGitHubHlsConfig(cfg);
  }

  const summary = getFormattedShardsSummary();
  return {
    success: initializedCount > 0,
    initializedCount,
    failedCount: errors.length,
    shards: summary,
    errors,
    message:
      initializedCount > 0
        ? `تم تهيئة وربط ${initializedCount} حساب سحابي في منظومة التوزيع التلقائي (Auto-Sharding) بنجاح! إجمالي الحسابات النشطة: ${summary.length} 🚀`
        : errors[0] || 'تعذر تهيئة الحسابات الثانوية.',
  };
}

export function removeVaultShard(shardUsername: string): {
  success: boolean;
  shards: ReturnType<typeof getFormattedShardsSummary>;
  message: string;
} {
  const cfg = getGitHubHlsConfig();
  if (!cfg) {
    return { success: false, shards: [], message: 'لا توجد إعدادات مخزن سحابي.' };
  }
  const target = String(shardUsername || '').trim().toLowerCase();
  if (cfg.username.toLowerCase() === target) {
    return {
      success: false,
      shards: getFormattedShardsSummary(),
      message: 'لا يمكن حذف الحساب الأساسي. يمكنك تغييره عبر لصق مفتاح جديد.',
    };
  }
  cfg.shards = (cfg.shards || []).filter((s) => s.username.toLowerCase() !== target);
  saveGitHubHlsConfig(cfg);
  return {
    success: true,
    shards: getFormattedShardsSummary(),
    message: `تم إزالة الحساب الثانوي (${shardUsername}) من التوزيع التلقائي.`,
  };
}

export function getFormattedShardsSummary() {
  const cfg = getGitHubHlsConfig();
  if (!cfg || !cfg.username) return [];
  const allVideos = Object.values(getAllGitHubHlsVideos());

  const rawShards: GitHubVaultShard[] =
    Array.isArray(cfg.shards) && cfg.shards.length > 0
      ? cfg.shards
      : [
          {
            id: `shard_${cfg.username.toLowerCase()}`,
            token: cfg.token,
            username: cfg.username,
            activeRepo: cfg.activeRepo || generateStealthRepoName(),
            repoIndex: cfg.repoIndex || 1,
            isPrimary: true,
            status: 'active',
            addedAt: cfg.connectedAt || new Date().toISOString(),
          },
        ];

  return rawShards.map((s) => {
    const ownerVids = allVideos.filter(
      (v) => String(v.repoOwner || '').toLowerCase() === s.username.toLowerCase()
    );
    const totalBytes = ownerVids.reduce((acc, v) => acc + (Number(v.sizeBytes) || 0), 0);
    const repoName = s.activeRepo || cfg.activeRepo;
    return {
      id: s.id || `shard_${s.username.toLowerCase()}`,
      username: s.username,
      activeRepo: repoName,
      repoIndex: s.repoIndex || 1,
      isPrimary: Boolean(s.isPrimary || s.username.toLowerCase() === cfg.username.toLowerCase()),
      videosCount: ownerVids.length,
      totalSizeMB: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
      status: s.status || 'active',
      repoUrl: `https://github.com/${s.username}/${repoName}`,
    };
  });
}

async function ensureVaultRepoExistsForShard(
  token: string,
  username: string,
  repoName: string,
  currentIndex: number
): Promise<{ repoName: string; repoIndex: number }> {
  const effectiveRepo = isIdentifiableRepoName(repoName) ? generateStealthRepoName() : repoName;
  const cacheKey = `${username}/${effectiveRepo}`;
  const cached = verifiedRepoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { repoName: cached.repoName, repoIndex: currentIndex };
  }

  const allVideos = Object.values(getAllGitHubHlsVideos());
  const videosInThisRepo = allVideos.filter(
    (v) =>
      String(v.repoOwner || '').toLowerCase() === username.toLowerCase() &&
      String(v.repoName || '').toLowerCase() === effectiveRepo.toLowerCase()
  );
  const repoTotalBytes = videosInThisRepo.reduce((acc, v) => acc + (Number(v.sizeBytes) || 0), 0);

  // Auto-rotate to a new random stealth repository if current repo has >= 35 videos or >= 1.5 GB
  if (videosInThisRepo.length >= 35 || repoTotalBytes > 1500 * 1024 * 1024) {
    const nextIdx = currentIndex + 1;
    const nextRepo = generateStealthRepoName();
    return ensureVaultRepoExistsForShard(token, username, nextRepo, nextIdx);
  }

  const checkRes = await axios.get(
    `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(effectiveRepo)}`,
    {
      headers: ghHeaders(token),
      httpsAgent: githubHttpsAgent,
      timeout: 10000,
      validateStatus: () => true,
    }
  );

  if (checkRes.status === 200 && checkRes.data) {
    const sizeKb = Number(checkRes.data.size || 0);
    if (sizeKb > 1600000) {
      const nextIdx = currentIndex + 1;
      const nextRepo = generateStealthRepoName();
      return ensureVaultRepoExistsForShard(token, username, nextRepo, nextIdx);
    }
    // Ensure repository is always Public with an empty description
    if (checkRes.data.private === true || checkRes.data.description) {
      axios
        .patch(
          `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(effectiveRepo)}`,
          { private: false, description: '' },
          { headers: ghHeaders(token), httpsAgent: githubHttpsAgent, timeout: 10000, validateStatus: () => true }
        )
        .catch(() => {});
    }
    verifiedRepoCache.set(cacheKey, { repoName: effectiveRepo, expiresAt: Date.now() + 3 * 60 * 1000 });
    return { repoName: effectiveRepo, repoIndex: currentIndex };
  }

  const createRes = await axios.post(
    'https://api.github.com/user/repos',
    {
      name: effectiveRepo,
      description: '',
      private: false,
      auto_init: true,
    },
    {
      headers: ghHeaders(token),
      httpsAgent: githubHttpsAgent,
      timeout: 15000,
      validateStatus: () => true,
    }
  );

  if (createRes.status !== 201 && createRes.status !== 200 && createRes.status !== 422) {
    throw new Error(`فشل تهيئة المخزن السحابي المشفر (${createRes.status}).`);
  }

  verifiedRepoCache.set(cacheKey, { repoName: effectiveRepo, expiresAt: Date.now() + 3 * 60 * 1000 });
  return { repoName: effectiveRepo, repoIndex: currentIndex };
}

/**
 * Selects the optimal GitHub account & repository shard automatically using
 * Least-Loaded + Round-Robin balancing across all configured accounts.
 */
export async function selectOptimalVaultShard(): Promise<{
  token: string;
  username: string;
  activeRepo: string;
  repoIndex: number;
}> {
  const cfg = getGitHubHlsConfig();
  if (!cfg || !cfg.token || !cfg.username) {
    throw new Error('المخزن السحابي المشفر غير مربوط بعد.');
  }

  const shards: GitHubVaultShard[] =
    Array.isArray(cfg.shards) && cfg.shards.length > 0
      ? cfg.shards.filter((s) => s.token && s.username && s.status !== 'error')
      : [
          {
            id: `shard_${cfg.username.toLowerCase()}`,
            token: cfg.token,
            username: cfg.username,
            activeRepo: cfg.activeRepo,
            repoIndex: cfg.repoIndex || 1,
            isPrimary: true,
            status: 'active',
            addedAt: cfg.connectedAt || new Date().toISOString(),
          },
        ];

  const allVideos = Object.values(getAllGitHubHlsVideos());

  // Score each shard by total videos stored + round-robin cursor tie-breaker
  const cursor = ((cfg.lastShardCursor || 0) + 1) % Math.max(1, shards.length);
  cfg.lastShardCursor = cursor;

  const scored = shards.map((s, idx) => {
    const ownerVideos = allVideos.filter(
      (v) => String(v.repoOwner || '').toLowerCase() === s.username.toLowerCase()
    );
    const totalBytes = ownerVideos.reduce((acc, v) => acc + (Number(v.sizeBytes) || 0), 0);
    const rrBonus = idx === cursor ? -0.5 : 0;
    return {
      shard: s,
      score: ownerVideos.length + totalBytes / (500 * 1024 * 1024) + rrBonus,
    };
  });

  scored.sort((a, b) => a.score - b.score);

  for (const candidate of scored) {
    const s = candidate.shard;
    try {
      const verified = await ensureVaultRepoExistsForShard(
        s.token,
        s.username,
        s.activeRepo || generateStealthRepoName(),
        s.repoIndex || 1
      );
      s.activeRepo = verified.repoName;
      s.repoIndex = verified.repoIndex;
      s.lastUsedAt = new Date().toISOString();
      s.status = 'active';
      if (s.username.toLowerCase() === cfg.username.toLowerCase()) {
        cfg.activeRepo = verified.repoName;
        cfg.repoIndex = verified.repoIndex;
      }
      saveGitHubHlsConfig(cfg);
      return {
        token: s.token,
        username: s.username,
        activeRepo: verified.repoName,
        repoIndex: verified.repoIndex,
      };
    } catch {
      s.status = 'rate_limited';
    }
  }

  // Fallback to primary account
  const fallbackRepo = await ensureVaultRepoExists(cfg.token, cfg.username, cfg.activeRepo);
  return {
    token: cfg.token,
    username: cfg.username,
    activeRepo: fallbackRepo,
    repoIndex: cfg.repoIndex || 1,
  };
}

// Cache verified vault repository for 3 minutes to avoid an extra GitHub API roundtrip on every single video upload
const verifiedRepoCache = new Map<string, { repoName: string; expiresAt: number }>();

/**
 * Ensures a public vault repository with a random stealth name exists and automatically scales
 * to a new random repository name if the current repository exceeds ~1.8 GB.
 */
export async function ensureVaultRepoExists(
  token: string,
  username: string,
  repoName: string
): Promise<string> {
  const effectiveRepo = isIdentifiableRepoName(repoName) ? generateStealthRepoName() : repoName;
  const cacheKey = `${username}/${effectiveRepo}`;
  const cached = verifiedRepoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.repoName;
  }

  const checkRes = await axios.get(
    `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(effectiveRepo)}`,
    {
      headers: ghHeaders(token),
      httpsAgent: githubHttpsAgent,
      timeout: 10000,
      validateStatus: () => true,
    }
  );

  if (checkRes.status === 200 && checkRes.data) {
    const sizeKb = Number(checkRes.data.size || 0);
    if (sizeKb > 1800000) {
      const cfg = getGitHubHlsConfig();
      const nextIndex = (cfg?.repoIndex || 1) + 1;
      const nextRepo = generateStealthRepoName();
      if (cfg) {
        cfg.repoIndex = nextIndex;
        cfg.activeRepo = nextRepo;
        saveGitHubHlsConfig(cfg);
      }
      return ensureVaultRepoExists(token, username, nextRepo);
    }
    if (checkRes.data.private === true || checkRes.data.description) {
      axios
        .patch(
          `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(effectiveRepo)}`,
          { private: false, description: '' },
          { headers: ghHeaders(token), httpsAgent: githubHttpsAgent, timeout: 10000, validateStatus: () => true }
        )
        .catch(() => {});
    }
    verifiedRepoCache.set(cacheKey, { repoName: effectiveRepo, expiresAt: Date.now() + 3 * 60 * 1000 });
    return effectiveRepo;
  }

  const createRes = await axios.post(
    'https://api.github.com/user/repos',
    {
      name: effectiveRepo,
      description: '',
      private: false,
      auto_init: true,
    },
    {
      headers: ghHeaders(token),
      httpsAgent: githubHttpsAgent,
      timeout: 15000,
      validateStatus: () => true,
    }
  );

  if (createRes.status !== 201 && createRes.status !== 200 && createRes.status !== 422) {
    throw new Error(
      `فشل تهيئة المخزن السحابي المشفر (${createRes.status}).`
    );
  }

  verifiedRepoCache.set(cacheKey, { repoName: effectiveRepo, expiresAt: Date.now() + 3 * 60 * 1000 });
  return effectiveRepo;
}

// Multi-Teacher Upload Queue: Allows up to 4 concurrent FFmpeg + Cloud Vault encryption jobs
const MAX_CONCURRENT_ENCODING_JOBS = 4;
let activeEncodingJobs = 0;
const encodingWaitQueue: Array<() => void> = [];

async function acquireEncodingSlot(onWaiting?: (queuePos: number) => void): Promise<void> {
  if (activeEncodingJobs < MAX_CONCURRENT_ENCODING_JOBS) {
    activeEncodingJobs++;
    return;
  }
  const queuePos = encodingWaitQueue.length + 1;
  onWaiting?.(queuePos);
  await new Promise<void>((resolve) => {
    encodingWaitQueue.push(resolve);
  });
  activeEncodingJobs++;
}

function releaseEncodingSlot(): void {
  activeEncodingJobs = Math.max(0, activeEncodingJobs - 1);
  const next = encodingWaitQueue.shift();
  if (next) next();
}

/**
 * Slices an MP4 video into AES-128 encrypted segments (uses FFmpeg if available,
 * or automatically falls back to Pure Node.js AES-128-CBC chunk encryption when
 * running on serverless Cloud Run containers without FFmpeg installed),
 * uploads all encrypted segments to a GitHub Release in the active vault repo,
 * updates the repo README catalog, and deletes the local video immediately (0 MB on server).
 */
export async function processAndUploadVideoToGitHubHls(params: {
  sourceFilePath: string;
  title: string;
  videoId?: string;
  onProgress?: (stage: string, percent: number) => void;
  onBackgroundSyncComplete?: () => void;
}): Promise<{
  success: boolean;
  videoId: string;
  masterPlaylistUrl: string;
  durationSec: number;
  segmentCount: number;
  repoName: string;
  repoUrl: string;
}> {
  const cfg = getGitHubHlsConfig();
  if (!cfg || !cfg.token || !cfg.username) {
    throw new Error('المخزن السحابي المشفر غير مربوط بعد. يرجى تفعيل المفتاح السري أولاً.');
  }

  if (!fs.existsSync(params.sourceFilePath)) {
    throw new Error('ملف الفيديو المرفوع غير موجود للمعالجة.');
  }

  const videoId =
    params.videoId ||
    `gh_hls_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const jobDir = path.join(WORK_DIR, videoId);
  fs.mkdirSync(jobDir, { recursive: true });

  await acquireEncodingSlot((pos) => {
    params.onProgress?.(`في طابور المعالجة السريعة (الترتيب #${pos})... سيبدأ التشفير خلال لحظات`, 5);
  });

  let keepJobDirForBackgroundUpload = false;

  try {
    params.onProgress?.('جاري فحص الفيديو وتجهيز التشفير الحركي AES-128...', 20);

    const stat = fs.statSync(params.sourceFilePath);
    let durationSec = Math.max(60, Math.round(stat.size / (1024 * 1024 * 0.25)));
    let videoCodec = 'h264';
    let audioCodec = 'aac';

    // Generate cryptographically random 16-byte AES-128 key & IV
    const keyBuffer = crypto.randomBytes(16);
    const keyBase64 = keyBuffer.toString('base64');
    const ivBuffer = crypto.randomBytes(16);
    const ivHex = ivBuffer.toString('hex');

    const keyFilePath = path.join(jobDir, 'enc.key');
    const keyInfoPath = path.join(jobDir, 'enc.keyinfo');
    const m3u8Path = path.join(jobDir, 'index.m3u8');
    const segPattern = path.join(jobDir, 'seg_%04d.ts');

    let storageMode: 'hls' | 'node-aes128' = 'hls';
    let segmentFiles: string[] = [];
    const rawSizesMap: Record<string, number> = {};
    let m3u8Template = '';

    // 1. Fast zero-reencode HLS AES-128 slicing via FFmpeg stream copy (completes in ~1 second!)
    try {
      try {
        await execFileAsync(FFMPEG_BIN, ['-hide_banner', '-i', params.sourceFilePath], {
          timeout: 6000,
        });
      } catch (probeErr: any) {
        const stderr = String(probeErr?.stderr || probeErr?.message || '');
        const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
        if (durMatch) {
          const hrs = parseInt(durMatch[1], 10) || 0;
          const mins = parseInt(durMatch[2], 10) || 0;
          const secs = parseFloat(durMatch[3]) || 0;
          const totalSec = Math.round(hrs * 3600 + mins * 60 + secs);
          if (totalSec > 0) durationSec = totalSec;
        }
        const vMatch = stderr.match(/Video:\s*([a-zA-Z0-9_]+)/i);
        if (vMatch && vMatch[1]) videoCodec = vMatch[1].toLowerCase();
        const aMatch = stderr.match(/Audio:\s*([a-zA-Z0-9_]+)/i);
        if (aMatch && aMatch[1]) audioCodec = aMatch[1].toLowerCase();
      }

      const hlsTime = 6;
      fs.writeFileSync(keyFilePath, keyBuffer);
      fs.writeFileSync(
        keyInfoPath,
        `__KEY_URI_PLACEHOLDER__\n${keyFilePath}\n${ivHex}\n`,
        'utf-8'
      );

      params.onProgress?.('جاري تقطيع الفيديو وتشفيره بتقنية HLS AES-128 فائقة السرعة...', 55);

      let slicedOk = false;

      // Zero-reencode stream copy for H.264 video with 3-second initial segment (-hls_init_time 3) for instant 0.2s playback start!
      // Note: Do NOT pass -hls_playlist_type vod to ffmpeg CLI because ffmpeg overrides hls_init_time when vod is set;
      // buildGuardedM3u8Playlist injects #EXT-X-PLAYLIST-TYPE:VOD automatically.
      try {
        const videoCodecArgs =
          videoCodec === 'h264'
            ? ['-c:v', 'copy']
            : [
                '-c:v',
                'libx264',
                '-preset',
                'ultrafast',
                '-crf',
                '26',
                '-maxrate',
                '1500k',
                '-bufsize',
                '3000k',
                '-pix_fmt',
                'yuv420p',
                '-g',
                '60',
                '-sc_threshold',
                '0',
              ];
        await execFileAsync(
          FFMPEG_BIN,
          [
            '-y',
            '-threads',
            '0',
            '-i',
            params.sourceFilePath,
            '-map',
            '0:v:0',
            '-map',
            '0:a:0?',
            '-sn',
            '-dn',
            ...videoCodecArgs,
            '-c:a',
            audioCodec === 'aac' || audioCodec === 'mp3' ? 'copy' : 'aac',
            '-f',
            'hls',
            '-hls_init_time',
            '3',
            '-hls_time',
            String(hlsTime),
            '-hls_list_size',
            '0',
            '-hls_flags',
            'independent_segments',
            '-hls_key_info_file',
            keyInfoPath,
            '-hls_segment_filename',
            segPattern,
            m3u8Path,
          ],
          { timeout: 300000 }
        );
        slicedOk = true;
      } catch {
        slicedOk = false;
      }

      if (!slicedOk) {
        throw new Error('Use instant Node AES-128 chunker instead of slow CPU re-encoding');
      }

      segmentFiles = fs
        .readdirSync(jobDir)
        .filter((f) => f.endsWith('.ts'))
        .sort();

      if (segmentFiles.length === 0 || !fs.existsSync(m3u8Path)) {
        throw new Error('No HLS segments produced');
      }
      m3u8Template = fs.readFileSync(m3u8Path, 'utf-8');
      storageMode = 'hls';

      // Pre-warm the opening HLS segments (seg_0000.ts & seg_0001.ts) into RAM cache for instant 0ms playback!
      for (const warmSeg of segmentFiles.slice(0, 2)) {
        try {
          const warmBuf = fs.readFileSync(path.join(jobDir, warmSeg));
          setCachedDecryptedChunk(`hls_raw:${videoId}:${warmSeg}`, warmBuf);
          const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, ivBuffer);
          const decWarm = Buffer.concat([decipher.update(warmBuf), decipher.final()]);
          setCachedDecryptedChunk(`${videoId}:${warmSeg}`, decWarm);
        } catch {}
      }
    } catch {
      // Built-in Instant Pure Node.js AES-128-CBC Chunker with In-Place Truncation
      // Processes from the last chunk backwards and truncates sourceFilePath after each 8MB slice
      // so /tmp (RAM disk on Cloud Run) NEVER holds 2x the video size!
      storageMode = 'node-aes128';
      params.onProgress?.('جاري تقطيع وتشفير الفيديو بمحرك التشفير السحابي الفوري AES-128...', 60);

      for (const oldFile of fs.readdirSync(jobDir)) {
        if (oldFile.endsWith('.ts')) {
          try {
            fs.unlinkSync(path.join(jobDir, oldFile));
          } catch {}
        }
      }

      const fd = fs.openSync(params.sourceFilePath, 'r+');
      try {
        const totalChunks = Math.ceil(stat.size / RAW_AES_CHUNK_SIZE);
        const readBuf = Buffer.allocUnsafe(RAW_AES_CHUNK_SIZE);

        for (let idx = totalChunks - 1; idx >= 0; idx--) {
          const offset = idx * RAW_AES_CHUNK_SIZE;
          const toRead = Math.min(RAW_AES_CHUNK_SIZE, stat.size - offset);
          const bytesRead = fs.readSync(fd, readBuf, 0, toRead, offset);
          if (bytesRead <= 0) continue;

          const rawSlice = readBuf.subarray(0, bytesRead);
          const cipher = crypto.createCipheriv('aes-128-cbc', keyBuffer, ivBuffer);
          const encryptedBuf = Buffer.concat([cipher.update(rawSlice), cipher.final()]);

          // Immediately truncate the raw file at `offset` to free those 8MB from /tmp RAM before writing the encrypted chunk!
          try {
            fs.ftruncateSync(fd, offset);
          } catch {}

          const segName = `seg_${String(idx).padStart(4, '0')}.ts`;
          fs.writeFileSync(path.join(jobDir, segName), encryptedBuf);
          rawSizesMap[segName] = bytesRead;

          // Pre-warm the opening chunk (seg_0000.ts) directly in the 96MB LRU RAM cache for 0ms instant playback
          if (idx === 0) {
            setCachedDecryptedChunk(`${videoId}:${segName}`, Buffer.from(rawSlice));
          }
        }
      } finally {
        try {
          fs.closeSync(fd);
        } catch {}
      }

      segmentFiles = fs
        .readdirSync(jobDir)
        .filter((f) => f.endsWith('.ts'))
        .sort();

      m3u8Template = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STORAGE-MODE:NODE-AES128\n`;
    }

    // Remove the raw source MP4 immediately now that encrypted segments are ready in jobDir
    try {
      if (fs.existsSync(params.sourceFilePath)) {
        fs.unlinkSync(params.sourceFilePath);
      }
    } catch {}

    params.onProgress?.('جاري اختيار أفضل شريحة تخزين سحابية (Auto-Sharding) وتفعيل البث الفوري...', 88);

    const targetShard = await selectOptimalVaultShard();
    const shardOwner = targetShard.username || cfg.username;
    const shardToken = targetShard.token || cfg.token;
    const activeRepo = targetShard.activeRepo || cfg.activeRepo || generateStealthRepoName();
    const releaseTag = `r-${crypto.randomBytes(6).toString('hex')}`;

    // Build initial segment map so the video is 100% playable immediately from local encrypted cache
    // while the background worker uploads each segment to GitHub Releases!
    const segmentsMap: Record<
      string,
      { downloadUrl: string; assetId: number; size: number; rawSize?: number }
    > = {};

    for (const segName of segmentFiles) {
      const segPath = path.join(jobDir, segName);
      let segSize = 0;
      try {
        segSize = fs.statSync(segPath).size;
      } catch {}
      segmentsMap[segName] = {
        downloadUrl: `https://github.com/${shardOwner}/${activeRepo}/releases/download/${releaseTag}/${segName}`,
        assetId: 0,
        size: segSize,
        ...(rawSizesMap[segName] ? { rawSize: rawSizesMap[segName] } : {}),
      };
    }

    const record: GitHubHlsVideoRecord = {
      videoId,
      title: params.title || 'محاضرة مشفرة',
      durationSec,
      sizeBytes: stat.size,
      keyBase64,
      ivHex,
      repoOwner: shardOwner,
      repoName: activeRepo,
      releaseTag,
      releaseId: 0,
      storageMode,
      rawChunkSize: storageMode === 'node-aes128' ? RAW_AES_CHUNK_SIZE : undefined,
      m3u8Template,
      segments: segmentsMap,
      createdAt: new Date().toISOString(),
    };

    saveGitHubHlsVideo(record);
    keepJobDirForBackgroundUpload = true;

    params.onProgress?.('تم تشفير وحفظ الفيديو بنجاح! جاهز للعرض الفوري ✅', 100);

    // Upload encrypted segments to GitHub Releases asynchronously in the background.
    // Progressive /tmp memory reclamation: each segment file is deleted from /tmp the instant
    // its GitHub Release upload succeeds!
    void (async () => {
      try {
        const verifiedRepo = await ensureVaultRepoExists(shardToken, shardOwner, activeRepo);
        record.repoOwner = shardOwner;
        record.repoName = verifiedRepo;

        const releaseRes = await axios.post(
          `https://api.github.com/repos/${encodeURIComponent(shardOwner)}/${encodeURIComponent(verifiedRepo)}/releases`,
          {
            tag_name: releaseTag,
            name: releaseTag,
            body: '',
            draft: false,
            prerelease: false,
          },
          {
            headers: ghHeaders(shardToken),
            httpsAgent: githubHttpsAgent,
            timeout: 20000,
            validateStatus: () => true,
          }
        );

        if (releaseRes.status === 201 || releaseRes.status === 200) {
          record.releaseId = releaseRes.data.id || 0;
          const uploadUrlTemplate = String(releaseRes.data.upload_url || '').replace(
            /\{\?name,label\}$/,
            ''
          );

          const batchSize = 4;
          for (let i = 0; i < segmentFiles.length; i += batchSize) {
            const batch = segmentFiles.slice(i, i + batchSize);
            await Promise.all(
              batch.map(async (segName) => {
                const segPath = path.join(jobDir, segName);
                if (!fs.existsSync(segPath)) return;
                const segBuf = fs.readFileSync(segPath);
                for (let attempt = 1; attempt <= 4; attempt++) {
                  try {
                    const upRes = await axios.post(
                      `${uploadUrlTemplate}?name=${encodeURIComponent(segName)}`,
                      segBuf,
                      {
                        headers: {
                          ...ghHeaders(shardToken),
                          'Content-Type': 'video/mp2t',
                          'Content-Length': String(segBuf.length),
                        },
                        httpsAgent: githubHttpsAgent,
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        timeout: 60000,
                        validateStatus: () => true,
                      }
                    );
                    if (upRes.status === 201 || upRes.status === 200) {
                      record.segments[segName] = {
                        downloadUrl:
                          upRes.data.browser_download_url ||
                          `https://github.com/${shardOwner}/${verifiedRepo}/releases/download/${releaseTag}/${segName}`,
                        assetId: upRes.data.id || 0,
                        size: segBuf.length,
                        ...(rawSizesMap[segName] ? { rawSize: rawSizesMap[segName] } : {}),
                      };
                      // Free /tmp RAM immediately for this uploaded segment!
                      try {
                        fs.unlinkSync(segPath);
                      } catch {}
                      break;
                    }
                  } catch {}
                  await new Promise((r) => setTimeout(r, 500 * attempt));
                }
              })
            );
          }

          saveGitHubHlsVideo(record);
          params.onBackgroundSyncComplete?.();
          await syncCatalogToGitHubRepo(cfg).catch(() => {});
        }
      } catch (bgErr) {
        console.error('[GitHub HLS Background Sync Error]:', bgErr);
      } finally {
        try {
          fs.rmSync(jobDir, { recursive: true, force: true });
        } catch {}
      }
    })();

    const masterPlaylistUrl = `/api/github-hls/${encodeURIComponent(videoId)}/master.m3u8`;

    return {
      success: true,
      videoId,
      masterPlaylistUrl,
      durationSec,
      segmentCount: segmentFiles.length,
      repoName: activeRepo,
      repoUrl: `https://github.com/${shardOwner}/${activeRepo}`,
    };
  } finally {
    releaseEncodingSlot();
    if (!keepJobDirForBackgroundUpload) {
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
      } catch {}
    }
    try {
      if (fs.existsSync(params.sourceFilePath)) {
        fs.unlinkSync(params.sourceFilePath);
      }
    } catch {}
  }
}

/**
 * Switches all active vault repositories (primary + secondary shards) between Private and Public visibility.
 */
export async function setVaultRepoVisibility(isPrivate: boolean): Promise<{
  success: boolean;
  isPrivate: boolean;
  repoName: string;
  message: string;
}> {
  const cfg = getGitHubHlsConfig();
  if (!cfg || !cfg.token || !cfg.username) {
    return {
      success: false,
      isPrivate,
      repoName: '',
      message: 'المخزن السحابي المشفر غير مربوط بعد.',
    };
  }

  const targets =
    Array.isArray(cfg.shards) && cfg.shards.length > 0
      ? cfg.shards
      : [{ token: cfg.token, username: cfg.username, activeRepo: cfg.activeRepo }];

  let updatedCount = 0;
  for (const t of targets) {
    if (!t.token || !t.username || !t.activeRepo) continue;
    try {
      const res = await axios.patch(
        `https://api.github.com/repos/${encodeURIComponent(t.username)}/${encodeURIComponent(t.activeRepo)}`,
        { private: isPrivate },
        {
          headers: ghHeaders(t.token),
          timeout: 15000,
          validateStatus: () => true,
        }
      );
      if (res.status === 200) updatedCount++;
    } catch {}
  }

  if (updatedCount > 0) {
    return {
      success: true,
      isPrivate,
      repoName: cfg.activeRepo,
      message: isPrivate
        ? `تم تحويل ${updatedCount} مخزن سحابي إلى خاص (Private 🔒) بنجاح!`
        : `تم تحويل ${updatedCount} مخزن سحابي إلى عام (Public 🌐) بنجاح! جميع القطع والمفاتيح مشفرة بالكامل.`,
    };
  }

  return {
    success: false,
    isPrivate,
    repoName: cfg.activeRepo,
    message: `تعذر تغيير حالة المخزن السحابي.`,
  };
}

/**
 * Downloads and decrypts a single AES-128-CBC encrypted chunk from local instant cache or GitHub Releases in RAM
 * (cached in a 96 MB shared LRU buffer + In-Flight Request Coalescing so 500 concurrent
 * students trigger only 1 download and 1 decryption).
 * Works seamlessly on both Private and Public GitHub repositories!
 */
export async function fetchAndDecryptNodeAesChunk(
  video: GitHubHlsVideoRecord,
  segName: string
): Promise<Buffer> {
  const cacheKey = `${video.videoId}:${segName}`;
  const cached = getCachedDecryptedChunk(cacheKey);
  if (cached) return cached;

  const existingInFlight = inFlightChunkPromises.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const workPromise = (async () => {
    try {
      let encryptedBuf: Buffer | null = null;

      // 1. Check local instant-play cache first (0ms latency right after upload while syncing to GitHub!)
      const localSegPath = path.join(WORK_DIR, video.videoId, segName);
      if (fs.existsSync(localSegPath)) {
        try {
          encryptedBuf = fs.readFileSync(localSegPath);
        } catch {}
      }

      // 2. Otherwise fetch from GitHub Releases Vault
      if (!encryptedBuf) {
        const reqConfig = getAuthenticatedSegmentRequestConfig(video, segName);
        if (!reqConfig) {
          throw new Error(`Segment ${segName} not found`);
        }

        let res = await axios.get(reqConfig.url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: reqConfig.headers,
          httpsAgent: githubHttpsAgent,
          validateStatus: () => true,
        });

        // Fallback to direct downloadUrl if assetId API call wasn't 200
        const seg = video.segments[segName];
        if (res.status !== 200 && seg?.downloadUrl && reqConfig.url !== seg.downloadUrl) {
          res = await axios.get(seg.downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            httpsAgent: githubHttpsAgent,
            headers: { 'User-Agent': 'QalbElElm-HLS-Guard/2.0' },
          });
        } else if (res.status !== 200) {
          throw new Error(`Failed to fetch segment ${segName}: HTTP ${res.status}`);
        }

        encryptedBuf = Buffer.from(res.data);
      }

      const keyBuffer = Buffer.from(video.keyBase64, 'base64');
      const ivBuffer = Buffer.from(video.ivHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, ivBuffer);
      const decryptedBuf = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);

      setCachedDecryptedChunk(cacheKey, decryptedBuf);
      return decryptedBuf;
    } finally {
      inFlightChunkPromises.delete(cacheKey);
    }
  })();

  inFlightChunkPromises.set(cacheKey, workPromise);
  return workPromise;
}

/**
 * Fetches an encrypted .ts HLS segment from local instant cache or GitHub with 96 MB RAM LRU caching
 * and In-Flight Request Coalescing, so 500 concurrent students watching the same lecture only trigger 1 fetch.
 */
export async function fetchEncryptedHlsSegmentBuffer(
  video: GitHubHlsVideoRecord,
  segName: string
): Promise<Buffer> {
  const cacheKey = `hls_raw:${video.videoId}:${segName}`;
  const cached = getCachedDecryptedChunk(cacheKey);
  if (cached) return cached;

  const existingInFlight = inFlightChunkPromises.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const workPromise = (async () => {
    try {
      // 1. Check local instant-play cache first (0ms latency right after upload while syncing to GitHub!)
      const localSegPath = path.join(WORK_DIR, video.videoId, segName);
      if (fs.existsSync(localSegPath)) {
        try {
          const localBuf = fs.readFileSync(localSegPath);
          setCachedDecryptedChunk(cacheKey, localBuf);
          return localBuf;
        } catch {}
      }

      // 2. Otherwise fetch from GitHub Releases Vault
      const reqConfig = getAuthenticatedSegmentRequestConfig(video, segName);
      if (!reqConfig) {
        throw new Error(`Segment ${segName} not found`);
      }

      let res = await axios.get(reqConfig.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: reqConfig.headers,
        httpsAgent: githubHttpsAgent,
        validateStatus: () => true,
      });

      const seg = video.segments[segName];
      if (res.status !== 200 && seg?.downloadUrl && reqConfig.url !== seg.downloadUrl) {
        res = await axios.get(seg.downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          httpsAgent: githubHttpsAgent,
          headers: { 'User-Agent': 'QalbElElm-HLS-Guard/2.0' },
        });
      } else if (res.status !== 200) {
        throw new Error(`Failed to fetch HLS segment ${segName}: HTTP ${res.status}`);
      }

      const buf = Buffer.from(res.data);
      setCachedDecryptedChunk(cacheKey, buf);
      return buf;
    } finally {
      inFlightChunkPromises.delete(cacheKey);
    }
  })();

  inFlightChunkPromises.set(cacheKey, workPromise);
  return workPromise;
}

// ============================================================================
// CRYPTOGRAPHIC ANTI-SNIFFER KEY GUARD (/enc.key HMAC-SHA256 + NONCE + TTL)
// ============================================================================
const KEY_GUARD_SECRET =
  process.env.HLS_KEY_GUARD_SECRET ||
  crypto.createHash('sha256').update(`qalbelm_hls_key_shield_${process.cwd()}`).digest('hex');

const KEY_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes max lifetime per playlist load
const keyTokenUsageMap = new Map<string, { count: number; expiresAt: number }>();

/**
 * Generates a short-lived, HMAC-SHA256 signed token bound to `videoId` so `/enc.key`
 * cannot be fetched by packet sniffers, replay scripts, or external downloaders.
 */
export function generateKeyGuardToken(videoId: string): string {
  const ts = Date.now().toString(36);
  const nonce = crypto.randomBytes(6).toString('hex');
  const payload = `${videoId}:${ts}:${nonce}`;
  const sig = crypto
    .createHmac('sha256', KEY_GUARD_SECRET)
    .update(payload)
    .digest('base64url');
  return `${ts}.${nonce}.${sig}`;
}

/**
 * Verifies the HMAC-SHA256 signature, expiration window, and anti-replay budget for `/enc.key`.
 */
export function verifyKeyGuardToken(videoId: string, token: string): boolean {
  if (!videoId || !token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  const [tsStr, nonce, sig] = parts;
  const issuedAt = parseInt(tsStr, 36);
  const now = Date.now();
  if (!Number.isFinite(issuedAt) || now - issuedAt > KEY_TOKEN_TTL_MS || issuedAt > now + 60000) {
    return false;
  }

  const expectedSig = crypto
    .createHmac('sha256', KEY_GUARD_SECRET)
    .update(`${videoId}:${tsStr}:${nonce}`)
    .digest('base64url');

  if (sig.length !== expectedSig.length) return false;
  const isValidSig = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  if (!isValidSig) return false;

  // Periodic cleanup of expired token usage entries
  if (keyTokenUsageMap.size > 2000) {
    for (const [k, v] of keyTokenUsageMap.entries()) {
      if (v.expiresAt < now) keyTokenUsageMap.delete(k);
    }
  }

  const usageKey = `${videoId}:${nonce}`;
  const existing = keyTokenUsageMap.get(usageKey);
  if (existing) {
    // Allow Hls.js retries/quality switches within the same session (up to 8 fetches), block sniffer floods
    if (existing.count >= 8) return false;
    existing.count += 1;
  } else {
    keyTokenUsageMap.set(usageKey, { count: 1, expiresAt: issuedAt + KEY_TOKEN_TTL_MS });
  }

  return true;
}

export interface FastStartMp4Meta {
  videoId: string;
  headerSize: number;
  mdatOriginalOffset: number;
  mdatSize: number;
  delta: number;
  totalFastStartSize: number;
  headerBuf: Buffer;
}

const fastStartMp4Cache = new Map<string, FastStartMp4Meta>();

export function getFastStartMp4HeaderAndMeta(videoId: string): FastStartMp4Meta | null {
  const cached = fastStartMp4Cache.get(videoId);
  if (cached) return cached;
  try {
    const dir = path.join(DATA_DIR, 'faststart_headers');
    const metaPath = path.join(dir, `${videoId}.meta.json`);
    const hdrPath = path.join(dir, `${videoId}.header`);
    if (fs.existsSync(metaPath) && fs.existsSync(hdrPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const headerBuf = fs.readFileSync(hdrPath);
      const entry: FastStartMp4Meta = {
        videoId,
        headerSize: Number(meta.headerSize || headerBuf.length),
        mdatOriginalOffset: Number(meta.mdatOriginalOffset || 0),
        mdatSize: Number(meta.mdatSize || 0),
        delta: Number(meta.delta || 0),
        totalFastStartSize: Number(meta.totalFastStartSize || headerBuf.length + Number(meta.mdatSize || 0)),
        headerBuf,
      };
      fastStartMp4Cache.set(videoId, entry);
      return entry;
    }
  } catch {}
  return null;
}

function hasH264SpsNear(buf: Buffer, patOffset: number): boolean {
  const end = Math.min(buf.length - 4, patOffset + 4096);
  for (let i = patOffset; i <= end; i++) {
    if (buf[i] === 0x00 && buf[i + 1] === 0x00 && buf[i + 2] === 0x01) {
      const nalType = buf[i + 3] & 0x1f;
      if (nalType === 7) return true;
    }
  }
  return false;
}

export function findCleanTsBoundaries(
  buf: Buffer,
  chunkIdx = 0,
  chunkSize = RAW_AES_CHUNK_SIZE,
  requireSps = true
): number[] {
  const globalStart = chunkIdx * chunkSize;
  const firstSync = (188 - (globalStart % 188)) % 188;
  const spsBoundaries: number[] = [];
  const allPatBoundaries: number[] = [];

  for (let i = firstSync; i + 188 <= buf.length; i += 188) {
    if (buf[i] === 0x47 && buf[i + 1] === 0x40 && buf[i + 2] === 0x00) {
      const start =
        i >= 188 && buf[i - 188] === 0x47 && buf[i - 187] === 0x40 && buf[i - 186] === 0x11
          ? i - 188
          : i;
      if (allPatBoundaries.length === 0 || start > allPatBoundaries[allPatBoundaries.length - 1]) {
        allPatBoundaries.push(start);
      }
      if (hasH264SpsNear(buf, i)) {
        if (spsBoundaries.length === 0 || start > spsBoundaries[spsBoundaries.length - 1]) {
          spsBoundaries.push(start);
        }
      }
    }
  }

  return requireSps && spsBoundaries.length > 0 ? spsBoundaries : allPatBoundaries;
}

export function sliceMpegTsBufferByPart(buf: Buffer, partIdx: number, totalParts: number): Buffer {
  if (totalParts <= 1 || partIdx < 0 || partIdx >= totalParts) return buf;
  const rawBounds = findCleanTsBoundaries(buf, 0, buf.length, true);
  const boundaries = [0, ...rawBounds.filter((b) => b > 0 && b < buf.length)];

  const splits = new Array<number>(totalParts + 1);
  splits[0] = 0;
  splits[totalParts] = buf.length;

  for (let k = 1; k < totalParts; k++) {
    const target = Math.floor((buf.length * k) / totalParts);
    const minPrev = splits[k - 1];
    const candidates = boundaries.filter((b) => b > minPrev && b < buf.length);
    if (candidates.length > 0) {
      let best = candidates[0];
      let bestDist = Math.abs(best - target);
      for (const c of candidates) {
        const d = Math.abs(c - target);
        if (d < bestDist) {
          best = c;
          bestDist = d;
        }
      }
      splits[k] = best;
    } else {
      splits[k] = Math.min(buf.length, Math.max(minPrev, Math.floor(target / 188) * 188));
    }
  }

  return buf.subarray(splits[partIdx], splits[partIdx + 1]);
}

function pickFourChunkSubBoundaries(bounds: number[], chunkLen: number, isFirstChunk: boolean): number[] {
  const b0 = isFirstChunk ? 0 : bounds[0] ?? 0;
  const pickClosest = (target: number, minVal: number) => {
    let best = bounds.find((x) => x >= target && x > minVal);
    if (best === undefined) {
      const after = bounds.filter((x) => x > minVal);
      best = after.length > 0 ? after[after.length - 1] : Math.min(chunkLen, Math.floor(target / 188) * 188);
    }
    return best;
  };
  // Make the very first sub-segment of chunk 0 extra compact (~8% of 4MB = ~370 KB) for <0.4s instant start
  const b1 = pickClosest(Math.floor(chunkLen * (isFirstChunk ? 0.08 : 0.25)), b0);
  const b2 = pickClosest(Math.floor(chunkLen * 0.45), b1);
  const b3 = pickClosest(Math.floor(chunkLen * 0.75), b2);
  return [b0, b1, b2, b3];
}

export function buildMasterMultiVariantM3u8(video: GitHubHlsVideoRecord): string {
  return buildGuardedM3u8Playlist(video);
}

/**
 * Generates a single-level VOD HLS Media Playlist (.m3u8) with PAT+SPS-aligned sub-segments
 * for instant <0.5s playback start on school tablets and slow school Wi-Fi networks.
 * Supports:
 * 1. Standard `hls` videos (with automatic PAT+SPS micro-slicing of long segments so opening segment is ~220-370 KB).
 * 2. `node-aes128` MPEG-TS videos (virtual `tschunk_XXXX_S.ts` 3-second segments).
 * 3. `node-aes128` MP4 videos (virtual `mp4seg_XXXX.ts` 8-second segments via Fast-Start header).
 */
export function buildGuardedM3u8Playlist(video: GitHubHlsVideoRecord, _variant?: string): string {
  const vid = encodeURIComponent(video.videoId);

  if (video.storageMode === 'node-aes128') {
    const fastStartMeta = getFastStartMp4HeaderAndMeta(video.videoId);
    if (fastStartMeta) {
      // MP4-backed Virtual HLS (8-second segments, ~450 KB each)
      const segDur = 8;
      const totalDur = Math.max(segDur, Number(video.durationSec || 60));
      const count = Math.ceil(totalDur / segDur);
      const out: string[] = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        `#EXT-X-TARGETDURATION:${segDur}`,
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-PLAYLIST-TYPE:VOD',
      ];
      for (let i = 0; i < count; i++) {
        const d = i === count - 1 ? Math.max(1, totalDur - i * segDur) : segDur;
        out.push(`#EXTINF:${d.toFixed(6)},`);
        out.push(`/api/github-hls/${vid}/segment/mp4seg_${String(i).padStart(4, '0')}.ts`);
      }
      out.push('#EXT-X-ENDLIST');
      return out.join('\n');
    }

    // MPEG-TS-backed Virtual HLS (4 sub-segments per 4MB chunk = ~3.08s / ~1MB each)
    const segKeys = Object.keys(video.segments || {}).sort();
    const totalChunks = segKeys.length;
    const totalSubSegs = Math.max(1, totalChunks * 4);
    const totalDur = Math.max(totalSubSegs, Number(video.durationSec || totalChunks * 12.32));
    const avgSubDur = totalDur / totalSubSegs;
    const targetDur = Math.max(4, Math.ceil(avgSubDur + 2));

    const out: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${targetDur}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD',
    ];
    for (let k = 0; k < totalChunks; k++) {
      for (let s = 0; s < 4; s++) {
        out.push(`#EXTINF:${avgSubDur.toFixed(6)},`);
        out.push(`/api/github-hls/${vid}/segment/tschunk_${String(k).padStart(4, '0')}_${s}.ts`);
      }
    }
    out.push('#EXT-X-ENDLIST');
    return out.join('\n');
  }

  // Standard HLS mode: serve server-decrypted segments with automatic PAT+SPS micro-slicing
  // for any segment >= 7.5s so the school tablet downloads only ~220-370 KB to start playing!
  const lines = video.m3u8Template.split(/\r?\n/);
  const rewritten: string[] = [];
  let hasVodHeader = video.m3u8Template.includes('#EXT-X-PLAYLIST-TYPE:');
  let insertedVodHeader = false;
  let pendingExtInfDur: number | null = null;
  let pendingExtInfRaw = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Server decrypts segments in RAM cache (0ms WebCrypto overhead on tablet, no extra /enc.key round-trip)
    if (trimmed.startsWith('#EXT-X-KEY:')) {
      continue;
    }

    if (trimmed.startsWith('#EXTINF:')) {
      const m = trimmed.match(/^#EXTINF:([0-9.]+)/);
      pendingExtInfDur = m ? parseFloat(m[1]) : null;
      pendingExtInfRaw = trimmed;
      continue;
    }

    if (trimmed.endsWith('.ts') && !trimmed.startsWith('#')) {
      const segInfo = video.segments[trimmed];
      if (segInfo && segInfo.downloadUrl) {
        const dur = pendingExtInfDur && pendingExtInfDur > 0 ? pendingExtInfDur : 6.0;
        const isFirstSeg = trimmed === 'seg_0000.ts';
        const parts =
          isFirstSeg && dur >= 6.0
            ? Math.min(4, Math.max(3, Math.round(dur / 3.0)))
            : dur >= 8.5
            ? Math.min(3, Math.max(2, Math.round(dur / 4.5)))
            : 1;

        if (parts > 1) {
          const partDur = dur / parts;
          for (let p = 0; p < parts; p++) {
            rewritten.push(`#EXTINF:${partDur.toFixed(6)},`);
            rewritten.push(
              `/api/github-hls/${vid}/segment/${encodeURIComponent(trimmed)}?part=${p}&of=${parts}`
            );
          }
        } else {
          rewritten.push(pendingExtInfRaw || `#EXTINF:${dur.toFixed(6)},`);
          rewritten.push(`/api/github-hls/${vid}/segment/${encodeURIComponent(trimmed)}`);
        }
        pendingExtInfDur = null;
        pendingExtInfRaw = '';
        continue;
      }
    }

    rewritten.push(line);
    if (!hasVodHeader && !insertedVodHeader && trimmed.startsWith('#EXT-X-VERSION:')) {
      rewritten.push('#EXT-X-PLAYLIST-TYPE:VOD');
      insertedVodHeader = true;
    }
  }

  return rewritten.join('\n');
}

/**
 * Unified high-speed segment resolver for all 3 video storage modes:
 * 1. `mp4seg_XXXX.ts`: Fast-Start MP4 8-second segment remuxed on-the-fly in ~120ms and cached in RAM/disk.
 * 2. `tschunk_XXXX_S.ts`: PAT+SPS-aligned virtual sub-segments from 4MB MPEG-TS chunks.
 * 3. `seg_XXXX.ts` (with optional `?part=P&of=N`): Server-decrypted HLS segment with PAT+SPS micro-slicing.
 */
export async function getUnifiedHlsSegmentBuffer(
  video: GitHubHlsVideoRecord,
  segName: string,
  partParam?: string,
  ofParam?: string,
  localPort = 3000
): Promise<Buffer> {
  // 1. MP4-backed Virtual HLS segment (mp4seg_XXXX.ts)
  const mp4SegMatch = segName.match(/^mp4seg_(\d+)\.ts$/);
  if (mp4SegMatch) {
    const segIdx = parseInt(mp4SegMatch[1], 10);
    const cacheKey = `mp4seg:${video.videoId}:${segIdx}`;
    const cached = getCachedDecryptedChunk(cacheKey);
    if (cached) {
      // Pre-warm next mp4seg asynchronously
      const nextIdx = segIdx + 1;
      const totalSegs = Math.ceil(Math.max(8, Number(video.durationSec || 60)) / 8);
      if (nextIdx < totalSegs && !getCachedDecryptedChunk(`mp4seg:${video.videoId}:${nextIdx}`)) {
        getUnifiedHlsSegmentBuffer(
          video,
          `mp4seg_${String(nextIdx).padStart(4, '0')}.ts`,
          undefined,
          undefined,
          localPort
        ).catch(() => {});
      }
      return cached;
    }

    const existingPromise = inFlightChunkPromises.get(cacheKey);
    if (existingPromise) return existingPromise;

    const work = (async () => {
      try {
        // Check pre-generated disk cache in data/faststart_headers
        const diskPath = path.join(
          DATA_DIR,
          'faststart_headers',
          `${video.videoId}_mp4seg_${String(segIdx).padStart(4, '0')}.ts`
        );
        if (fs.existsSync(diskPath)) {
          const diskBuf = fs.readFileSync(diskPath);
          setCachedDecryptedChunk(cacheKey, diskBuf);
          return diskBuf;
        }

        const startSec = segIdx * 8;
        const endSec = (segIdx + 1) * 8;
        const tmpOut = path.join(WORK_DIR, `tmp_${video.videoId}_mp4seg_${segIdx}_${Date.now()}.ts`);
        const streamUrl = `http://127.0.0.1:${localPort}/api/github-hls/${encodeURIComponent(video.videoId)}/stream.mp4?internal=1`;

        await execFileAsync(
          FFMPEG_BIN,
          [
            '-y',
            '-ss',
            String(startSec),
            '-to',
            String(endSec),
            '-i',
            streamUrl,
            '-copyts',
            '-map',
            '0:v:0',
            '-map',
            '0:a:0?',
            '-c',
            'copy',
            '-bsf:v',
            'h264_mp4toannexb',
            '-muxdelay',
            '0',
            '-muxpreload',
            '0',
            '-f',
            'mpegts',
            tmpOut,
          ],
          { timeout: 30000 }
        );

        const buf = fs.readFileSync(tmpOut);
        try {
          fs.unlinkSync(tmpOut);
        } catch {}
        setCachedDecryptedChunk(cacheKey, buf);
        return buf;
      } finally {
        inFlightChunkPromises.delete(cacheKey);
      }
    })();

    inFlightChunkPromises.set(cacheKey, work);
    const result = await work;

    // Pre-warm next mp4seg asynchronously
    const nextIdx = segIdx + 1;
    const totalSegs = Math.ceil(Math.max(8, Number(video.durationSec || 60)) / 8);
    if (nextIdx < totalSegs && !getCachedDecryptedChunk(`mp4seg:${video.videoId}:${nextIdx}`)) {
      getUnifiedHlsSegmentBuffer(
        video,
        `mp4seg_${String(nextIdx).padStart(4, '0')}.ts`,
        undefined,
        undefined,
        localPort
      ).catch(() => {});
    }

    return result;
  }

  // 2. MPEG-TS-backed Virtual HLS segment (tschunk_XXXX_S.ts)
  const tsChunkMatch = segName.match(/^tschunk_(\d+)_([0-3])\.ts$/);
  if (tsChunkMatch) {
    const chunkIdx = parseInt(tsChunkMatch[1], 10);
    const subIdx = parseInt(tsChunkMatch[2], 10);
    const rawSegName = `seg_${String(chunkIdx).padStart(4, '0')}.ts`;
    const nextRawSegName = `seg_${String(chunkIdx + 1).padStart(4, '0')}.ts`;
    const hasNextChunk = Boolean(video.segments?.[nextRawSegName]);
    const chunkSize = Number(video.rawChunkSize || RAW_AES_CHUNK_SIZE);

    const chunkBuf = await fetchAndDecryptNodeAesChunk(video, rawSegName);
    const bounds = findCleanTsBoundaries(chunkBuf, chunkIdx, chunkSize, true);
    const subs = pickFourChunkSubBoundaries(bounds, chunkBuf.length, chunkIdx === 0);

    // Pre-fetch next 4MB chunk in background as soon as student reaches sub-segment 1 or 2
    if (subIdx >= 1 && hasNextChunk) {
      fetchAndDecryptNodeAesChunk(video, nextRawSegName).catch(() => {});
    }

    if (subIdx < 3) {
      return chunkBuf.subarray(subs[subIdx], subs[subIdx + 1]);
    }

    // subIdx === 3: stitch tail of chunkIdx with head of chunkIdx + 1 up to its first clean PAT+SPS boundary
    if (hasNextChunk) {
      const nextChunkBuf = await fetchAndDecryptNodeAesChunk(video, nextRawSegName);
      const nextBounds = findCleanTsBoundaries(nextChunkBuf, chunkIdx + 1, chunkSize, true);
      const nextFirstBound = nextBounds[0] ?? 0;
      return Buffer.concat([chunkBuf.subarray(subs[3]), nextChunkBuf.subarray(0, nextFirstBound)]);
    }

    return chunkBuf.subarray(subs[3]);
  }

  // 3. Standard HLS segment (seg_XXXX.ts) decrypted in server RAM + optional PAT+SPS micro-slicing
  const decBuf = await fetchAndDecryptNodeAesChunk(video, segName);

  // Pre-fetch next segment into RAM cache asynchronously
  const stdMatch = segName.match(/^seg_(\d+)\.ts$/);
  if (stdMatch) {
    const nextSegName = `seg_${String(parseInt(stdMatch[1], 10) + 1).padStart(4, '0')}.ts`;
    if (video.segments?.[nextSegName]) {
      fetchAndDecryptNodeAesChunk(video, nextSegName).catch(() => {});
    }
  }

  const totalParts = ofParam ? parseInt(ofParam, 10) : 1;
  const partIdx = partParam ? parseInt(partParam, 10) : 0;
  if (totalParts > 1 && !isNaN(partIdx) && partIdx >= 0 && partIdx < totalParts) {
    return sliceMpegTsBufferByPart(decBuf, partIdx, totalParts);
  }

  return decBuf;
}




