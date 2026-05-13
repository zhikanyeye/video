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
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-fullscreen');
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
        m3u8: this._playM3u8.bind(this),
        flv: this._playFlv.bind(this),
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
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    }
  }

  async _playFlv(video, url) {
    const flvjs = await this._loadFlv();
    if (flvjs.isSupported()) {
      const player = flvjs.createPlayer({ type: 'flv', url });
      player.attachMediaElement(video);
      player.load();
    }
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

  cleanup() {
    if (this.art) {
      this.art.destroy(false);
      this.art = null;
    }
    this.playerType = null;
    this.parsedVideo = null;
  }
}
