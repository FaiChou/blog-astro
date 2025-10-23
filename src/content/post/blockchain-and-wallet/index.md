---
title: "blockchain and wallet"
publishDate: "2025-10-23"
description: "Nockchain 区块链和钱包"
tags: ["btc", "blockchain", "web3", "UTXO"]
---

想要参与 [nockchain](https://www.nockchain.org/) 挖矿，你需要有一台主机，可以 CPU 挖矿和 GPU 挖矿。这个项目是公平启动(fair launch)的，也就是说项目方不会拿出一大部分币给机构或者个人。挖矿分为 solo 挖矿和参与矿池。个人设备算力有限建议加入矿池，根据自己的算力大小(shares)从矿池获取收益。挖到一个区块之后，会有相应的奖励，nockchain 的区块奖励全部给矿工。

1 个 $Nock 等于 65,536(2¹⁶) 个 Nick.

如果想要 solo 挖矿，可以从[官方项目库](https://github.com/zorp-corp/nockchain)中下载源码，编译安装。安装完成后先使用钱包工具生成公私钥，然后启动挖矿程序。

挖矿就是计算机不停的做计算，有新的交易会进行验证，挖到区块会将交易打包进区块当中，然后广播到网络中。当然也可以直接运行一个节点，不参与挖矿。这样挖矿程序会连接区块链网络，并且可以提供 Unix Socket 服务，可以给钱包等程序使用(`nockchain-wallet --nockchain-socket ./nockchain.sock <command>`)。当然想要连接网络，也可以直接使用默认的官网 rpc 服务，不需要加任何参数。

使用 `nockchain-wallet keygen` 命令生成公私钥，并且也会有一个助记词，请妥善保存。

可以从 [nockblocks](https://nockblocks.com/) 查询所有的区块/地址/交易。

当使用 `nockchain-wallet list-notes-by-pubkey` 命令后，它会连接到官方的 rpc 服务(https://nockchain-api.zorp.io)，输出内容如下:


```
Details
- Name: [DGEQBoT1nVJGZry2S2hScmkD27auheiZr5cLMoJEYhrUiCRRd9yX9zx 6zgW7x6bNgFJad2rrtsvKuS9bb3gvbYDe5JxdjXjzkQZsN7qFwiccV6] - Assets: 699560
- Block Height: 37437
- Source: 8qguqLkPUcQeJJEsNfWfMRJ16ic5K7kv63ySkycVq9qdLLFfyordytr
Lock
- Required Signatures: 1
- Signers: 2bc9h9E8zBHeJCyp9QWEmwGdX9uLGDRwJJMJMe8GEeSKKkPmoBx4Kq5ME8mic9WrhjfRmGeruy56zfWVZnqwrxChyRSHGUxDCgJzRd7RmH4qM7JGmGUpRypYJtK7yVEWTu1e
――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
Details
- Name: [DGEQBoT1nVJGZry2S2hScmkD27auheiZr5cLMoJEYhrUiCRRd9yX9zx 3Z9PsTPEhMch4bv7xZj9fL9bJpju3Li4dsAJsoPxNdHNa3F3YEY8tUs] - Assets: 253997
- Block Height: 36098
- Source: 3Xhy9A58YX7raj4bDVtXUBrnZJ99g6b9CtmMYT5BCN2Faa65MAh37jL
Lock
- Required Signatures: 1
- Signers: 2bc9h9E8zBHeJCyp9QWEmwGdX9uLGDRwJJMJMe8GEeSKKkPmoBx4Kq5ME8mic9WrhjfRmGeruy56zfWVZnqwrxChyRSHGUxDCgJzRd7RmH4qM7JGmGUpRypYJtK7yVEWTu1e
```

首先需要解释下，比如第一个 note，是打包在 37437 区块中，通过 https://nockblocks.com/block/37437 可以查看一些区块详情，其中包括区块高度，ID，时间，包含的交易数量，难度等信息。

一个区块可以打包很多交易的，第一个 note 显示的是在[这个交易](https://nockblocks.com/tx/VqtPCCaVXr9Xj9aMn3vBCNa5XhEwGaa64d84wZYAwAdDUesxJG3LRv)当中。Nockchain 使用 UTXO 模型，一个交易可以包含多个输入和多个输出。
我的这个交易可以看到只有一个输入，多个输出，输出中包含我的钱包公钥地址。

这个 note 是收到了 699560 个 Nick, 对应 10.67 个 NOCK，这是矿池给的奖励。

Name 字段是代表着这个交易中这个 note 的唯一 ID，它是个数组，并且可以发现，我的所有的 note Name 中数组第一位都是一样的，每个地址的 Name 第一位都是固定的，也就是代表这一个公钥地址。

另外可以看到后面有一个 Signers 字段，是我的钱包公钥地址，也就是只有这个公钥对应的私钥，才有办法解锁这笔钱。`Required Signatures: 1` 代表只需要一个签名就可以解锁。

Source 字段比较难推测是什么。

我猜测是这样的:

```
Note {
    name: Hash,           // 唯一ID
    source: Hash,         // 对应Lock的哈希
    amount: int,
    blockHeight: int
}

Lock {
    pubkeys: [PubKey],
    requiredSigs: int
}
```

每次转账给你时，系统会：

1. 构造一个新的 Lock 对象（内部包含你的公钥或公钥列表、签名策略、nonce等）

2.把该 Lock 的哈希作为 Source

3.用这个 Lock 来锁定新产生的 Note

也就是说每次别人给你钱的时候，哪怕是给同一个公钥，系统也会生成一个新的 Lock（比如因为每笔交易都有不同上下文），所以 Source 不会一样。

当有人要转账时：

```
function createTransaction(senderLock, recipientPubKey, amount) {
    // Step 1: 创建一个新的 Lock 对象
    let newLock = Lock{
        pubkeys: [recipientPubKey],
        requiredSigs: 1,
        nonce: random()
    }

    // Step 2: 计算这个 Lock 的哈希作为 Source
    let sourceHash = hash(newLock)

    // Step 3: 创建新的 Note
    let note = Note{
        name: hash(txid + outputIndex),  // 唯一标识
        source: sourceHash,              // 这个 Note 对应的 Lock
        amount: amount,
        blockHeight: currentHeight
    }

    return note
}

```

当有人花费某个 Note 时，节点会这样验证：

```
function validateSpend(note, signature) {
    // 根据 Note 的 source 找到 Lock 定义(Lock 哈希 → Lock 对象本身)
    let lock = getLockByHash(note.source)

    // 验证签名者是否满足 Lock 条件
    if (checkSignature(lock.pubkeys, signature, lock.requiredSigs)) {
        return true
    } else {
        return false
    }
}

function checkSignature(lock, signatures, message) {
    let validCount = 0

    for (let pubkey of lock.pubkeys) {
        for (let sig of signatures) {
            if (verify(pubkey, sig, message)) {
                validCount += 1
            }
        }
    }

    return validCount >= lock.requiredSigs;
}
```

另外关于 UTXO 模型，还想再多讲一下，可以让 GPT 帮你生成几个转账的例子。这里我讲一下钱包 app 的转账流程。当你的私钥导入钱包时候，它会推出来公钥是多少，然后从区块链网络上查询到所有关于你公钥的 UTXO，输入和输出分别有哪些，计算余额。当有新的区块被打包，它会从里面找到关于你的交易信息，如果 Output 包含你的地址，那么就会记录下来。如果 Input 引用了之前的输出，那么就从记录中删掉。

所以钱包维护了一个 UTXO 集合索引, 类似这样:

```
UTXO Set:
{
  "地址A": [
     { txid: tx_new, vout: 2, amount: 0.3 },
     { txid: tx_AE, vout: 1, amount: 0.099 },
     ...
  ],
  "地址B": [ ... ],
  ...
}
```

当你要发起转账时候，钱包会根据自己的策略(比如“优先花小额输出”)来取出输出，构造新的交易，也就是相当于钱包执行:

```
nockchain-wallet create-tx --names "[[DGEQBoT1nVJGZry2S2hScmkD27auheiZr5cLMoJEYhrUiCRRd9yX9zx 3h6V1m2hDFb4rDCTcZYB7kzqJyQF9sWRgW1PDbbqub8QxbNhAG4o2AJ]]" --recipients "[1 address]" --gifts "99" --fee 1
```

生成了一份 `.tx` 文件，然后调用 `nockchain-wallet send-txtxs xxx.tx` 来发送交易，钱包会用私钥来签名，然后广播到网络中，被矿工验证（上面有伪代码）后打包到区块链中。

另外，由于挖矿会频繁的给矿工奖励，所以会收到很多笔 note, 就像散落了一地的苹果，需要你一个个捡起来，它不像你的余额一样，可以完整的一次性使用，需要先归集，也就是用上面的命令 create-tx 时候将多个 names 数组放进去，再转到你的公钥地址，这样小苹果变成一个大苹果。或者接受地址直接填交易所地址，币就会直接打到交易所。
