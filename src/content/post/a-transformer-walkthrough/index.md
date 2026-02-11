---
title: "From Embedding to Attention: A Transformer Walkthrough"
description: "从 Embedding、Attention 到 Prefill 与 Decode 的梳理。涵盖 QKV、因果注意力、KV Cache、FFN 与残差等概念。"
publishDate: "2026-02-11"
tags: ["llm"]
---

在[上一篇文章](/posts/llm-for-beginners/)中，简单介绍了 LLM 的训练流程和 Transformer 的自注意力机制。这篇文章想把 Transformer 的内部结构拆得更细一些——从分词到 Embedding，从 QKV 到因果掩码，从 FFN 到残差连接，再到推理阶段的 Prefill 与 Decode。

## 分词：BPE

在进入模型之前，文本需要先被切成 token。现代 LLM 普遍使用 BPE（Byte Pair Encoding）分词算法。BPE 的核心思路是：从字符级开始，不断合并出现频率最高的相邻字符对，直到达到预设的词表大小。

```
"unhappiness"
↓ BPE 分词
["un", "happi", "ness"]   # 3 个 token

"ChatGPT"
↓ BPE 分词
["Chat", "G", "PT"]       # 3 个 token
```

BPE 的好处：

- 词表可控（通常 32K-100K）
- 永远不会 OOV（最差情况拆成单字符）
- 能捕捉词根词缀的语义（`un-` 表否定，`-ness` 表名词化）

分词之后，每个 token 会被映射为一个整数 ID（token ID），这是模型唯一认识的东西。

## Embedding：离散到连续

拿到 token ID 之后，需要通过 Embedding Matrix 把离散的整数映射为连续的高维向量。Embedding Matrix 本质上就是一个查找表：

```
假设词表大小 V = 128,000，embedding 维度 d = 4096
那么 Embedding Matrix 的 shape 就是 (128000, 4096)

Token ID = 2054  →  取矩阵第 2054 行  →  得到一个 4096 维向量
```

每个向量就是一个浮点数数组：

```
[0.0234, -0.1892, 0.4521, ..., 0.0087]  # 4096 个数
```

这些数字是训练出来的，不是人工设定的。训练之后，语义相近的词在高维空间中的向量距离会更近，比如君主和帝王两个会距离会近些。

具体来说，一个句子经过分词和 Embedding 后的变换过程：

```
token_ids = [101, 2054, 2024, 2027, ...]  # 长度 11
                    ↓
embedding_matrix[token_ids]
                    ↓
[embedding_matrix[101], embedding_matrix[2054], embedding_matrix[2024], ...]
                    ↓
shape: [11, 4096]  即 [seq_len, hidden_size]
```

每个 token 对应一个 4096 维向量。整个序列就变成了一个 `(seq_len, hidden_size)` 的矩阵（张量），交给后续的 Transformer 层处理。

顺带说一下维度术语：

| 维度 | 数学术语 | 代码里常叫 |
|------|----------|------------|
| 0维 | 标量 | scalar |
| 1维 | 向量 | vector / 1D array |
| 2维 | 矩阵 | matrix / 2D array |
| 3维+ | 张量 | tensor / ND array |

Embedding Matrix 是 2D 矩阵，但 Transformer 里流动的数据通常是 3D 张量（加了 batch 维度）。

## Attention：信息融合

拿到 Embedding 向量之后，进入 Transformer 的核心——自注意力机制。

### QKV 变换

每个 token 的向量 X 通过三个不同的权重矩阵进行线性变换（矩阵乘法），得到 Query、Key、Value：

```
Q = X @ Wq  # (n, 4096) @ (4096, 4096) → (n, 4096)
K = X @ Wk  # 同上
V = X @ Wv  # 同上
```

> 实际在 PyTorch 等框架中，为了效率通常是将 Wq、Wk、Wv 拼成一个大矩阵 W_qkv `(4096, 4096×3)`，一次矩阵乘法 `X @ W_qkv` 算完再拆分成 Q、K、V，效果等价但更快。

