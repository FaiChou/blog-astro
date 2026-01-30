---
title: "macOS 逆向实战：从加密到明文"
description: "结合 Hopper 与 LLDB，通过追踪数据流与内存监视点，获取解密后的明文数据。"
publishDate: "2026-01-29"
tags: ["reverse engineering"]
---

在 macOS 下逆向一个第三方签名的二进制程序时，核心目标通常不是搞清楚算法细节，而是拿到程序内部已经解密完成的明文数据。因此，逆向的重点应该放在“数据流”上，而不是死磕汇编指令。

![macos reverse](./macos-reverse.jpg)


## 一、上帝视角：如果我有源代码

在深入逆向工具之前，我们先写一段 C 语言代码来模拟这个过程。假设程序的源码是这样的：

```c
// 假设这是核心解密逻辑
void process_secure_config() {
    char buffer[1024];

    // 1. 读取加密文件
    // 逆向视角：这里对应 _read / _fopen 系统调用
    int fd = open("encrypted.bin", O_RDONLY);
    read(fd, buffer, 1024); 
    close(fd);

    // 此时 buffer 里的内存全是乱码
    
    // ... 可能会有一些校验逻辑 ...

    // 2. 解密函数（关键点！）
    // 逆向视角：这就是我们要找的 sub_xxxx
    decrypt_secret_algorithm(buffer, 1024);

    // 3. 此时 buffer 已经是明文了
    printf("Config: %s\n", buffer);
}
```

逆向的目标非常明确：
1. 你的起点是 `read`（你能轻易断在这个系统函数上）。
2. 你的终点是 `decrypt_secret_algorithm` 执行完毕的那一瞬间。
3. 你的手段是监控 `buffer` 的内存变化——谁修改了它，谁就是解密者。

理解了这个模型，后面的操作就顺理成章了。

## 二、Hopper：静态分析阶段要做什么

使用 Hopper Disassembler 时，第一步不要直接看汇编，而是从「字符串」入手。
通过 Strings 视图可以快速发现：

- 本地文件路径（如 data.bin）
- 错误提示（如 decrypt failed）
- 加密相关关键字（AES、CCCrypt 等）

当你找到文件名或路径字符串后，查看它的 XREF（交叉引用），就能定位到程序中“读取该文件”的函数位置。通常你会看到 `_open` / `_read` / `_fopen` / `_fread` 等系统调用。

这些系统函数本身没有业务意义，但调用它们的上层函数（Hopper 中显示为 `sub_1000xxxx`）才是程序逻辑所在。
`sub_1000xxxx` 只是工具给“无符号函数”起的名字，本质就是程序自己的函数。

在静态分析阶段，你需要做的不是“看懂解密算法”，而是标记几个关键点：

1. 文件在哪里被读入内存
2. 读完之后，数据传给了哪个 `sub_xxx`
3. 哪些函数看起来在“处理一整块 buffer”（循环、位运算、memcpy）



## 三、静态分析的盲区与系统级监控

有些应用内，如果读取了某个文件（比如 `appsettings`），我们可以尝试用 `strings xxx | grep appsettings` 来查找。但在 macOS 上，这个方法并不总是有效，原因有二：

1.  **主程序只是个壳**：真正的业务逻辑（包括读取配置）可能写在它自带的 Framework 里。
2.  **语言特性的干扰**：比如 Swift 的 Name Mangling（名称修饰）。代码中可能没有硬编码字符串路径，而是定义了一个变量 `appSettingsURL`，运行时再拼接。

例如，直接对 Framework 搜索 `appsettings`，可能只能看到被修饰后的变量名：

```bash
$ strings /Applications/XXX.app/Contents/Frameworks/XXXCore.framework/Versions/A/XXXCore | grep -i "appsettings"
_TtC17XXXCore17AppSettingService
appSettingService
appSettingsURL
```

