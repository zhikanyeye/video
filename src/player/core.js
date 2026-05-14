/**
 * 播放器核心 — ArtPlayer / iframe 播放器初始化与控制
 */
import * as store from '../store/index.js';
import { parseVideoUrl } from '../parsers/video-url.js';

export class PlayerCore {
  constructor() {
    this.art = null;
    this.playerType = null; // 'artplayer' | 'iframe'
    this.parsedVideo = null;
    this.externalPlayers = [];
  }

  /**
   * 初始化播放器
   * @param {Object} video - { title, url, type }
   * @param {HTMLElement} container
   * @param {Object} callbacks - { onPlay, onPause, onTimeUpdate, onEnded, onError }
   */
  async init(video, container, callbacks = {}) {
    this.cleanup();

    const parsed = await parseVideoUrl(video.url);
    this.parsedVideo = parsed;

    if (parsed.type === 'iframe') {
      this.playerType = 'iframe';
      this._initIframe(parsed, container, callbacks);
    } else if (parsed.type === 'rtmp') {
      throw new Error('浏览器不支持 RTMP 直连播放，请转换为 HLS/M3U8、MP4 或 WebRTC。');
    } else {
      this.playerType = 'artplayer';
      await this._initArtPlayer(parsed, video, container, callbacks);
    }
  }

  _initIframe(parsed, container, callbacks) {
    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = parsed.url;
    iframe.style.cssText = 'width:100%;height:100%;border:none;background:#000;';
    iframe.allowFullscreen = true;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-fullscreen allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    container.appendChild(iframe);
    callbacks.onVideoMeta?.({ width: 0, height: 0, type: 'iframe' });
    callbacks.onPlay?.();
  }

  async _initArtPlayer(parsed, video, container, callbacks) {
    if (typeof Artplayer === 'undefined') {
      throw new Error('ArtPlayer库未加载，请检查网络连接');
    }

    const support = this._checkNativeSupport(parsed);
    if (support.warning) callbacks.onPlaybackWarning?.(support.warning);

    const art = new Artplayer({
      container,
      url: parsed.url,
      title: video.title,
      autoplay: true,
      volume: store.getVolume(),
      muted: store.getMuted(),
      fullscreen: true,
      miniProgressBar: true,
      autoSize: false,
      autoMini: false,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      setting: true,
      hotkey: true,
      pip: true,
      mutex: true,
      fullscreenWeb: true,
      subtitleOffset: false,
      miniProgressBar: true,
      playsInline: true,
      customType: {
        mpd: this._playDash.bind(this),
        m3u8: this._playM3u8.bind(this),
        flv: this._playFlv.bind(this),
        ts: this._playMpegTs.bind(this),
      },
    });

    // 恢复播放速度
    art.on('ready', () => {
      const rate = store.getPlaybackRate();
      if (rate !== 1) art.playbackRate = rate;
      reportResolution();

      // 恢复播放进度
      const progress = store.getProgress(video.url);
      if (progress && progress.time > 5) {
        art.currentTime = progress.time;
        callbacks.onTimeUpdate?.(progress.time, progress.duration);
      }
    });

    art.on('play', () => callbacks.onPlay?.());
    art.on('pause', () => callbacks.onPause?.());
    art.on('time', (time) => {
      callbacks.onTimeUpdate?.(time, art.duration);
      store.saveProgress(video.url, time, art.duration);
    });
    art.on('ended', () => {
      store.clearProgress(video.url);
      callbacks.onEnded?.();
    });
    art.on('error', () => callbacks.onError?.(this._createPlaybackError(art.video, parsed)));
    art.on('volume', (vol) => {
      store.setVolume(vol);
      store.setMuted(art.muted);
    });
    art.on('rate', (rate) => store.setPlaybackRate(rate));
    art.on('destroy', () => { this.art = null; });

    const reportResolution = () => {
      const media = art.video;
      const width = media?.videoWidth || 0;
      const height = media?.videoHeight || 0;
      if (width > 0 && height > 0) {
        callbacks.onVideoMeta?.({ width, height, type: parsed.type });
      }
    };

    const checkMissingVideoTrack = () => {
      const media = art.video;
      if (!media || media.paused || media.ended) return;
      if (media.currentTime > 2 && media.videoWidth === 0 && media.videoHeight === 0) {
        callbacks.onPlaybackWarning?.('浏览器没有解码出视频画面，常见原因是视频编码不受浏览器支持，例如 H.265/HEVC、10bit 或特殊封装。');
      }
    };

    art.video?.addEventListener('loadedmetadata', reportResolution);
    art.video?.addEventListener('canplay', reportResolution);
    art.video?.addEventListener('resize', reportResolution);
    art.video?.addEventListener('timeupdate', checkMissingVideoTrack);

    this.art = art;
  }

