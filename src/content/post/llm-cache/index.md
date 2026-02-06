---
title: "LLM 缓存机制：从计费到原理"
description: "探讨 LLM 的缓存机制（KV Cache），从工程角度解释自回归模型的算力优化原理，以及 Ollama、llama.cpp 和 Transformer 在其中的协作关系。"
publishDate: "2026-02-05"
tags: ["llm"]
---

在查看大模型 API 的调用日志时，经常会在计费详情里看到**缓存命中（Cache Hit）**。

```text
日志详情：
- 模型倍率 2.5
- 缓存倍率 0.1
- 输出倍率 5
...
提示 Tokens: 5963
缓存 Tokens: 5491 (命中率 92%)
补全 Tokens: 39
```

这就引出了一个问题：
**大模型（LLM）是自回归的（Autoregressive），即根据上文预测下一个 token。既然它是逐字生成的，为什么还能使用缓存？它到底缓存了什么？**

本文将从工程实现的角度，解释 LLM 的缓存机制。

## 一、KV Cache：缓存的实质

缓存的并不是“文本”本身，而是 Transformer 模型在推理过程中产生的中间计算结果，即 **KV Cache (Key-Value Cache)**。

### Transformer 的计算原理
Transformer 模型在推理时，输入的每一个 token 经过 Attention 层都会生成对应的 **Query (Q)**, **Key (K)**, 和 **Value (V)** 向量。

Attention 的核心计算公式如下：

```text
Attention(Q, K, V) = softmax((Q*K^T)/sqrt(d_k)) * V
```

简单来说，当前 token 的 **Q** 需要与历史上所有 token 的 **K** 进行点积运算，计算出权重，再对所有的 **V** 进行加权求和，得到新 token。

**关键点在于：**
对于已经处理过的历史 token，只要它们的位置（Position ID）不变，且模型参数不变，它们生成的 **K** 和 **V** 向量就是固定的。

因此，推理引擎（如 llama.cpp, vLLM）会将这些历史 token 计算出的 `[K, V]` 矩阵**保存在显存中**。当生成下一个 token 时，模型不需要重新计算历史 token 的 KV，只需要计算当前新 token 的 Q，然后与**显存中缓存的历史 K** 进行交互即可。

## 二、架构分层：Ollama, llama.cpp 与 Model

为了更清晰地理解整个流程，我们需要区分清楚各个组件的角色。以本地运行 Ollama 为例：

1. **Ollama (Service Manager)**：
    - **角色**：服务管理器。
    - **职责**：负责对外提供 HTTP API，进行会话管理（Session Management）和请求路由。它维护着“哪个用户对应哪个推理会话”的状态。

2. **llama.cpp (Inference Engine)**：
    - **角色**：推理引擎。
    - **职责**：负责加载模型权重，管理 GPU 显存（包括分配和释放 KV Cache），并驱动实际的计算。**KV Cache 是存在于 llama.cpp 管理的显存空间中的。**

3. **Transformer (Model)**：
    - **角色**：计算逻辑（函数）。
    - **职责**：它只是一堆静态的权重矩阵和数学公式。它不保存状态，给定输入（Token IDs + KV Cache），它输出下一个 Token 的概率分布。

### Token 到 KV Cache 的映射过程

当 Ollama 收到一个请求时，流程如下：

1. **Tokenizer (CPU)**：Ollama 调用 llama.cpp 的 Tokenizer（通常在 CPU 上运行），将用户输入的文本转换为 Token ID 序列，例如 `[101, 234, 889]`。此时这些 Token 还在系统内存（RAM）中。
2. **Session 匹配**：Ollama 查找该会话是否已有活跃的 `llama_context`。
3. **前缀匹配 (Prefix Matching)**：
    - llama.cpp 对比新输入的 Token 序列和显存中已缓存的 Token 序列。
    - **关键机制**：通过 **Position ID** 对齐。如果新输入的 `Position 0-50` 的 Token ID 与缓存完全一致，那么这部分的 KV Cache 就可以复用。
4. **增量计算**：llama.cpp 仅将不匹配的新 Token（例如从 Position 51 开始）发送给 GPU 进行 Transformer 计算，并将新生成的 KV 写入显存的后续槽位。

## 三、算力账单：为什么能省钱？

缓存带来的算力节省是数量级的。我们以一层 Attention 为例来计算复杂度。

假设上下文长度为 N，我们需要生成下一个 token。

**不使用 KV Cache（全量计算）：**
每次生成新 token，都需要把历史上所有的 N 个 token 重新算一遍 Attention。
- 第 1 步：算 1 个 token 的 Attention
- 第 2 步：算 2 个 token 的 Attention
- ...
- 第 N 步：算 N 个 token 的 Attention