这时候，静态扫描就显得力不从心了。我们需要用系统级监控工具来确认程序“到底有没有读这个文件”。

### 1. lsof (List Open Files)

查看某个进程当前正打开了哪些文件。适合用来验证“文件句柄是否一直被持有”。

```bash
# 找到进程 PID
pgrep -f XXX

# 查看该进程打开的所有文件
lsof -p <PID> | grep "appsettings"
```

### 2. fs_usage

相比 `lsof` 的静态快照，`fs_usage` 是动态的，它能监控文件系统的实时读写操作。适合捕捉“瞬间读取然后关闭”的行为。

```bash
# 监控包含 "XXX" 名字的进程的文件系统活动
sudo fs_usage -w -f filesys | grep "XXX"
```

通过这两个命令，你可以百分百确认目标程序是否读取了你的目标文件，以及是哪个子进程在读。

## 四、前置障碍：无法附加调试器怎么办

macOS 的 SIP (System Integrity Protection) 或 AMFI (Apple Mobile File Integrity) 机制阻止了调试器挂载到受保护的应用上。对于正式开发者签名且包含敏感权限的应用，系统默认是不允许 lldb 直接注入的:

> error: process exited with status -1 (attach failed (Not allowed to attach to process.  Look in the console messages (Console.app), near the debugserver entries, when the attach failed.  The subsystem that denied the attach permission will likely have logged an informative message about why it was denied.))

但是可以通过**剥离签名**和**重新签名**来让它变得可调试：

**1. 给二进制文件剥离签名**

```bash
# 移除主程序的签名限制
codesign --remove-signature "/Applications/XXX.app/Contents/MacOS/XXX"

# 移除关键 Framework 的签名（这是最重要的，因为逻辑在里面）
codesign --remove-signature "/Applications/TXXX.app/Contents/Frameworks/XXXXCore.framework/Versions/A/XXX"
```

**2. 重新赋予调试权限（自签名）**

执行以下命令给它签一个临时的名，这样它就能在你的本地环境下运行且允许调试：

```bash
sudo codesign --force --deep --sign - "/Applications/XXX.app/Contents/MacOS/XXX"
```

## 五、lldb：动态分析阶段的核心概念

使用 lldb 启动程序后，最常见的做法是在系统函数上下断点：

```bash
b read
b open
run
```

程序在 `read` 停住时，使用：

```bash
bt
```

查看调用栈。
这里的 frame 可以理解为一层函数调用关系：

- frame #0：当前正在执行的函数（如 read）
- frame #1：调用 read 的程序函数（如 `sub_100010ABC`）
- frame #2：更上层的调用者

逆向真正关心的是 `read` 上面的那一层 `sub_xxx`，因为逻辑都在那里。

## 六、register read：为什么这么重要

在 macOS x86_64 平台，函数参数通过寄存器传递，而不是压栈。

以 `read(fd, buf, size)` 为例：

- RDI：fd
- RSI：buffer 地址
- RDX：读取长度

因此在 `read` 停住后执行：

```bash
register read
```

你就能直接知道：文件被读进了哪一块内存

此时用：

```bash
memory read <buffer>
```

看到的内容，一定是加密数据，因为 `read` 只负责 IO，不会解密。这一点必须明确。

## 七、如何判断哪个 sub_xxx 是解密函数

判断解密函数，最稳妥的方法不是看汇编“像不像算法”，而是观察数据什么时候发生质变。

最实用的一招是 watchpoint（写断点）：

```bash
watchpoint set expression -w write -- <buffer>
continue
```

只要这块内存被写，程序就会停住。
一旦停住，立刻查看：

```bash
bt
```

当前的 `sub_xxx`，就是第一个修改加密数据的函数，它极大概率就是解密或解码函数。

随后再次：

```bash
memory read <buffer>
```

如果你看到可读字符串、JSON、plist 等结构化内容，就说明你已经站在了“解密完成点”。

## 八、辅助判断方法

