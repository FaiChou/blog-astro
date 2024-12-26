---
title: "Trie 数据结构的递归删除逻辑"
publishDate: "2023-10-10"
---

有问题的源码在这里: https://github.com/FaiChou/c-tutorial/blob/main/trie.c#L51

当时学习 Trie 数据结构的时候由于特别信任 ChatGPT，直接照抄它的代码，没有进行详细的验证。

比如有 `apple` 和 `app` 在 Trie 中，如果调用上面的 delete 函数来删除 `apple`，那么它也会删除 `app`。

于是再回去看 Jaocb 老师的代码:

```c
trienode* deletestr_rec(trienode* node, unsigned char* text, bool *deleted) {
  if (node == NULL) return node;
  if (*text == '\0') {
    if (node->terminal) {
      node->terminal = false;
      *deleted = true;
      if (node_has_children(node) == false) {
        free(node);
        node = NULL;
      }
    }
    return node;
  }
  node->children[text[0]] = deletestr_rec(node->children[text[0]], text+1, deleted);
  if (*deleted && node_has_children(node) == false && node->terminal == false) {
    free(node);
    node = NULL;
  }
  return node;
}
bool deletestr(trienode** root, char* signedtext) {
  unsigned char* text = (unsigned char *)signedtext;
  bool result = false;
  if (*root == NULL) return false;
  *root = deletestr_rec(*root, text, &result);
  return result;
}
```

这里递归的 `deletestr_rec` 函数有点绕。在了解这个函数之前先看一个简单的递归:

```c
void freearr(node* arr, int index, int len) {
  if (index >= len) {
    return;
  }
  free(arr[index]);
  freearr(arr, index+1, len);
}
```

这个函数会从头开始向后释放数组中的 node，先释放再递归。等递归完成后再向上传递，一层层的返回。

让我们进行一下调整:

```c
void freearrv2(node* arr, int index, int len) {
  if (index >= len) {
    return;
  }
  freearrv2(arr, index+1, len);
  free(arr[index]);
}
```

这个 v2 版本也是做了相同的事情，只不过它先进行递归，再进行释放 node。也就是当递归到最后一层后，才开始释放，这对于数组来讲，是从后往前释放。

再回到 `deletestr_rec` 这个函数，由于 Trie 这个数据结构的特殊性，无法满足从前向后处理的逻辑，因为不能确定前面节点的 children 是否不要了，所以只能从后往前处理。

它的终止条件是 `if (*text == '\0')` 如果满足条件，则说明函数递归到最后一层，然后再进行返回，返回后倒数第二层继续执行清理逻辑：

```c
if (*deleted && node_has_children(node) == false && node->terminal == false) {
  free(node);
  node = NULL;
}
```

