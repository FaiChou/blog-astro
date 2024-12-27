---
title: "Javascript 中的 This"
publishDate: "2019-04-24"
description: "Javascript 中的 This"
tags: ["javascript"]
---


```javascript
var obj = {
  id: 1,
  foo: function() {
    console.log(this.id)
  },
  // foo() { } // using es6 syntax
}
obj.foo() // log 1

var fooo = obj.foo
fooo() // log undefined

var id = 2
fooo() // log 2
```

以上是基础的 `this` 绑定问题, 在 `obj` 环境下执行 `foo()`, `this` 绑定的是 `obj`, 在全局环境下, `fooo()` 则绑定了系统环境.

如何让 `fooo` 绑定 `obj` 呢? 可以使用 `Function.prototype.bind()` 强行绑定 `obj`:

```javascript
var fooo = obj.foo.bind(obj)
```

---

再看一个现象:

```javascript
var rectangle = {
  width: 10,
  height: 20,
  size: this.width*this.height
}
console.log(rectangle.size) // NaN
```

看起来行得通, 但是获取不到 `width` 和 `height`?

简化模型如下:

```javascript
var obj = {
  a: this
}
console.log(obj.a) // Window
```

这里的 `this` 指向的是 `parent`, 而非 `obj`, 在传统 js 中是没有 `block scope` 的, 只有 `function scope` 和 `global scope`, 证明如下:

```javascript
var x = 1
let y = 1

if (true) {
  var x = 2
  let y = 2
}
console.log(x) // 2
console.log(y) // 1
function foo() { // in function scope
  var x = 3
  let y = 3
}
console.log(x) // 2
console.log(y) // 1
```

在 `es6` 中 `let, const` 是 `block scope` 的.

---

```javascript
var obj = {
  id: 1,
  foo: () => {
    console.log(this.id)
  },
}
obj.foo() // undefined

var id = 2
fooo() // 2
```

将 `foo` 改为箭头函数, 这里就会发生变化, 第一个在 `obj` 环境下执行结果是 `undefined`. 因为箭头函数是没有 `this` 的, `this` 虽然指向当前 scope, 但不包括 `arrow function`.

经过 babel 转译是这样的:


```javascript
"use strict";

var _this = void 0;

var obj = {
  id: 1,
  foo: function foo() {
    console.log(_this.id);
  }
};
obj.foo();

var id = 2;
fooo();
```

---

