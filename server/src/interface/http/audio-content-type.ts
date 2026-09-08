// 录音回放的 Content-Type 靠嗅探文件头判定，不靠上传时的声明或落盘扩展名：
// Chrome 录出 audio/webm，Safari 录出 audio/mp4，两边都得能在 <audio> 里播。
// 存储层按 blessing id 存不透明字节（见 LocalAudioStorage 注释），这里读回时还原类型。

/** 按魔数判定录音容器格式；认不出就退回 webm（Chrome 的默认，占绝大多数）。 */
export function sniffAudioContentType(buf: Buffer): string {
  // WebM / Matroska：EBML 头 0x1A 0x45 0xDF 0xA3
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'audio/webm';
  }
  // MP4 / ISO-BMFF：偏移 4 起是 'ftyp'
  if (
    buf.length >= 12 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    return 'audio/mp4';
  }
  // Ogg：'OggS'
  if (buf.length >= 4 && buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return 'audio/ogg';
  }
  return 'audio/webm';
}
