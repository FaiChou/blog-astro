---
title: "Linux下硬链接与软链接"
publishDate: "2017-06-25"
description: "Linux下硬链接与软链接"
tags: ["linux"]
---

### linux下硬链接与软链接



Linux文件系统给所有类型的文件一个编号，成为索引节点号(Inode Index)。在Linux系统中对一个文件创建索引是用`ln`命令(link)。



![tldr-ln][1]



创建的链接文件分为两种，硬链接(hard link)和软链接(soft link or symbolic link)。

在Linux中，允许多个文件名同时代表(注意这里不是指向)同一索引节点，就是通过硬链接来实现。硬链接的作用是将一个文件创建多个有效路径，这样对重要的文件起到了保险作用，防止误删等操作。当你删除一个文件，仅仅删除了它的一个硬链接，只有当所有的links被删除这个inode才会被移除掉。

而软链接的创建，仅仅建造了一个指向改路径文件的link，打开这个link其实是打开了这个link代表的源文件，就像Windows系统下的快捷方式，如果源文件路径改变或者源文件的名字改变将会导致这个link打不开。



![linux-hardlink&softlink][2]

下面做了一个测试，新建了一个`abc.txt`文件，内容是`this is source file`。

1. 创建一个硬链接aa, `ln abc.txt aa`
2. 创建一个软链接bb, `ln -s abc.txt bb`
3. 通过cat命令查看文件内容都是相同的
4. 移除掉`abc.txt`，再用cat命令查看aa和bb
5. 软链接bb已经没内容了，而硬链接aa仍然存在



![ln-test][3]

[1]: https://raw.githubusercontent.com/FaiChou/faichou.github.io/master/img/qiniu/tldr-ln.png
[2]: https://raw.githubusercontent.com/FaiChou/faichou.github.io/master/img/qiniu/linux-hardlink&amp;softlink.png
[3]: https://raw.githubusercontent.com/FaiChou/faichou.github.io/master/img/qiniu/ln-test.png

