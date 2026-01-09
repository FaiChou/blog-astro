---
title: "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
publishDate: "2025-10-29"
description: "深入解析 TLS 握手流程与密码套件：ECDHE 密钥交换、RSA 身份认证、AES-GCM 认证加密、HKDF 密钥派生，以及 TLS 1.2/1.3 的差异"
tags: ["tls", "https", "openssl", "cryptology"]
---

对于 HTTPS 的握手过程，也就是 TLS 1.2 和 1.3 版本的传输层安全，有很多关键字需要扫盲一下。

首先要知道，https 用到了对称加密和非对称加密。其中的密钥交换过程是挺有研究意义的。

TLS 握手（以 TLS1.2 为例使用套件 TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384）是一个安全密钥协商和加密通信通道建立的过程。这个 chiper suite 代表了加密过程中用到的算法组合：

- ECDHE: 椭圆曲线 Diffie-Hellman Ephemeral，用于密钥交换，产生共享密钥 `shared_secret`
- RSA: 用于认证，服务端用 RSA 私钥签名验证自己身份
- AES_256_GCM: 对称加密算法，并且可以保证数据完整性
- SHA384: 哈希算法，用于握手消息完整性校验和伪随机函数生成密钥

握手的大致流程是:

1. 客户端发送 client hello, 包含支持的 ciper suites, TLS 版本，随机数 `client_random`, 支持的椭圆曲线等，其中 ciper suites 就包含上面提到的 TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384

2. 服务端响应 server hello, 服务器会选择一个 ciper suite, 生成 `server_random`，返回服务端证书（RSA 公钥），并指明要用的椭圆曲线（curve，比如 x25519, p256, p384, p521）

3. 使用 ECDHE, 则服务器发送 Server Key Exchange, 服务器生成一堆临时的椭圆曲线密钥对(sk_s, pk_s), 将公钥 pk_s 发送给客户端，并用 RSA 私钥对其签名

4. 服务器会发送 Server Hello Done，告知客户端，它的初始问候消息发送完毕

5. 客户端 Client Key Exchange, 客户端也生成一堆临时椭圆曲线密钥（sk_c, pk_c）, 把公钥 pk_c 发送给服务器

6. 客户端和服务器互相发送 Change Cipher Spec, 告知对方，后续的通信将使用对称加密, 并发送 Finished 包，告知对方，握手完成


在其中还会 ECDHE 共享密钥的计算，客户端和服务器通过椭圆曲线 Diffie-Hellman 算法生成共享密钥 `shared_secret`:

```
shared_secret = ECDH(sk_c, pk_s) = ECDH(sk_s, pk_c)
```

由于 ECDHE 的特性，双方都能计算出同样的 shared_secret. 计算出 shared_secret 后，还需要用其派生会话密钥 session_key, 双方用 shared_secret, client_random, server_random 通过 PRF(基于 SHA384) 生成多个密钥:

- `client_write_key`, `server_write_key`(AES-256 对称加密密钥)
- `client_write_iv`, `server_write_iv`(初始化向量)
- `MAC` key 或者 AEAD 用的密钥（由于是 GCM，所以不需要单独的 MAC key）

到了 TSL 1.3 后，握手流程就更加简化了:

- 删除了非前向安全算法(RSA key exchange)
- 默认使用 ECDHE，保证前向安全
- 合并 `ServerKeyExchange` 和 `ClientKeyExchange` 到更少的消息中
- 移除了 MAC-based record protection, 使用 AEAD 替代(AES-GCM, ChaCha20-Poly1305)

TLS 1.3 的握手流程:

1. client helo 阶段会发送支持的 TLS 版本，ciper suites, 椭圆曲线参数，`client_random`, 支持的 KeyShare(比如 ECDHE 的公钥 pk_c), 如果是会话恢复或 0-RTT，可附带 PSK ticket

2. server hello 阶段会选择一个 ciper suite, 比如 `TSL_AES_256_GCM_SHA384`，并且发送服务器端的 ECDHE 公钥 pk_s 和 `seerver_random`

3. Encrypted Extensions/Certificate/Certificate Verify

4. Finished 阶段，双方基于 ECDHE 计算出 `shared_secret`，并用 HKDF 派生出会话密钥，握手完成，后续数据使用对称密钥加密


## 名词解释

上面流程看完肯定很懵，没有接触过加密算法的同学面对这些关键字无从下手。那么先从简单的来解释。


#### SHA 哈希算法

SHA 开头的都是哈希算法，比如 SHA256, SHA384, SHA512，后面的数字代表哈希算法的输出长度，哈希算法保证:

