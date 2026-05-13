/**
 * 播放器核心 — ArtPlayer / iframe 播放器初始化与控制
 */
import * as store from '../store/index.js';
import { delay, formatTime } from '../utils/index.js';
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
      moreVideoAttr: {
        crossOrigin: 'anonymous',
      },
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
    art.on('error', () => callbacks.onError?.(new Error('播放错误')));
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

    art.video?.addEventListener('loadedmetadata', reportResolution);
    art.video?.addEventListener('canplay', reportResolution);
    art.video?.addEventListener('resize', reportResolution);

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

  cleanup() {
    if (this.art) {
      this.art.destroy(false);
      this.art = null;
    }
    this.playerType = null;
    this.parsedVideo = null;
  }
}
