/**
 * 播放源检测与 ffprobe 编码诊断
 */
import { Router } from 'express';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import ffprobeStatic from 'ffprobe-static';
import { FETCH_TIMEOUT_MS } from '../config.js';
import { isSafeFetchUrl } from '../utils/safe-url.js';

const PROBE_TIMEOUT_MS = 18_000;
const HEADER_TIMEOUT_MS = 10_000;

export function createProbeRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: '缺少 url 参数' });

    try {
      if (!(await isSafeFetchUrl(url))) {
        return res.status(403).json({ error: '不允许访问内网地址' });
      }

      const [headers, mediaResult] = await Promise.allSettled([
        probeHeaders(url),
        runFfprobe(url),
      ]);

      const headersData = headers.status === 'fulfilled' ? headers.value : {};
      const media = mediaResult.status === 'fulfilled' ? mediaResult.value : null;
      const mediaError = mediaResult.status === 'rejected' ? mediaResult.reason?.message : null;

      res.json({
        url,
        headers: headersData,
        media,
        mediaError,
        diagnosis: diagnose(headersData, media || { video: null, audio: null, streams: [], format: {} }),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

async function probeHeaders(url) {
  let result = await requestHeaders(url, 'HEAD');
  if ([405, 403].includes(result.statusCode)) result = await requestHeaders(url, 'GET', { range: 'bytes=0-0' });
  return normalizeHeaders(result);
}

function requestHeaders(url, method, extraHeaders = {}, redirectCount = 0) {
  if (redirectCount > 2) throw new Error('重定向次数过多');
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return reject(new Error('无效URL')); }
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QingyunboProbe/2.0)',
        Accept: '*/*',
        ...extraHeaders,
      },
      timeout: Math.min(FETCH_TIMEOUT_MS, HEADER_TIMEOUT_MS),
    }, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        const next = new URL(resp.headers.location, url).href;
        resp.resume();
        requestHeaders(next, method, extraHeaders, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      resp.resume();
      resolve({ statusCode: resp.statusCode, headers: resp.headers, finalUrl: url });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.end();
  });
}

function normalizeHeaders(result) {
  const headers = result.headers || {};
  return {
    statusCode: result.statusCode,
    finalUrl: result.finalUrl,
    contentType: headers['content-type'] || '',
    contentLength: parseInteger(headers['content-length']),
    acceptRanges: headers['accept-ranges'] || '',
    contentRange: headers['content-range'] || '',
    accessControlAllowOrigin: headers['access-control-allow-origin'] || '',
    cacheControl: headers['cache-control'] || '',
    server: headers.server || '',
  };
}

function runFfprobe(url) {
  const ffprobePath = ffprobeStatic.path || ffprobeStatic;
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-probesize', '5000000',       // 最多读取 5MB 头部数据
      '-analyzeduration', '3000000', // 最多分析 3 秒
      '-show_entries', 'stream=index,codec_type,codec_name,profile,width,height,pix_fmt,level,bit_rate:format=format_name,format_long_name,duration,size,bit_rate',
      '-of', 'json',
      url,
    ];
    const child = spawn(ffprobePath, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('ffprobe 检测超时'));
    }, PROBE_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `ffprobe 退出码 ${code}`));
        return;
      }
      try {
        resolve(normalizeProbe(JSON.parse(stdout)));
      } catch {
        reject(new Error('ffprobe 返回无法解析'));
      }
    });
  });
}

function normalizeProbe(raw) {
  const streams = Array.isArray(raw.streams) ? raw.streams.map((stream) => ({
    index: stream.index,
    type: stream.codec_type,
    codec: stream.codec_name || 'unknown',
    profile: stream.profile || '',
    width: stream.width || null,
    height: stream.height || null,
    pixelFormat: stream.pix_fmt || '',
    bitRate: parseInteger(stream.bit_rate),
    level: stream.level || null,
  })) : [];

  const format = raw.format || {};
  return {
    format: {
      name: format.format_name || '',
      longName: format.format_long_name || '',
      duration: parseFloat(format.duration) || null,
      size: parseInteger(format.size),
      bitRate: parseInteger(format.bit_rate),
    },
    streams,
    video: streams.find((stream) => stream.type === 'video') || null,
    audio: streams.find((stream) => stream.type === 'audio') || null,
  };
}

function diagnose(headers, media) {
  const warnings = [];
  const suggestions = [];
  const video = media.video;
  const audio = media.audio;

  if (headers.statusCode && headers.statusCode >= 400) {
    warnings.push(`源站返回 HTTP ${headers.statusCode}`);
  }
  if (!headers.acceptRanges && !headers.contentRange) {
    warnings.push('源站未明确支持 Range 请求，长视频拖动或加载可能不稳定');
  }
  if (!headers.accessControlAllowOrigin) {
    warnings.push('源站未返回 CORS 头，部分浏览器能力可能受限');
  }
  if (video && ['hevc', 'h265'].includes(video.codec)) {
    warnings.push('视频编码是 HEVC/H.265，很多浏览器会出现有声音无画面');
    suggestions.push('转码为 H.264 + AAC 的 MP4，可最大化网页端兼容性');
  }
  if (video && ['av1', 'vp9'].includes(video.codec)) {
    warnings.push(`${video.codec.toUpperCase()} 编码在旧设备或旧浏览器上可能无法播放`);
  }
  if (video && video.pixelFormat && /(10|12)le|p10|p12/i.test(video.pixelFormat)) {
    warnings.push(`视频像素格式 ${video.pixelFormat} 可能是高位深，网页端兼容性较差`);
  }
  if (audio && !['aac', 'mp3', 'opus', 'vorbis'].includes(audio.codec)) {
    warnings.push(`音频编码 ${audio.codec} 可能不被浏览器支持`);
  }
  if (!video) warnings.push('未检测到视频轨');
  if (!audio) warnings.push('未检测到音频轨');

  if (warnings.length === 0) {
    suggestions.push('未发现明显兼容性问题，若仍无法播放，请检查防盗链、签名过期或浏览器控制台错误');
  }

  return {
    playableHint: warnings.length === 0 ? 'likely' : 'risky',
    warnings,
    suggestions,
  };
}

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