总计算量约为 `Sum(i^2) ≈ O(N^3)` （如果是生成 N 个词的过程）。
单步生成时，计算量是 `O(N^2)`（因为要算 N * N 的矩阵）。

**使用 KV Cache（增量计算）：**
历史的 N 个 token 的 KV 已经存在显存里了。
- 新 token 来了，只需要计算它自已的 Q, K, V。
- 用它的 Q 去乘历史的 N 个 K。
- 计算量是 1 * N，即 **`O(N)`**。

这种从 `O(N^2)` 到 `O(N)` 的复杂度降低，就是厂商能提供 0.1 倍缓存价格的数学基础。

## 四、System Prompt 的共享缓存

一个自然的问题是：如果很多用户的 System Prompt 都是一样的，大模型厂商会不会对这部分做统一的缓存？

答案是：**会的**。

### 厂商的调度策略

像 DeepSeek、OpenAI 这样的厂商，会在其负载均衡或推理网关层计算常用 Prompt 的哈希值。如果多个用户的请求开头（前缀）完全一致（例如：*"你是一个精通 Python 的编程助手..."*），推理集群会尝试将这些请求调度到已经加载了该 KV Cache 的 GPU 节点上。

### 代码编辑器场景

像 Cursor 或 Copilot 这类 AI 代码编辑器，由于 System Prompt 极其固定且通常很长（包含大量代码上下文），**前缀缓存**是它们维持响应速度的核心手段。只要 Prompt 的开头部分不变，这部分 Token 对应的 KV Cache 就不需要重新计算。

## 五、内存与显存的映射机制

在 llama.cpp 中，HTTP 是无状态的，但它通过 **`slot` 管理** 机制实现了"有状态"的性能优化。

### 内存中的索引表

llama.cpp 在 CPU 内存（RAM）中维护了一套数据结构，记录显存（VRAM）中 KV Cache 的状态。可以把它理解为一个 **"Token 序列 → 显存偏移量"** 的映射表。

- **内存（RAM）** 存储的是"元数据"：哈希值、Token ID 序列、显存地址指针。
- **显存（VRAM）** 存储的是真正的"物理数据"：巨大的 K 和 V 矩阵向量。

### 匹配流程

1. **接收请求**：拿到完整的对话列表。
2. **Token 化**：Tokenizer 将文本转为 Token 序列（CPU 完成）。
3. **前缀比对**：查询当前的 KV Cache 池，通过内存中的索引找到匹配的缓存块。
4. **复用与增量计算**：指令下发给 GPU，直接加载已有的 KV Cache，然后从缓存结束位置开始计算新 Token。
5. **更新缓存**：计算完成后，将新增的 KV 也存入缓存，以备下一次请求使用。

### 过期策略

KV Cache 的过期通常遵循 **LRU（Least Recently Used）** 算法，而不是简单的固定 TTL：

- 当显存满了，llama.cpp 会根据 LRU 原则剔除最旧的缓存块。
- 内存中的索引和显存中的数据会同步释放。
- 只要 `slot` 还没被覆盖，它的索引就会一直保留在内存中。

## 六、前缀树 vs 哈希：缓存的数据结构

有人说 KV Cache 的查找是基于哈希的，也有人说不是。这其实取决于你从哪个**抽象层级**看待这个问题。

### 为什么"哈希整个序列"行不通？

1. **位置依赖性**：Transformer 使用位置编码（如 RoPE）。同一个词"你好"，放在句首和放在第 100 个位置，生成的 K 和 V 向量是**完全不同**的。
2. **无法部分复用**：如果对整个 Prompt 做哈希，用户只要改了一个字，整个哈希值就变了。即便有 99% 的内容重合，缓存也会完全失效。

### 逻辑骨架：前缀树 (Radix Tree)

在大模型推理引擎（如 vLLM, sglang）中，缓存是按照**树状结构**组织的：

- **根节点**：通常是通用的 System Prompt。
- **分支**：是不同对话历史或不同的用户输入。
- **节点复用**：只要多个请求的前 N 个 Token 一致，它们在树上就会共享同一个父节点。由于前缀一致，相对位置也一致，K 和 V 向量可以直接复用。

### 实现优化：分块哈希 (Block-level Hashing)

虽然整体不是一个扁平的哈希表，但在**查找树节点**时，哈希依然是不可或缺的"快捷方式"。

以 vLLM 的 PagedAttention 为例：