- 如果程序调用了 `_CCCrypt`、`_CCCryptorUpdate` 等 CommonCrypto 接口，几乎可以直接确认是在做加解密。
- 如果某个函数内部存在大量循环、xor / rol / ror 等位运算，也很可能是在处理加密数据。
- 在 `memcpy` / `memmove` 上打断点，观察源地址和目标地址，有时能直接捕获“解密后数据被复制”的瞬间。

## 九、实战演练：使用 LLDB 导出解密后的配置

理论结合实践，下面我们演示一个真实的案例：如何从 `Tiny Shield` 应用中导出解密后的 `appsettings` 配置内容。

### 1. 目标

在应用启动并解密 `~/Library/Application Support/com.proxyman.ProxymanGuard/appsettings` 后，直接从内存中 dump 出解密后的明文 json。

### 2. 原理分析

通过 Hopper 分析发现，`ProxymanGuardCore.framework` 使用了 `CommonCrypto` 的 `CCCrypt` 函数进行解密（op code 为 `kCCDecrypt`）。

`CCCrypt` 的函数原型如下：
```c
CCCryptorStatus CCCrypt(
    CCOperation op,         // kCCEncrypt=0, kCCDecrypt=1
    CCAlgorithm alg,
    CCOptions options,
    const void *key,
    size_t keyLength,
    const void *iv,
    const void *dataIn,
    size_t dataInLength,
    void *dataOut,          // <-- 解密后的数据会写到这里
    size_t dataOutAvailable,
    size_t *dataOutMoved    // <-- 解密后的实际长度会写到这里
);
```

**利用思路：**
1. 在 `CCCrypt` 入口处下断点，条件是 `op == kCCDecrypt`。
2. 断下后，从调用栈（Caller Stack）中获取 `dataOut` 指针的地址。
3. 执行 `finish` 命令，让函数运行完毕（此时解密已完成，数据已写入 `dataOut`）。
4. 读取 `*dataOutMoved` 获取解密后的实际大小。
5. 将 `dataOut` 指向的内存区域 dump 到文件。

### 3. Python 辅助脚本

为了自动化这个过程，我们可以编写一个 LLDB Python 脚本 `debug_appsettings_dump_decrypted.py`：