直观理解：

- **Q（Query）**："我该关注谁？"
- **K（Key）**："我是什么，匹不匹配？"
- **V（Value）**："如果匹配了，拿走我的信息。"

### 注意力计算

`Attention(Q, K, V) = softmax(Q·K^T / √d_k) · V`

分步拆解，假设序列长度 n=4：

**Step 1：计算注意力分数**

```
scores = Q @ K^T  # (4, 4096) @ (4096, 4) → (4, 4)
```

这是一个 n×n 的矩阵，本质是内积（向量点积），表示每个 token 对其他所有 token 的关注程度。除以 √d_k 是为了防止点积值过大导致 softmax 梯度消失。

**Step 2：softmax 归一化**

对分数矩阵的每一行做 softmax，让每行的权重和为 1：

```
        x1    x2    x3    x4
x1   [ 0.8   0.1   0.05  0.05 ]  ← x1 主要关注自己
x2   [ 0.2   0.5   0.2   0.1  ]  ← x2 关注自己和 x1
x3   [ 0.1   0.3   0.4   0.2  ]
x4   [ 0.05  0.15  0.3   0.5  ]
```

softmax 是一个非线性归一化函数，它把任意实数向量压缩成概率分布（所有值为正数，且和为 1）。

**Step 3：加权求和**

```
output = scores @ V  # (4, 4) @ (4, 4096) → (4, 4096)
```

每个 token 的输出向量 = 所有 token 的 V 向量的加权平均，权重就是注意力分数。这一步本质也是矩阵乘法，也就是内积和加权求和。

所以 Attention 的输出不是一个标量，而是和输入同 shape 的向量序列——每个向量都「看过」了其他位置，融合了上下文信息。

| 中间产物 | Shape | 含义 |
|---------|-------|------|
| Q, K, V | (n, d) | 每个 token 的查询/键/值向量 |
| Q @ K^T | (n, n) | 注意力分数矩阵 |
| softmax(...) | (n, n) | 归一化后的注意力权重 |
| 最终输出 | (n, d) | 融合上下文后的新向量序列 |

实际的 Transformer 使用的是 **Multi-Head Attention**：将 Q、K、V 拆分到多个 head（比如 32 个），每个 head 独立计算注意力，最后 concat 起来。concat 之后还需要经过一个 **Output Projection**（W_o 矩阵）线性变换，才能变回 `(n, d)` 与残差相加。这样不同的 head 可以关注不同维度的特征，W_o 则负责将多头的信息融合映射回原始维度。

### 因果掩码（Causal Mask）

GPT、Claude、Llama 这些生成式模型都是 **Decoder-only** 架构，使用单向自回归——当前 token 只能看到自己和之前的 token，不能偷看后面的：

```
"苹果 好吃"

处理「苹果」时：只能看到自己（和之前的词）
处理「好吃」时：可以看到「苹果」+ 自己
```

这就是因果掩码——把未来信息遮住。实现方式是在 attention score 矩阵上应用一个上三角 mask，把不该看的位置设为 `-∞`，这样经过 softmax 后权重变成 0。

这也意味着对于「苹果好吃」和「苹果手机」，GPT 在处理「苹果」时并不知道后面是「好吃」还是「手机」。它的理解是通过层层堆叠实现的——后续 token 融合了「苹果」的信息，最终模型基于整体语境生成输出。

与之对比的是 BERT 这类 **Encoder-only** 模型，使用双向注意力，前后都能看到。BERT 的训练方式是完形填空（Masked Language Model），适合理解任务；GPT 是自回归生成，适合生成任务。

| 模型类型 | 注意力方向 | 代表 |
|---------|-----------|------|
| Encoder (BERT) | 双向 ↔️ | BERT, RoBERTa |
| Decoder (GPT) | 单向 → | GPT, Claude, Llama |
| Encoder-Decoder | 编码双向，解码单向 | T5, 原版 Transformer |