1. **分块**：以"块"（比如每 16 个 Token）为单位管理显存，而不是单个 Token。
2. **内容哈希**：对这 16 个 Token 的内容计算哈希值。
3. **映射**：内存中的哈希表记录：`Hash(这16个Token) → 显存物理块地址`。
4. **链式匹配**：新请求进来时，计算前 16 个 Token 的哈希，匹配上了就继续算下一块。一旦中间某块匹配失败，后面的缓存就全部放弃。

**总结**：逻辑骨架是**前缀树**（保证顺序和位置正确），而查找加速器是**哈希表**（快速定位块）。

## 七、缓存失效与工程建议

理解了缓存机制后，一个实用的问题是：如何编写 Prompt 才能最大化利用缓存？

### 缓存失效条件

匹配机制是基于 **Token 序列的前缀一致性**。只要前缀有一个字符变化，从该位置开始的所有缓存都会失效。

举个例子，如果你的 System Prompt 后面接了一个动态的时间戳：

```text
你是一个 AI 助手。当前时间是：2026-02-06 20:00:00。请帮助用户...
```

那么时间戳之后的所有缓存都会失效——因为每分钟时间戳都在变。

### 优化建议

1. **固定内容放前面，动态内容放后面**：将不变的 System Prompt 放在最前面，多变的上下文（如时间戳、用户 ID）放在后面。这样前半部分的缓存可以被复用。
2. **避免不必要的前缀变化**：不要在 System Prompt 开头随机插入一些"提示词版本号"之类的标识。
3. **利用多轮对话的连续性**：只要每次请求都携带完整的对话历史，推理引擎就能自动复用之前计算过的 KV。

## 八、工程全流程伪代码

```python
# ===== 1. Ollama 层 (服务与会话管理) =====
def handle_request(user_input, session_id):
    # 查找活跃会话
    context = get_active_context(session_id)
    
    # Tokenizer (CPU运行): 文本 -> Token IDs
    # tokens 在内存中
    tokens = llama_cpp.tokenize(user_input) 
    
    # 调用推理引擎
    return llama_cpp.generate(context, tokens)

# ===== 2. llama.cpp 层 (推理引擎 & 显存管理) =====
class LlamaContext:
    def __init__(self):
        self.kv_cache = GPU_VRAM_Alloc() # 显存中的 KV 缓存
        self.past_tokens = []            # 内存中的 Token 记录，用于对比

    def generate(self, new_tokens):
        # 核心：前缀匹配
        # 对比内存中的 new_tokens 和 past_tokens
        # 找到 Position ID 一致的最长前缀
        n_past = match_prefix(self.past_tokens, new_tokens)
        
        # 只需要计算新增部分
        tokens_to_eval = new_tokens[n_past:]
        
        for token in tokens_to_eval:
            # 准备输入：当前 Token ID, 当前 Position (n_past)
            # 将数据从内存传给 GPU
            process_on_gpu(token, n_past, self.kv_cache)
            n_past += 1

# ===== 3. Transformer 层 (GPU 计算) =====
def process_on_gpu(token_id, position, kv_cache):
    # 1. 获取 Embedding
    x = embedding_lookup(token_id)
    
    # 2. Attention 计算
    # 读取当前层在 position 位置的 KV 槽位
    K_cache_slot = kv_cache[position].K
    V_cache_slot = kv_cache[position].V
    
    # 计算当前 token 的 Q, K, V
    q, k, v = compute_qkv(x)
    
    # 写入显存：将 k, v 存入对应的 Position 槽位
    K_cache_slot.write(k)
    V_cache_slot.write(v)
    
    # 计算 Attention：Q * 所有历史 K (读取显存)
    # 这里的复杂度是 O(Position)，而不是 O(Position^2)
    score = matmul(q, kv_cache[:position+1].K) 
    ...
```

## 总结

LLM 的"缓存"机制并非魔法，而是经典的**空间换时间**策略在深度学习领域的应用：

1. **缓存内容**：KV Cache (Attention 层的中间矩阵)。
2. **物理载体**：GPU 显存 (VRAM)，由推理引擎 (llama.cpp) 管理。
3. **索引机制**：RAM 存储元数据（哈希值、Token 序列、显存指针），VRAM 存储实际的 K/V 矩阵。
4. **数据结构**：逻辑上是前缀树，实现上通过分块哈希加速查找。
5. **命中逻辑**：基于 Token 序列的前缀一致性，通过 Position ID 对齐。
6. **工程优化**：固定内容放前面，动态内容放后面，最大化缓存复用。
7. **核心价值**：将 Attention 计算复杂度从 `O(N^2)` 降至 `O(N)`，大幅降低长文本推理的延迟与成本。
