/**
 * 键盘快捷键处理
 */
export class KeyboardHandler {
  constructor(player) {
    this.player = player;
    this._handler = this._onKeydown.bind(this);
    document.addEventListener('keydown', this._handler);
  }

  _onKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const { core, playlist } = this.player;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        core.togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        e.ctrlKey ? playlist.previous() : core.seekRelative(-10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        e.ctrlKey ? playlist.next() : core.seekRelative(10);
        break;
      case 'ArrowUp':
        e.preventDefault();
        core.adjustVolume(0.1);
        this.player.showToast(`音量: ${Math.round((core.art?.volume ?? 0.7) * 100)}%`);
        break;
      case 'ArrowDown':
        e.preventDefault();
        core.adjustVolume(-0.1);
        this.player.showToast(`音量: ${Math.round((core.art?.volume ?? 0.7) * 100)}%`);
        break;
      case 'KeyF':
        e.preventDefault();
        core.toggleFullscreen();
        break;
      case 'KeyM':
        e.preventDefault();
        core.toggleMute();
        break;
      case 'KeyL':
        e.preventDefault();
        core.seekRelative(10);
        break;
      case 'KeyJ':
        e.preventDefault();
        core.seekRelative(-10);
        break;
      case 'Escape':
        if (document.fullscreenElement) document.exitFullscreen();
        break;
      default:
        if (/^Key[0-9]$/.test(e.code)) {
          e.preventDefault();
          const pct = parseInt(e.code.replace('Key', '')) / 10;
          core.seekToPercent(pct);
        }
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._handler);
  }
}