## FFN：知识存储

Attention 之后，每个位置的向量还要过一个 FFN（Feed-Forward Network，前馈网络）：

```
FFN(x) = Linear2(activation(Linear1(x)))

具体：
x: (4096,)
  ↓ Linear1: (4096 → 11008)   # 先扩大约 2.7 倍
  ↓ 激活函数
  ↓ Linear2: (11008 → 4096)   # 再压回来
输出: (4096,)
```

Attention 只做「信息混合」——让 token 之间交流，但矩阵乘法本身是线性的。FFN 引入了非线性变换，让模型能学到更复杂的特征：

- **Attention** = 「谁和谁相关」
- **FFN** = 「学到了相关性之后，怎么处理这个信息」

有研究认为 FFN 是模型存储「知识」的地方（比如「巴黎是法国首都」这类事实）。

一个重要的事实：**大约 2/3 的参数在 FFN 里**，FFN 才是参数大户，Attention 层的参数相比之下反而少一些。

### 激活函数：ReLU 与 SwiGLU

没有激活函数，多层线性变换就等于一层：

```
Linear2(Linear1(x)) = (W2 @ W1) @ x = W_combined @ x
```

还是线性的！必须引入非线性的激活函数。

**ReLU** 是最经典的激活函数：

```
ReLU(x) = max(0, x)
# 负数变 0，正数不变
```

但现代 LLM（如 Llama、Gemma）普遍使用 **SwiGLU** 替代 ReLU。SwiGLU 更平滑，训练效果更好。

## LayerNorm：归一化

LayerNorm（层归一化）的作用是把向量「洗」一遍——让均值变为 0，方差变为 1：

```python
def LayerNorm(x):
    mean = x.mean()
    std = x.std()
    return (x - mean) / std * gamma + beta  # gamma, beta 是可学习参数
```

深层网络训练时，每层的输出数值分布会漂移。LayerNorm 让每层输入保持稳定，训练更快更稳。可以类比考试分数标准化：原始分 80 分不知道好不好，标准化后 z=1.5 表示前 7%。

注意 LayerNorm 和 softmax 的区别：

- **softmax**：非线性归一化，把向量压缩成概率分布（所有值为正，**和为 1**）
- **LayerNorm**：把向量标准化到均值 0、方差 1，值可以是负数，和不一定为 1

## 残差连接

残差连接的核心思想：**输出 = 输入 + 变换(输入)**

```
output = x + Attention(x)   # 而不是 output = Attention(x)
```

为什么需要残差连接？

1. **梯度流动**：几十层的深层网络反向传播时，梯度容易消失或爆炸。有了残差，梯度可以「抄近道」直接流回浅层
2. **学习增量**：网络只需要学「在原来基础上改多少」，比从零学整个映射更容易
3. **保底机制**：最差情况，Attention 输出为 0，结果还是原来的 x，不会更差

## 完整的单层 Transformer

把上面所有组件拼起来，一个完整的 Transformer 层（Pre-Norm 结构，GPT/Llama 常用）：

```
输入 x
  ↓
x1 = LayerNorm(x)               ← 归一化
  ↓
x2 = x + MultiHeadAttention(x1) ← Attention + 残差连接
  ↓
x3 = LayerNorm(x2)              ← 归一化
  ↓
output = x2 + FFN(x3)           ← FFN + 残差连接
  ↓
进入下一层
```

| 组件 | 作用 |
|------|------|
| Attention | token 之间交流信息 |
| FFN | 处理/存储知识，引入非线性 |
| 激活函数 (SwiGLU) | 让网络能学非线性关系 |
| LayerNorm | 稳定训练，防止数值漂移 |
| 残差连接 | 让梯度流通，训练深层网络不退化 |