- 同样的输入一定会有同一个结果输出
- 雪崩效应，改一点输入内容，会产生完全不同的结果
- 不可逆，无法从结果推导出输入
- 抗碰撞，可能会有两个不同输入产生相同的输出，但越长的哈希算法，碰撞的概率越低

#### RSA 非对称加密算法

需要一对公私钥，公钥公开，私钥保密。一般情况下，公钥用于加密，私钥用于解密。但也可以反过来，私钥加密，公钥解密，比如签名认证。可以通过私钥来计算出公钥。

#### AES 对称加密算法

相对于非对称加密，对称加密的密钥是相同的，所以不需要进行密钥交换。而且对称加密的加解密速度比非对称加密快很多。
AES-128, AES-192, AES-256 后面的数字代表密钥长度，密钥越长，破解难度呈指数级增长，但也需要更多的计算资源。AES-128目前对于大多数应用来说已经非常安全。

AES 使用分组加密，AES一次不是加密一个字节，而是加密一个数据块。AES的块大小固定为 128位（16个字节）。如果数据不是128位的整数倍，就需要使用填充模式（如PKCS#7）来将数据补齐。由于数据通常远大于128位，我们需要一个模式来重复应用AES算法加密多个块。常见的模式有：

- ECB（电子密码本）：最简单的模式，每个块独立加密。不安全！ 相同的明文块会生成相同的密文块，会暴露数据模式。**绝不推荐使用。**
- CBC（密码分组链接）：每个明文块先与前一个密文块进行异或操作，然后再加密。需要一个初始化向量（IV） 来加密第一个块。这是最常用的模式之一，但需要处理填充问题。
- CTR（计数器模式）：它将一个计数器加密后与明文进行异或来产生密文。它不需要填充，并且可以并行加密/解密，效率很高。

上面这三种属于**基本模式**，也就是说通过加密算法，仅能得出一个加密后的值，只提供保密性，没有办法提供**完整性**和**认证**。现代的应用都选择了新的**认证加密模式** AEAD(Authenticated Encryption with Associated Data)，最常用的就是 GCM。

#### GCM (Galois/Counter Mode) - 伽罗瓦/计数器模式

本质上就是一个 CTR 计数器模式，再加上一个 GMAC，用于认证和完整性校验。性能高，硬件支持好。同时生成密文和一个认证标签（tag），并且支持关联数据（AAD）。被广泛应用于TLS 1.2/1.3、SSH、IPSec等协议中。是当前最推荐使用的模式。

也就是说，使用这个算法，不光可以生成一个加密后的密文，还会生成一个 tag 用来验证数据的完整性，并且支持携带额外数据(AAD)，而且这个额外数据也是参与到了认证计算。下面用代码举例:

```javascript
import crypto from "crypto";

// 1. 随机生成 256 位密钥（32 字节）
const key = crypto.randomBytes(32);

// 2. 随机生成 96 位 IV（12 字节）
const iv = crypto.randomBytes(12);

// 3. 要加密的明文
const plaintext = "hello, this is a secret message";

// 4. 附加认证数据（不加密）
const aad = Buffer.from("header-data");

// 5. 加密
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
cipher.setAAD(aad);

const encrypted = Buffer.concat([
  cipher.update(plaintext, "utf8"),
  cipher.final(),
]);

const tag = cipher.getAuthTag();

console.log("Ciphertext:", encrypted.toString("hex"));
console.log("Auth Tag:", tag.toString("hex"));
console.log("IV:", iv.toString("hex"));
console.log("Key:", key.toString("hex"));

// 6. 解密
const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
decipher.setAAD(aad);
decipher.setAuthTag(tag);

const decrypted = Buffer.concat([
  decipher.update(encrypted),
  decipher.final(),
]);

console.log("Decrypted:", decrypted.toString("utf8"));

```

#### AEAD, HKDF, MAC

MAC 是 Message Authentication Code，消息认证码，用于验证数据的完整性。

HKDF 是 HMAC-based Key Derivation Function，基于 HMAC 的密钥派生函数。 其中 HMAC 是 Hash-based Message Authentication Code，基于哈希的消息认证码。

AEAD 是 Authenticated Encryption with Associated Data，认证加密关联数据。

旧式的做法，是 Mac-based 加密，先加密 `ciphertext = Encrypt(key_enc, plaintext)`, 再计算 MAC `tag = MAC(key_mac, ciphertext)`, 最后发送 `ciphertext || tag`。缺点是需要维护两把密钥。现在的 AEAD 比如 GCM 算法直接在一个算法内可以生成 `ciphertext + auth_tag`。一步完成加密和认证，不会出错。

HKDF 有两个阶段:

