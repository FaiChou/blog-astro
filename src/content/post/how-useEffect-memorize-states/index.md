---
title: "How useEffect memorize states"
publishDate: "2022-02-24"
description: "react useEffect memorize states"
tags: ["react", "dev", "javascript"]

---

直接上最终的代码:

```javascript
let memorizedCallback;
let lock = false;
function foo(callback) {
  if (!lock) {
    lock = true;
    memorizedCallback = callback;
  }
  memorizedCallback();
}
let memorizedVal = null;
function useX(val) {
  const x = memorizedVal || val;
  memorizedVal = x;
  function setX(v) {
    memorizedVal = v;
  }
  return [x, setX];
}
function bar() {
  const [a, setA] = useX(0);
  let b = 0;
  function setB(val) {
    b = val;
  }
  foo(() => setTimeout(() => { console.log(a); console.log(b); }, 1000));
  return { setB, setA };
}
var { setA, setB } = bar(); 
setA(2);
setB(3);
bar();
// log 0 3 0 3
```

`foo` 的函数参数当第一次被执行, 就会被锁住, 不论以后执行多少次, 也不会变化.

当第一次执行 `bar` 时候, `bar` 函数所创建的环境会被 `foo` 参数闭包捕获, 里面用到的 a 和 b, 是第一次执行生成的 a 和 b.

当执行到 `setA(2) setB(3)` 时候, `memorizedVal` 和 `bar` 环境下的 b 被修改了. 注意这里修改的不是 `a`, 而是 `memorizedVal`，想要获取最新的 a 需要下一次执行 `bar()`, 所以此时 log 会打印 0(a) 和 3(b).

当执行到第二遍 `bar()` 时, 由于 `foo` 里面锁住, 传入的参数可以忽略, 其还是执行第一次的 callback, 所以数据还是取自第一次闭包环境. 第一次闭包环境下 `a=0`, 而 b 已经被下面的 `setB(3)` 修改成 3.

所以会有结果: `0 3 0 3`.

## 例子1

```javascript
function Counter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setTimeout(() => {
      console.log(`You clicked ${count} times`);
    }, 3000);
  });
  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

在3秒内, 点击按钮5次, 它会 log: `0 1 2 3 4 5`, 因为 `useEffect` 没有 `deps` 默认 **update** 后重新执行.


## 例子2

```javascript
componentDidUpdate() {
  setTimeout(() => {
    console.log(`You clicked ${this.state.count} times`);
  }, 3000);
}
```

例子1中如果改成 class component 则最终结果是 `0 5 5 5 5 5`.

## 例子3

```javascript
function Example() {
  const [count, setCount] = useState(0);
  const latestCount = useRef(count);
  latestCount.current = count;
  useEffect(() => {
    setTimeout(() => {
      // Read the mutable latest value
      console.log(`You clicked ${latestCount.current} times`);
    }, 3000);
  });
  // ...
}
```

## 例子4

```javascript
let _r = null;
function Example() {
  const [count, setCount] = useState(0);
  _r = count;
  useEffect(() => {
    setTimeout(() => {
      // Read the mutable latest value
      console.log(`You clicked ${_r} times`);
    }, 3000);
  });
  // ...
}
```

这里会 log: `0 5 5 5 5 5`.

```javascript
function useRef(val) {
  const r = useState({ current: val })[0];
  return r;
}
```

## 例子5

```javascript
function usePrevious(v) {
  const p = useRef(v);
  useEffect(() => p.current = v, [v]);
  return p.current;
}
```

## 例子6

```javascript
function useReducer(reducer, initialVal) {
  const [state, setState] = useState(initialVal);
  function dispatch(action) {
    setState(reducer(state, action));
  }
  return [state, dispatch];
}
```

## 例子

```javascript
function useNavigationState(selector) {
  const navigation = useNavigation();
  const [, setResult] = React.useState(() => selector(navigation.getState()));
  const selectorRef = React.useRef(selector);
  React.useEffect(() => {
    selectorRef.current = selector;
  });
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('state', e => {
      setResult(selectorRef.current(e.data.state));
    });
    return unsubscribe;
  }, [navigation]);
  return selector(navigation.getState());
}
```

这里为什么要用 ref 来存储 `selector`?

因为下面的 `useEffect` 里面要使用, 如果不用 `ref+useEffect` 来更新而直接使用 selector, 则该监听器会捕获组件挂载时的 selector，而不会随后续 selector 的更新而更新, 每次传入的函数都是变化的, 而 useRef 不会导致组件重新渲染，这有助于提高性能。