一个典型的 LLM（如 Llama 70B）会堆叠 80 层这样的结构。

### 多层数据流向

以 9 个 token 输入、32 层 Transformer 为例，数据的流向是这样的：

```
Embedding 输出: X1, X2, ..., X9   (9 个向量)
      ↓
Layer 1 (Wq1, Wk1, Wv1):
  X1~X9 → 各自生成 Q, K, V → 计算 Attention → 输出 Z1~Z9 (layer1)
      ↓
Layer 2 (Wq2, Wk2, Wv2):
  Z1~Z9 (layer1) 作为输入 → 重新生成 Q, K, V → 计算 Attention → 输出 Z1~Z9 (layer2)
      ↓
  ... 重复 ...
      ↓
Layer 32 (Wq32, Wk32, Wv32):
  → 输出 Z1~Z9 (layer32)
      ↓
只取 Z9 (layer32) → LM Head → 预测下一个 token
```

每一层都有**独立的** Wq、Wk、Wv 权重矩阵，上一层的输出作为下一层的输入。经过所有层之后，最后一层的 Z1~Z8 是不需要的（在生成任务中），**只有最后一个位置 Z9 会被送入 LM Head** 来预测下一个 token。因为自回归模型的因果掩码保证了 Z9 已经融合了前面所有 token 的信息。

## LM Head：输出层

经过所有 Transformer 层之后，取最后一个位置的输出向量（比如 Z_last），需要把它映射回词表，得到每个 token 的概率分布。这一步通过 **LM Head** 完成：

```
logits = Z_last @ LM_Head   # (4096,) @ (4096, 128000) → (128000,)
probs  = softmax(logits)     # 归一化成概率
next_token = sample(probs)   # 根据概率采样
```

LM Head 的 shape 是 `(hidden_dim, vocab_size)`。很多模型会使用 **weight tying（权重绑定）**——LM Head 就是 Embedding Matrix 的转置。这样做既节省参数，又保持了语义一致性：Embedding 时 token → 向量，输出时向量 → token，用的是同一个映射的正反方向。

## 推理流程：Prefill + Decode

LLM 的推理（inference）分为两个阶段：

### Prefill 阶段

用户输入的所有 token 一次性全量计算：

```
用户输入: "请将你好翻译成英文"
↓ 分词
tokens: [token1, token2, ..., token9]   # 9 个 token
↓ Embedding
X: [X1, X2, ..., X9]                   # 9 个向量
↓ 进入 32 层 Transformer
↓ 每层并行计算所有 token 的 Attention + FFN
↓ 每层产出 [Z1, Z2, ..., Z9]，作为下一层输入
↓ 最后一层输出的 Z9 → LM Head → 下一个 token
```

Prefill 是全量计算：Attention 矩阵是 n×n 的，每一层要等所有 Z 计算完才进入下一层。但同一层内所有 token 的计算是 GPU 并行的，所以 Prefill 虽然计算量大，但吞吐量高。

每一层还会缓存 K 和 V，存入 KV Cache 供后续 Decode 使用。

### Decode 阶段

从 Prefill 算出第一个输出 token 之后，进入逐 token 生成：

```
已有: [X1, X2, ..., X9]  → KV Cache 已就绪

生成第 10 个 token:
  输入: 只有 X10（新 token 的 embedding）

  Layer 1:
    Q10 = X10 @ Wq     # 只算 1 个 Q
    K10 = X10 @ Wk     → 追加到 KV Cache
    V10 = X10 @ Wv     → 追加到 KV Cache

    Attention: Q10 和 [K1...K10] 做点积 → 1×10 的注意力
    加权 [V1...V10] → 得到 Z10

  Layer 2~32: 同上，每层输入和输出都只有 1 个向量

  最终: Z10 → LM Head → 第 11 个 token
```

Decode 每次只跑一个 token 的 Attention（利用 KV Cache），不需要重新算之前所有 token 的 K、V。

