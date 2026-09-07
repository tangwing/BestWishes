// 手搓 multipart/form-data body，供测试用（不为测试单独加 form-data 依赖）。
// 真实前端用浏览器原生 FormData，这里手写是因为 fastify.inject 需要一个现成的 Buffer + boundary。

const BOUNDARY = '----bestwishes-test-boundary';

export function buildMultipartBody(
  fields: Record<string, string>,
  file: { fieldName: string; filename: string; contentType: string; data: Buffer },
): { body: Buffer; contentType: string } {
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  parts.push(
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
    ),
    file.data,
    Buffer.from('\r\n'),
  );
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${BOUNDARY}` };
}