```python
#!/usr/bin/env python3
"""
LLDB 脚本：在 Tiny Shield 使用 CCCrypt 解密后，将解密内容 dump 到文件。

用法（在 lldb 内）：
  (lldb) command script import /path/to/debug_appsettings_dump_decrypted.py
  (lldb) run
"""

import lldb

OUTPUT_PATH = "/tmp/appsettings_decrypted_dump.bin"
MAX_DUMP_BYTES = 64 * 1024
PREVIEW_BYTES = 2048

def read_ptr(process, addr):
    err = lldb.SBError()
    data = process.ReadMemory(addr, 8, err)
    if not err.Success() or data is None or len(data) < 8:
        return None
    return int.from_bytes(data, "little")

def read_size_t(process, addr):
    err = lldb.SBError()
    data = process.ReadMemory(addr, 8, err)
    if not err.Success() or data is None or len(data) < 8:
        return None
    return int.from_bytes(data, "little")

def _stack_arg_offset(debugger):
    """ARM64: 第 9/10/11 参在 [sp], [sp+8], [sp+16]。x86_64: call 压返回地址，在 [sp+8], [sp+16], [sp+24]。"""
    triple = debugger.GetSelectedTarget().GetTriple()
    if "arm64" in triple or "aarch64" in triple:
        return 0
    if "x86_64" in triple:
        return 8
    return 0

def do_cccrypt_decrypt_dump(debugger, *args):
    """
    在 CCCrypt 入口断下时调用（仅 kCCDecrypt）。
    从 caller 栈取 dataOut/dataOutAvailable/dataOutMoved，
    执行 finish，读 *dataOutMoved 得到实际长度，dump dataOut 到文件并 continue。
    """
    target = debugger.GetSelectedTarget()
    process = target.GetProcess()
    thread = process.GetSelectedThread()
    if not thread:
        return
    # ... 省略部分边界检查 ...
    
    caller = thread.GetFrameAtIndex(1)
    sp = caller.GetSP()
    
    off = _stack_arg_offset(debugger)
    # 根据调用约定从栈上获取参数
    data_out = read_ptr(process, sp + off)
    data_out_moved_ptr = read_ptr(process, sp + off + 16)
    
    if data_out is None:
        debugger.HandleCommand("continue")
        return

    # 执行 finish，会阻塞直到停在 caller
    ci = debugger.GetCommandInterpreter()
    res = lldb.SBCommandReturnObject()
    ci.HandleCommand("finish", res)
    
    # 此时函数返回，dataOutMovedPtr 指向的内存已被写入实际长度
    if not process.IsValid(): return

    actual_len = read_size_t(process, data_out_moved_ptr) if data_out_moved_ptr else None
    
    # 兜底：如果获取不到长度，就读一个默认最大值
    if actual_len is None or actual_len <= 0:
        actual_len = MAX_DUMP_BYTES # 这里简单处理，实际场景需更严谨
    else:
        actual_len = min(actual_len, MAX_DUMP_BYTES)

    if data_out and actual_len > 0:
        err = lldb.SBError()
        data = process.ReadMemory(data_out, actual_len, err)
        if err.Success() and data:
            with open(OUTPUT_PATH, "wb") as f:
                f.write(data)
            print(f"[+] Dumped {len(data)} bytes to {OUTPUT_PATH}")
            # 打印简单的预览
            try:
                print(data.decode("utf-8", errors="replace")[:200])
            except:
                pass

    debugger.HandleCommand("continue")

def __lldb_init_module(debugger, dict):
    # 仅在 CCCrypt 且 op == kCCDecrypt(1) 时断
    debugger.HandleCommand("breakpoint set -n CCCrypt -c '(int)$x0 == 1'")
    # 断点触发时执行 python 函数
    debugger.HandleCommand(
        "breakpoint command add 1 -o 'script import debug_appsettings_dump_decrypted as m; m.do_cccrypt_decrypt_dump(lldb.debugger)'"
    )
    print("Breakpoint on CCCrypt(kCCDecrypt) installed.")
```

### 4. 执行过程

启动 lldb 并加载脚本：

```bash
lldb "/Applications/Tiny Shield.app/Contents/MacOS/Tiny Shield"
```

在 lldb 内执行：

```lldb
(lldb) command script import /path/to/debug_appsettings_dump_decrypted.py
(lldb) run
```

当应用触发读取配置的操作时，脚本会自动捕获解密后的数据：

```
[+] Dumped 323 bytes to /tmp/appsettings_decrypted_dump.bin
{"isBlockListEnabled":true,"blockRules":"W3siYXBwUGF0aCI6IlwvQXBwbGljYXR...
```

### 5. 手动操作验证

如果你不想写脚本，也可以手动操作验证。当断点停在 `CCCrypt` 返回位置（Caller）时：