### 对比

|  | Prefill | Decode |
|---|---------|--------|
| 输入 | n 个 token（全部） | 1 个 token（新生成的） |
| 每层输出 | n 个向量 | 1 个向量 |
| Attention 矩阵 | n × n | 1 × n |
| 瓶颈 | 计算密集（compute-bound） | 内存带宽（memory-bound） |
| GPU 利用率 | 高（并行） | 低（串行） |

这就是为什么输入很长的 prompt 时，需要等几秒才开始输出（Prefill 在跑全量计算），而一旦开始输出，速度还行（Decode 每次只算 1 个 token）。

### KV Cache

每一层都有独立的 KV Cache，因为每层的 Wk、Wv 权重矩阵不同，产生的 K、V 也完全不同：

```python
kv_cache = {
    "layer_0":  {"K": (n, num_heads, head_dim), "V": (n, num_heads, head_dim)},
    "layer_1":  {"K": ..., "V": ...},
    ...
    "layer_31": {"K": ..., "V": ...},
}
```

KV Cache 是 Decode 阶段的加速关键——避免重复计算前面 token 的 K 和 V。但它也是显存消耗的大户：对于 100K 上下文长度的请求，KV Cache 可以轻松吃掉几十 GB 显存。

注意 KV Cache 只优化 Decode 阶段。Prefill 是第一次处理输入，没有缓存可用，必须全量计算。（除非使用 Prompt Caching 之类的技术，把常用 system prompt 的 KV 预先算好）

### 为什么长上下文 Prefill 很贵？

Attention 的核心 `Q @ K^T` 复杂度是 O(n²·d)：

| 上下文长度 | Q @ K^T 矩阵大小 | 相对计算量 |
|-----------|-----------------|----------|
| 4K | 4K × 4K = 16M | 1x |
| 32K | 32K × 32K = 1B | 64x |
| 100K | 100K × 100K = 10B | 625x |

所以各家都在卷长上下文优化：Flash Attention（分块计算，不存完整矩阵）、Ring Attention（多卡分布式）、Sliding Window（局部窗口）等。

## 全流程回顾

把整个推理流程串一遍：

```
"请将你好翻译成英文"
  ↓ Tokenizer (BPE)
[token1, token2, ..., token9]
  ↓ Embedding Matrix lookup
[X1, X2, ..., X9]          shape: (9, 4096)
  ↓ Transformer Layer 1~32（Prefill，全量计算）
每层：LayerNorm → Attention(+残差) → LayerNorm → FFN(+残差)
  ↓ 最后一层输出 Z9
  ↓ LM Head (= Embedding Matrix^T)
logits: (128000,)
  ↓ softmax → 概率采样
"Hello"
  ↓ Decode 阶段，逐 token 生成，利用 KV Cache
...
```

## 历史背景

2017 年 Google 发表 *Attention Is All You Need*，提出了 Transformer 架构。论文标题就是宣言——只靠 Attention 就够了，干掉 RNN。

在此之前，RNN/LSTM 是序列建模的主流，但有致命缺陷：必须串行计算，长距离依赖难学。Transformer 用 Self-Attention 替代了循环结构，实现了完全并行训练。

| 时间 | 里程碑 |
|------|--------|
| 2017.06 | Transformer 论文发布 |
| 2018.06 | GPT-1（OpenAI，Decoder-only） |
| 2018.10 | BERT（Google，Encoder-only） |
| 2020.05 | GPT-3（175B 参数） |
| 2022.11 | ChatGPT（RLHF 对齐） |
| 2023+ | GPT-4, Claude, Gemini, Llama... |

## References

- [Attention Is All You Need](https://arxiv.org/abs/1706.03762)
- [LLM Visualization](https://bbycroft.net/llm)
- [Deep Dive into LLMs like ChatGPT](https://youtu.be/7xTGNNLPyMI)