- Extract（提取）：把输入密钥材料（IKM）“压缩”成一个固定长度的伪随机密钥（PRK）。
- Expand（扩展）：基于 PRK 生成任意长度的输出密钥（OKM）。

伪代码如下：

```
HKDF-Extract(salt, IKM) -> PRK
    PRK = HMAC(salt, IKM)

HKDF-Expand(PRK, info, L) -> OKM
    N = ceil(L / HashLen)
    T = ""
    for i = 1 to N:
        T(i) = HMAC(PRK, T(i-1) || info || i)
    OKM = T(1) || T(2) || ... || T(N)
```

HMAC 的定义是：`HMAC(K, m) = H((K ⊕ opad) || H((K ⊕ ipad) || m))`, 其中 `H` 就是哈希函数，在 `TLS_AES_256_GCM_SHA384` 这个套件里 `H` 取的是 SHA-384。所以整个 HKDF 的底层哈希算法就是 SHA-384。

所以 tls 1.3 中的流程伪代码如下:

```
shared_secret = ECDHE(client_priv, server_pub)

handshake_secret = HKDF_Extract(salt = zeros(48), IKM = shared_secret)

client_traffic_secret = HKDF_Expand(
    PRK = handshake_secret,
    info = "c hs traffic", 
    L = 48
)
server_traffic_secret = HKDF_Expand(
    PRK = handshake_secret,
    info = "s hs traffic",
    L = 48
)

client_key = HKDF_Expand(PRK = client_traffic_secret, info = "key", L = 64)
client_iv = HKDF_Expand(PRK = client_traffic_secret, info = "iv", L = 12)
server_key = HKDF_Expand(PRK = server_traffic_secret, info = "key", L = 64)
server_iv = HKDF_Expand(PRK = server_traffic_secret, info = "iv", L = 12)
```

这样客户端和服务器都会生成这四个相同的 key 和 iv。当客户端发送消息时 `AES_256_GCM_Encrypt(data, client_key, client_iv)`, 服务端收到后 `AES_256_GCM_Decrypt(data, client_key, client_iv)`。
反过来，服务器发送消息时用 `server_key/server_iv`, 客户端解密也用同一套。

#### tls1.3 中 client_random / server_random 用在了什么地方？

在 TLS 1.2 中，client_random 和 server_random 是直接参与 master secret 计算的。而 TLS 1.3 中，client_random 和 server_random 作为 ClientHello/ServerHello 消息的一部分, 参与 handshake message hash 的生成。

```
HandshakeMessages = ClientHello || ServerHello || ...  # 之前所有 handshake 消息
transcript_hash = SHA384(HandshakeMessages)
```

这里 HandshakeMessages 包含了 client_random 和 server_random。

然后派生密钥：

```
c_hs_traffic_secret = HKDF_Expand_Label(
    handshake_secret,
    label="c hs traffic",
    context=transcript_hash,
    length=hash_len
)
s_hs_traffic_secret = HKDF_Expand_Label(
    handshake_secret,
    label="s hs traffic",
    context=transcript_hash,
    length=hash_len
)
```

所以 client_random / server_random 的作用 是通过 transcript hash 间接参与 HKDF，保证 handshake secret 不可预测。

#### ECDHE

ECDH 全称是 Elliptic Curve Diffie–Hellman，中文一般叫**椭圆曲线 Diffie-Hellman 密钥交换算法**，它不是一个「加密算法」，而是一个**密钥交换算法（key exchange algorithm）**，让通信双方安全地协商出一个共享密钥，然后这个密钥可以用来进行对称加密（比如 AES）。

双方各自生成一个公钥和私钥，然后通过对方的公钥和自己的私钥进行椭圆曲线点乘，算出一个相同的共享秘密（shared secret）。因为椭圆曲线离散对数问题非常难，所以即使有人截获公钥，也无法推算出共享密钥。

伪代码如下:

```
选定椭圆曲线参数（例如 secp256r1）

# Alice 生成密钥对
Alice_private = random(1, n-1)
Alice_public = Alice_private * G

# Bob 生成密钥对
Bob_private = random(1, n-1)
Bob_public = Bob_private * G

# 双方交换公钥
# Alice 收到 Bob_public
# Bob 收到 Alice_public

# 各自计算共享密钥
Alice_shared = Alice_private * Bob_public
Bob_shared   = Bob_private * Alice_public

# 因为 (Alice_private * Bob_public) == (Bob_private * Alice_public)
# 所以共享密钥相同
```

然后可以再对 shared_secret 进行哈希或 HKDF 导出成对称加密密钥，例如：`shared_key = HKDF(shared_secret, salt, info, output_length=32)`.