```lldb
# 查看栈指针 (ARM64)
(lldb) p/x $sp
(unsigned long) 0x000000016fdfc340

# 读取 output 长度 (dataOutMovedPtr)
(lldb) memory read -f pointer $sp+16 -c 1
0x16fdfc350: 0x000000016fdfc580
(lldb) memory read 0x000000016fdfc580
0x16fdfc580: 43 01 00 00 ...  // 0x143 = 323 bytes

# 读取 dataOut 内容
(lldb) memory read -f pointer $sp -c 1
0x16fdfc340: 0x00000001010f7e90
(lldb) memory read -s 1 -c 323 0x01010f7e90
0x1010f7e90: 7b 22 69 73 42 6c 6f 63 6b 4c 69 73 74 45 6e 61  {"isBlockListEna
0x1010f7ea0: 62 6c 65 64 22 3a 74 72 75 65 2c 22 62 6c 6f 63  bled":true,"bloc
0x1010f7eb0: 6b 52 75 6c 65 73 22 3a 22 57 33 73 69 59 58 42  kRules":"W3siYXB
0x1010f7ec0: 77 55 47 46 30 61 43 49 36 49 6c 77 76 51 58 42  wUGF0aCI6IlwvQXB
0x1010f7ed0: 77 62 47 6c 6a 59 58 52 70 62 32 35 7a 58 43 39  wbGljYXRpb25zXC9
0x1010f7ee0: 33 63 48 4e 76 5a 6d 5a 70 59 32 55 75 59 58 42  3cHNvZmZpY2UuYXB
0x1010f7ef0: 77 49 69 77 69 61 57 51 69 4f 69 49 77 4e 7a 5a  wIiwiaWQiOiIwNzZ
0x1010f7f00: 44 4e 6a 59 7a 51 53 30 7a 4f 45 5a 44 4c 54 52  DNjYzQS0zOEZDLTR
0x1010f7f10: 43 4e 6a 49 74 51 55 49 77 52 43 30 35 52 6b 4a  CNjItQUIwRC05RkJ
0x1010f7f20: 46 52 45 45 32 4f 44 67 79 4e 44 45 69 4c 43 4a  FREE2ODgyNDEiLCJ
0x1010f7f30: 6c 65 47 56 6a 64 58 52 68 59 6d 78 6c 55 47 46  leGVjdXRhYmxlUGF
0x1010f7f40: 30 61 43 49 36 49 6c 77 76 51 58 42 77 62 47 6c  0aCI6IlwvQXBwbGl
0x1010f7f50: 6a 59 58 52 70 62 32 35 7a 58 43 39 33 63 48 4e  jYXRpb25zXC93cHN
0x1010f7f60: 76 5a 6d 5a 70 59 32 55 75 59 58 42 77 58 43 39  vZmZpY2UuYXBwXC9
0x1010f7f70: 44 62 32 35 30 5a 57 35 30 63 31 77 76 55 32 68  Db250ZW50c1wvU2h
0x1010f7f80: 68 63 6d 56 6b 55 33 56 77 63 47 39 79 64 46 77  hcmVkU3VwcG9ydFw
0x1010f7f90: 76 64 33 42 7a 59 32 78 76 64 57 52 7a 64 6e 49  vd3BzY2xvdWRzdnI
0x1010f7fa0: 75 59 58 42 77 58 43 39 44 62 32 35 30 5a 57 35  uYXBwXC9Db250ZW5
0x1010f7fb0: 30 63 31 77 76 54 57 46 6a 54 31 4e 63 4c 33 64  0c1wvTWFjT1NcL3d
0x1010f7fc0: 77 63 32 4e 73 62 33 56 6b 63 33 5a 79 49 6e 31  wc2Nsb3Vkc3ZyIn1
0x1010f7fd0: 64 22 7d                                         d"}
```

然后将其中的 blockRules 内容进行 base64 decode 得出:

```
[{"appPath":"\/Applications\/wpsoffice.app","id":"076C663A-38FC-4B62-AB0D-9FBEDA688241","executablePath":"\/Applications\/wpsoffice.app\/Contents\/SharedSupport\/wpscloudsvr.app\/Contents\/MacOS\/wpscloudsvr"}]
```

这恰好是我在 Tiny Shield 中 block 的 wps 应用。

## 十、关键心法总结

逆向分析中最重要的一点是：

> 不要执着于看懂算法，而是盯住数据的生命周期

真正有价值的是：

- 数据从哪读进来
- 在哪被修改
- 在哪第一次变成明文

只要你能在正确的时间点，站在正确的内存地址旁边，逆向任务就已经完成了大半。