  async _playM3u8(video, url) {
    const Hls = await this._loadHls();
    const sourceUrl = this._getHlsSourceUrl(url);
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        fragLoadingTimeOut: 20_000,
        manifestLoadingTimeOut: 15_000,
      });
      hls.loadSource(sourceUrl);
      hls.attachMedia(video);
      this._registerExternalPlayer(hls);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = sourceUrl;
    }
  }

  _getHlsSourceUrl(url) {
    const apiBase = this._getApiBase();
    if (!apiBase || url.startsWith(`${apiBase}/api/hls?`)) return url;
    if (!/^https?:\/\//i.test(url)) return url;
    return `${apiBase}/api/hls?url=${encodeURIComponent(url)}`;
  }

  _getApiBase() {
    const envBase = import.meta.env?.VITE_API_BASE?.trim();
    if (envBase) return envBase.replace(/\/+$/, '');

    const runtimeBase = window.APP_CONFIG?.API_BASE?.trim();
    if (runtimeBase && !runtimeBase.includes('your-backend')) return runtimeBase.replace(/\/+$/, '');

    const savedBase = localStorage.getItem('qingyunbo_api_base')?.trim();
    if (savedBase) return savedBase.replace(/\/+$/, '');

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3000' : '';
  }

  async _playFlv(video, url) {
    const flvjs = await this._loadFlv();
    if (flvjs.isSupported()) {
      const player = flvjs.createPlayer({ type: 'flv', url });
      player.attachMediaElement(video);
      player.load();
      this._registerExternalPlayer(player);
    }
  }

  async _playDash(video, url) {
    const dashjs = await this._loadDash();
    const player = dashjs.MediaPlayer().create();
    player.initialize(video, url, true);
    this._registerExternalPlayer(player);
  }

  async _playMpegTs(video, url) {
    const mpegts = await this._loadMpegTs();
    if (!mpegts.isSupported()) throw new Error('当前浏览器不支持 MPEG-TS 播放');
    const player = mpegts.createPlayer({ type: 'mse', isLive: false, url });
    player.attachMediaElement(video);
    player.load();
    this._registerExternalPlayer(player);
  }

  async _loadHls() {
    if (window.Hls) return window.Hls;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
      s.onload = () => resolve(window.Hls);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async _loadFlv() {
    if (window.flvjs) return window.flvjs;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/flv.js@1/dist/flv.min.js';
      s.onload = () => resolve(window.flvjs);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async _loadDash() {
    if (window.dashjs) return window.dashjs;
    return this._loadScript('https://cdn.jsdelivr.net/npm/dashjs@4/dist/dash.all.min.js', () => window.dashjs);
  }

  async _loadMpegTs() {
    if (window.mpegts) return window.mpegts;
    return this._loadScript('https://cdn.jsdelivr.net/npm/mpegts.js@1/dist/mpegts.min.js', () => window.mpegts);
  }

  async _loadScript(src, getGlobal) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((script) => script.src === src);
      if (existing) {
        existing.addEventListener('load', () => resolve(getGlobal()), { once: true });
        existing.addEventListener('error', reject, { once: true });
        const global = getGlobal();
        if (global) resolve(global);
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(getGlobal());
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // ---- 播放控制 ----

  play() { this.art?.play(); }
  pause() { this.art?.pause(); }
  togglePlayPause() { this.art?.toggle(); }
  seek(time) { if (this.art) this.art.currentTime = time; }
  seekRelative(delta) { if (this.art) this.art.currentTime = Math.max(0, this.art.currentTime + delta); }
  seekToPercent(pct) { if (this.art) this.art.currentTime = this.art.duration * pct; }
  setVolume(v) { if (this.art) this.art.volume = Math.max(0, Math.min(1, v)); }
  adjustVolume(delta) { this.setVolume((this.art?.volume ?? 0.7) + delta); }
  toggleMute() { if (this.art) this.art.muted = !this.art.muted; }
  toggleFullscreen() { this.art?.fullscreen?.toggle(); }

  get currentTime() { return this.art?.currentTime ?? 0; }
  get duration() { return this.art?.duration ?? 0; }
  get isPlaying() { return this.art?.playing ?? false; }

  _checkNativeSupport(parsed) {
    if (!['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'].includes(parsed.type)) return {};

    const media = document.createElement('video');
    const mimeByType = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'video/ogg',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      avi: 'video/x-msvideo',
    };
    const mime = mimeByType[parsed.type] || 'video/mp4';
    const result = media.canPlayType(mime);

    if (!result) {
      return {
        warning: `当前浏览器可能不支持 ${parsed.type.toUpperCase()} 容器或其中的编码。本地播放器能播不代表浏览器能解码。`,
      };
    }
    return {};
  }

  _createPlaybackError(media, parsed) {
    const code = media?.error?.code;
    const base = '播放失败';
    const suffix = '。如果下载后本地能播，多半是浏览器不支持该视频编码，建议使用 H.264 + AAC 的 MP4 或 HLS。';
    const messages = {
      1: `${base}: 加载被中止`,
      2: `${base}: 网络或跨域限制导致资源无法继续加载`,
      3: `${base}: 浏览器解码失败，可能是不支持当前视频编码`,
      4: `${base}: 当前格式或编码不被浏览器支持`,
    };
    const message = messages[code] || `${base}: 无法播放该资源`;
    const error = new Error(`${message}${['mp4', 'mov', 'mkv', 'avi'].includes(parsed?.type) ? suffix : ''}`);
    error.mediaErrorCode = code;
    return error;
  }

  _registerExternalPlayer(player) {
    if (player) this.externalPlayers.push(player);
  }

  cleanup() {
    for (const player of this.externalPlayers.splice(0)) {
      try {
        player.destroy?.();
      } catch { /* ignore */ }
    }
    if (this.art) {
      this.art.destroy(false);
      this.art = null;
    }
    this.playerType = null;
    this.parsedVideo = null;
  }
}
