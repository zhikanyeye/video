/**
 * 播放列表管理
 */
import * as store from '../store/index.js';

export class PlaylistManager {
  constructor(onChange) {
    this.list = [];
    this.index = 0;
    this.repeatMode = 0; // 0=不循环, 1=单曲循环, 2=列表循环
    this.shuffleMode = false;
    this._onChange = onChange;
  }

  load(playlist, startIndex = 0) {
    this.list = playlist;
    this.index = Math.min(startIndex, playlist.length - 1);
    this._onChange?.();
  }

  get current() {
    return this.list[this.index] ?? null;
  }

  get length() {
    return this.list.length;
  }

  next() {
    if (this.list.length === 0) return null;
    if (this.repeatMode === 1) return this.current;

    if (this.shuffleMode) {
      this.index = Math.floor(Math.random() * this.list.length);
    } else {
      this.index = (this.index + 1) % this.list.length;
      if (this.index === 0 && this.repeatMode === 0) return null; // 播放结束
    }
    this._onChange?.();
    return this.current;
  }

  previous() {
    if (this.list.length === 0) return null;
    if (this.repeatMode === 1) return this.current;

    this.index = (this.index - 1 + this.list.length) % this.list.length;
    this._onChange?.();
    return this.current;
  }

  jumpTo(index) {
    if (index < 0 || index >= this.list.length) return;
    this.index = index;
    this._onChange?.();
    return this.current;
  }

  toggleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    return this.repeatMode;
  }

  toggleShuffle() {
    this.shuffleMode = !this.shuffleMode;
    return this.shuffleMode;
  }

  get repeatLabel() {
    return ['不循环', '单曲循环', '列表循环'][this.repeatMode];
  }

  get repeatIcon() {
    return ['repeat', 'repeat_one', 'repeat'][this.repeatMode];
  }
}