在 vue 官方文档中有[这么一段](https://cn.vuejs.org/v2/guide/instance.html#%E5%AE%9E%E4%BE%8B%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F%E9%92%A9%E5%AD%90):

> 不要在选项属性或回调上使用箭头函数，比如 `created: () => console.log(this.a)` 或 `vm.$watch('a', newValue => this.myMethod())`。因为箭头函数是和父级上下文绑定在一起的，`this` 不会是如你所预期的 Vue 实例

可以将箭头函数理解为 `created: this`, 那么这里的 `this` 指向的不会是 Vue 实例.

```javascript
var data = { a: 1 }
var app = new Vue({ data })

app.$data === data // true
```

vue 实例的 `data` 共享外部 `data`, 它们指向同一个 `obj`.

再看一个比较明显的例子:

```javascript
function foo() {
  this.x = 1
  var a = {
    x: 2,
    f: () => console.log(this.x)
  }
  a.f()
}
function bar() {
  this.x = 1
  var a = {
    x: 2,
    f() {
      console.log(this.x)
    }
  }
  a.f()
}
x = 3
function baz() {
  var a = {
    f: () => console.log(this.x)
  }
  a.f()
}
function qux() {
  "use strict"
  var a = {
    f: () => console.log(this.x)
  }
  a.f()
}
foo() // 1
bar() // 2
baz() // 3
qux() // throw undefined error
```

这里 `foo` 函数内的 `a.f` 因为是个箭头函数, 被转译后结果应该是这样:

```javascript
function foo() {
  this.x = 1
  var _this = this;
  var a = {
    x: 2,
    f: function f() {
      console.log(_this.x)
    }
  }
  a.f()
}
```

而 `bar` 内的 `a.f` 是个传统js函数, 有自己的闭包, 在解析 `this` 时候会先去自己的环境查找, 即 `x` 为 2.

`baz` 在非 `strict mode` 下, 自己的环境找不到会去全局环境中查找, 对比 `qux` 可以看到现象.

所以在 `component` 章节中强调了 [`data` 必须是一个函数](https://cn.vuejs.org/v2/guide/components.html#data-%E5%BF%85%E9%A1%BB%E6%98%AF%E4%B8%80%E4%B8%AA%E5%87%BD%E6%95%B0):

```javascript
data: { // bad
  count: 0
}

data: function () { // good
  return {
    count: 0
  }
}
```

防止多个 `component` 共享同一份 `obj`.

---

> Until arrow functions, every new function defined its own this value [...]. This proved to be annoying with an object-oriented style of programming.
> Arrow functions capture the this value of the enclosing context [...]

```javascript
class App extends React.Component {
  handleClick() {
    console.log(this) // undefined
  }
  handleClick2 = () => {
    console.log(this) // app
  }
  render() {
    return (
      <>
        <button onClick={this.handleClick}>
          clickme
        </button>
        <button onClick={this.handleClick2}>
          clickme
        </button>
      </>
    )
  }
}
ReactDOM.render(<App />, root);
```

这里为什么 `handleClick` 没有 `bind` 但 `handleClick2` 却有 `bind` 呢?

让我们简化下模型:

```javascript
class Person {
  constructor(name) {
    this.name = name
  }
  foo() {
    console.log(this.name)
  }
  bar = () => {
    console.log(this.name)
  }
}
let Bob = new Person('Bob')
Bob.foo() // Bob
Bob.bar() // Bob

Person.prototype // constructor, foo
```

这里有点奇怪, `Person` 的原型上没有 `bar`, 如果原型上没有 `bar`, 那么实例 `Bob` 的 `bar` 哪里来的呢?

通过 Babel 转移:

```javascript
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class Person {
  constructor(name) {
    _defineProperty(this, "bar", () => {
      console.log(this.name);
    });

    this.name = name;
  }
  foo() {
    console.log(this.name);
  }
}
```

可以发现实例 `Bob` 在初始化时候定义了 `bar` 这个属性, 绑定了实例的属性, 而非原型上的方法.


再回过来看上面的 `react` 例子, 这么理解下:

```javascript
const app = new App()
const ele = app.render()
ele.btn1.onClick() // undefined
ele.btn2.onClick() // App
```

对应的可以写一个:

```javascript
class Cpnt {
  constructor() {
    this.id = 1
  }
  foo() {
    console.log(this.id)
  }
  bar = () => console.log(this.id)
  render() {
    return {
      foo: this.foo,
      bar: this.bar,
    }
  }
}
const app = new Cpnt()
app.foo() // 1
app.bar() // 1
const ele = app.render()
ele.foo() // undefined
ele.bar() // 1
```

这就可以解释了在 `react` 中手动绑定 `this` 的原因, 在 `ele.foo()` 会去 `ele` 的环境下查找 `id`, 而 `ele` 并没有在 `Cpnt` 原型链上, 没有 `id` 属性.

## Reference

- [Methods in ES6 objects: using arrow functions](https://stackoverflow.com/questions/31095710/methods-in-es6-objects-using-arrow-functions)
- ['this' inside object](https://stackoverflow.com/questions/7043509/this-inside-object)
- [The Difference Between Function and Block Scope in JavaScript](https://medium.com/@josephcardillo/the-difference-between-function-and-block-scope-in-javascript-4296b2322abe)
- [This is why we need to bind event handlers in Class Components in React](https://medium.freecodecamp.org/this-is-why-we-need-to-bind-event-handlers-in-class-components-in-react-f7ea1a6f93eb)
- [Arrow Functions in Class Properties Might Not Be As Great As We Think](https://medium.com/@charpeni/arrow-functions-in-class-properties-might-not-be-as-great-as-we-think-3b3551c440b1)
- [Why do I have to .bind(this) for methods defined in React component class, but not in regular ES6 class](https://stackoverflow.com/questions/39552536/why-do-i-have-to-bindthis-for-methods-defined-in-react-component-class-but-n)