---
title: "Difference between JavaScript Engine and JavaScript Runtime Environment"
description: "JavaScript 引擎和运行环境的区别"
publishDate: "2019-07-30"
tags: ["javascript"]
---

> Unlike C and other compiled languages, Javascript runs in a container - a program that reads your js codes and runs them. This program must do two things
> - parse your code and convert it to runnable commands
> - provide some objects to javascript so that it can interact with the outside world.

> The first part is called Engine and the second is Runtime.

> For example, the Chrome Browser and node.js use the same Engine - V8, but their Runtimes are different: in Chrome you have the window, DOM objects etc, while node gives you require, Buffers and processes.

JavsScript 不像 C 等其他编译形语言, js 跑在一个容器里, 一个会阅读和执行你 js 代码的程序. 这个程序必须做俩件事情:

- 解析 js 代码并且转换它为可执行的命令
- 提供一些 js 对象以便于它和外界交互

第一个是被称作**引擎**, 第二个被称作**运行时**.

比如, Chrome 浏览器和 Node.js 使用了相同的引擎(V8), 但是它们的运行时是不一样的: 在 Chrome 里你可以使用 window, DOM, BOM 等, 在 node 中你可以使用 require, Buffer, process 等.