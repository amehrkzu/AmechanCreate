"use strict";
// ダウンロード用:ファイルをパスワードで暗号化・元に戻す(ブラウザの WebCrypto。https か localhost で動く)
//   暗号化したファイルの中身:
//     "AMEENC1"(7バイト) + salt(16バイト) + iv(12バイト) + AES-GCM(256bit)で暗号化した [名前の長さ(2バイト) + 名前(UTF-8) + 元のファイル]
//   鍵はパスワードから PBKDF2(SHA-256・60万回)で作る。パスワードが違うと、元に戻すところで失敗する
//   (暗号化したファイルは誰でも取れるが、パスワードが無いと中身は読めない)
const AmeCrypt = (() => {
  const MAGIC = new TextEncoder().encode("AMEENC1");
  const ITERATIONS = 600000;

  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  // file(Blob)を暗号化する。name は、元に戻したときのファイル名
  async function encrypt(file, name, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const nameBytes = new TextEncoder().encode(name);
    const body = new Uint8Array(await file.arrayBuffer());
    const plain = new Uint8Array(2 + nameBytes.length + body.length);
    new DataView(plain.buffer).setUint16(0, nameBytes.length);
    plain.set(nameBytes, 2);
    plain.set(body, 2 + nameBytes.length);
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deriveKey(password, salt), plain));
    return new Blob([MAGIC, salt, iv, sealed], { type: "application/octet-stream" });
  }

  // 暗号化したファイル(ArrayBuffer)を元に戻す。{ name, data(Uint8Array) }
  //   形が違う → Error("format")、パスワードが違う → Error("password")
  async function decrypt(buffer, password) {
    const b = new Uint8Array(buffer);
    if (b.length < 7 + 16 + 12 + 16 || MAGIC.some((v, i) => b[i] !== v)) throw new Error("format");
    const salt = b.slice(7, 23), iv = b.slice(23, 35), sealed = b.slice(35);
    let plain;
    try {
      plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await deriveKey(password, salt), sealed));
    } catch {
      throw new Error("password");
    }
    const n = new DataView(plain.buffer).getUint16(0);
    return { name: new TextDecoder().decode(plain.slice(2, 2 + n)), data: plain.slice(2 + n) };
  }

  // ブラウザにファイルとして保存させる
  function save(data, name, type = "application/octet-stream") {
    const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return { encrypt, decrypt, save };
})();
