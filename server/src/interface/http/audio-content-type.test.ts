import { describe, expect, it } from 'vitest';
import { sniffAudioContentType } from './audio-content-type';

describe('sniffAudioContentType', () => {
  it('识别 WebM（Chrome 录音）的 EBML 头', () => {
    const buf = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(8)]);
    expect(sniffAudioContentType(buf)).toBe('audio/webm');
  });

  it('识别 MP4（Safari 录音）偏移 4 的 ftyp', () => {
    const buf = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x20]),
      Buffer.from('ftypM4A '),
      Buffer.alloc(4),
    ]);
    expect(sniffAudioContentType(buf)).toBe('audio/mp4');
  });

  it('识别 Ogg', () => {
    expect(sniffAudioContentType(Buffer.from('OggS____'))).toBe('audio/ogg');
  });

  it('认不出时退回 webm', () => {
    expect(sniffAudioContentType(Buffer.from('garbage bytes'))).toBe('audio/webm');
  });
});
