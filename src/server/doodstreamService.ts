import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'dood-config.json');

export interface DoodConfig {
  apiKey: string;
  baseUrl: string;
}

export function getDoodConfig(): DoodConfig {
  let fileKey = '580005mrplbue013uqbfpk';
  let fileBaseUrl = 'https://doodapi.co/api';
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.apiKey) fileKey = parsed.apiKey;
      if (parsed.baseUrl) fileBaseUrl = parsed.baseUrl;
    }
  } catch {}
  const apiKey = (process.env.DOOD_API_KEY || fileKey || '580005mrplbue013uqbfpk').trim();
  const baseUrl = (process.env.DOOD_API_BASE_URL || fileBaseUrl || 'https://doodapi.co/api').trim().replace(/\/+$/, '');
  return {
    apiKey,
    baseUrl,
  };
}

export function updateDoodConfig(apiKey: string, baseUrl?: string): { success: boolean; isConfigured: boolean } {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const current = getDoodConfig();
    const toSave = {
      apiKey: apiKey.trim() || current.apiKey,
      baseUrl: (baseUrl || current.baseUrl || 'https://doodapi.co/api').trim().replace(/\/+$/, ''),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(toSave, null, 2), 'utf-8');
    return { success: true, isConfigured: Boolean(toSave.apiKey) };
  } catch (err) {
    console.error('[DoodConfig Error]', err);
    return { success: false, isConfigured: false };
  }
}

export function isDoodConfigured(): boolean {
  const cfg = getDoodConfig();
  return Boolean(cfg.apiKey && cfg.apiKey.length > 5);
}

// Helper to make GET requests to DoodStream API
async function doodGet(endpoint: string, params: Record<string, any> = {}) {
  const cfg = getDoodConfig();
  const url = `${cfg.baseUrl.replace(/\/api$/, '')}/api${endpoint}`;
  const response = await axios.get(url, {
    params: {
      key: cfg.apiKey,
      ...params,
    },
    timeout: 15000,
  });
  return response.data;
}

export async function getDoodAccountInfo() {
  return await doodGet('/account/info');
}

export async function getDoodAccountStats(lastDays?: string) {
  const params: Record<string, any> = {};
  if (lastDays) params.last = lastDays;
  return await doodGet('/account/stats', params);
}

export async function getDoodDmcaList(perPage = 500, page = 1) {
  return await doodGet('/dmca/list', { per_page: perPage, page });
}

export async function getDoodUploadServer() {
  return await doodGet('/upload/server');
}

export async function uploadLocalVideoToDood(filePath: string, originalName?: string) {
  const cfg = getDoodConfig();
  if (!cfg.apiKey) {
    throw new Error("مفتاح DoodStream API غير مسجل");
  }
  const serverRes = await getDoodUploadServer();
  const uploadServerUrl = serverRes.result || serverRes.Result;
  if (!uploadServerUrl) {
    throw new Error("تعذر الحصول على سيرفر الرفع الخاص بـ DoodStream");
  }

  const form = new FormData();
  form.append('api_key', cfg.apiKey);
  const fileName = originalName || path.basename(filePath);
  form.append('file', fs.createReadStream(filePath), fileName);

  const targetUrl = `${uploadServerUrl}?key=${cfg.apiKey}`;
  const response = await axios.post(targetUrl, form, {
    headers: {
      ...form.getHeaders(),
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 300000,
  });

  const data = response.data;
  if (data && data.result) {
    const normalizeItem = (item: any) => {
      if (!item || typeof item !== 'object') return item;
      const fileCode = item.filecode || item.file_code;
      if (item.protected_embed) {
        item.protected_embed = item.protected_embed.replace(/(?:playmogo\.com|dsvplay\.com|dood\.to|ds2play\.com)/gi, 'doodstream.com');
      } else if (!item.protected_embed && fileCode) {
        item.protected_embed = `https://doodstream.com/e/${fileCode}`;
      }
      if (item.embed_url) {
        item.embed_url = item.embed_url.replace(/(?:playmogo\.com|dsvplay\.com|dood\.to|ds2play\.com)/gi, 'doodstream.com');
      }
      if (item.download_url) {
        item.download_url = item.download_url.replace(/(?:playmogo\.com|dsvplay\.com|dood\.to|ds2play\.com)/gi, 'doodstream.com');
      }
      return item;
    };
    if (Array.isArray(data.result)) {
      data.result = data.result.map(normalizeItem);
    } else {
      data.result = normalizeItem(data.result);
    }
  }

  return data;
}

export async function cloneDoodFile(fileCode: string, folderId?: string) {
  const params: Record<string, any> = { file_code: fileCode };
  if (folderId) params.fld_id = folderId;
  return await doodGet('/file/clone', params);
}

export async function uploadUrlToDood(uploadUrl: string, folderId?: string, newTitle?: string) {
  const params: Record<string, any> = { url: uploadUrl };
  if (folderId) params.fld_id = folderId;
  if (newTitle) params.new_title = newTitle;
  return await doodGet('/upload/url', params);
}

export async function getDoodRemoteUploadList() {
  return await doodGet('/urlupload/list');
}

export async function getDoodRemoteUploadStatus(fileCode: string) {
  return await doodGet('/urlupload/status', { file_code: fileCode });
}

export async function getDoodRemoteUploadSlots() {
  return await doodGet('/urlupload/slots');
}

export async function actionDoodRemoteUpload(action: string, fileCode?: string) {
  const params: Record<string, any> = {};
  if (action === 'restart_errors') params.restart_errors = '1';
  if (action === 'clear_errors') params.clear_errors = '1';
  if (action === 'clear_all') params.clear_all = '1';
  if (fileCode) params.delete_code = fileCode;
  return await doodGet('/urlupload/actions', params);
}

export async function createDoodFolder(name: string, parentId?: string) {
  const params: Record<string, any> = { name };
  if (parentId) params.parent_id = parentId;
  return await doodGet('/folder/create', params);
}

export async function listDoodFolders(parentId?: string) {
  const params: Record<string, any> = {};
  if (parentId) params.fld_id = parentId;
  return await doodGet('/folder/list', params);
}

export async function listDoodFiles(folderId?: string) {
  const params: Record<string, any> = {};
  if (folderId) params.fld_id = folderId;
  return await doodGet('/file/list', params);
}
