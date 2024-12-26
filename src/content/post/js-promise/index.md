---
title: "JS Promise"
publishDate: "2023-08-03"
---

已经很长时间没有写 JS 了，现在写一个 JS Promise 的简单实现。

## 版本1

```javascript
class SimplePromise {
  constructor(executor) {
    this.status = 'pending';
    this.value = undefined;
    this.reason = undefined;
    const resolve = (value) => {
      if (this.status === 'pending') {
        this.status = 'fulfilled';
        this.value = value;
      }
    };
    const reject = (reason) => {
      if (this.status === 'pending') {
        this.status = 'rejected';
        this.reason = reason;
      }
    };
    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }
  then(onFulfilled, onRejected) {
    if (this.status === 'fulfilled') {
      onFulfilled(this.value);
    }
    if (this.status === 'rejected') {
      onRejected(this.reason);
    }
  }
}
```

这个版本大概能看明白 Promise 需要的参数，以及它的执行时机。但是有一个问题，当调用 `then` 方法传入的函数时候，如果异步某一执行完成，此时还在 **pending** 状态，那这个函数不会再被执行。所以需要优化一下，将需要当状态改变后执行的函数存起来，并且 Promise 可以无限被 `then` 所以要存到数组中。

## 版本2

```javascript
class SimplePromise {
  constructor(executor) {
    this.status = 'pending';
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];
    const resolve = (value) => {
      if (this.status === 'pending') {
        this.status = 'fulfilled';
        this.value = value;
        this.onFulfilledCallbacks.forEach(cb => cb(this.value));
      }
    };
    const reject = (reason) => {
      if (this.status === 'pending') {
        this.status = 'rejected';
        this.reason = reason;
        this.onRejectedCallbacks.forEach(cb => cb(this.reason));
      }
    };
    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }
  then(onFulfilled, onRejected) {
    if (this.status === 'fulfilled') {
      onFulfilled(this.value);
    } else if (this.status === 'rejected') {
      onRejected(this.reason);
    } else if (this.status === 'pending') {
      this.onFulfilledCallbacks.push(onFulfilled);
      this.onRejectedCallbacks.push(onRejected);
    }
  }
}
```

在这个版本中，已经可以简单运行并执行测试一下：

```javascript
const p = new SimplePromise(resolve => setTimeout(resolve, 1000, Math.random()))
setTimeout(() => {
  p.then(v => console.log(`inner: ${v}`))
}, 3000)
p.then(v => console.log(`outer: ${v}`))
```

最终的执行是这样的：

```
1秒后打印：outer: 0.5220189262043281
再过2秒打印：inner: 0.5220189262043281
```

但它仍然欠缺一点东西，如果 resolve 函数的返回值仍然是一个 Promise, 那它应该继续自动执行这个 Promise；如果不是 Promise 而是一个准确的值，那需要保证是异步。所以有了版本3

## 版本3

```javascript
class SimplePromise {
  constructor(executor) {
    this.status = 'pending';
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (value) => {
      if (value instanceof SimplePromise) {
        return value.then(resolve, reject);
      }
      setTimeout(() => {
        if (this.status === 'pending') {
          this.status = 'fulfilled';
          this.value = value;
          this.onFulfilledCallbacks.forEach(cb => cb(this.value));
        }
      }, 0);
    };
    const reject = (reason) => {
      setTimeout(() => {
        if (this.status === 'pending') {
          this.status = 'rejected';
          this.reason = reason;
          this.onRejectedCallbacks.forEach(cb => cb(this.reason));
        }
      }, 0);
    };
    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }
  then(onFulfilled, onRejected) {
    if (this.status === 'fulfilled') {
      setTimeout(() => onFulfilled(this.value), 0);
    } else if (this.status === 'rejected') {
      setTimeout(() => onRejected(this.reason), 0);
    } else if (this.status === 'pending') {
      this.onFulfilledCallbacks.push(onFulfilled);
      this.onRejectedCallbacks.push(onRejected);
    }
  }
}
```

当然真正的 Promise 还是要继续优化，比如链式调用的 `then` 和错误处理，以及 `Promise.all` 等方法。

[这个链接](https://www.promisejs.org/implementing/)里面有另外一种实现方式，大同小异。


