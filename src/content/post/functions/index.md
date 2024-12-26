---
title: "Functions"
publishDate: "2021-10-29"
---

在学习用 C 写一个 Lisp 解释器的过程中, 学到 Functions 这一章节, 明白了函数是如何被执行的, 对其内存结构也有了一定的认知.

首先, 任何数据都是一个 `lval` 结构体, 比如数字/符号/错误/函数/S表达式/Q表达式. 其中任意符号比如 `+-*/` 或者 `join tail head` 这些关键字, 甚至 `a b c d` 这种都可算作符号. 那如何知道这些符号代表什么呢? 所以就需要有一个环境 `lenv`. 全局初始化一个 `lenv`, 将默认的 `+-*/ join tail head` 等关键字放进去, 对应上其相关的函数. 那 `a b c d` 这种符号, 如果用户通过 `def` 关键字放进环境中, 那就可以找到对应的值. 如果找不到, 则抛出错误.

要想定义自己的函数, 则需要 lambda 表达式, 其也属于 `lval`. lambda 表达式也属于函数, 只不过没有内定的函数, 只有参数和函数体. 参数和函数体也是 `lval` 类型. 于是下面具体讲一讲函数如何执行的. 关键代码如下:

```c
lval* lval_call(lenv* e, lval* f, lval* a) {
  if (f->builtin) { return f->builtin(e, a); }
  int given = a->count;
  int total = f->formals->count;
  while (a->count) {
    if (f->formals->count == 0) {
      lval_del(a); return lval_err(
        "Function passed too many arguments. "
        "Got %i, Expected %i.", given, total);
    }
    lval* sym = lval_pop(f->formals, 0);
    lval* val = lval_pop(a, 0);
    lenv_put(f->env, sym, val);
    lval_del(sym); lval_del(val);
  }
  lval_del(a);
  if (f->formals->count == 0) {
    f->env->par = e;
    return builtin_eval(
      f->env, lval_add(lval_sexpr(), lval_copy(f->body)));
  } else {
    return lval_copy(f);
  }
}
```

首先一个函数如果有内定执行函数, 比如加减乘除, 则直接执行其内定函数. 否则它就是用户自定义的函数. 函数执行需要实参和形参. 对于形参, 其为未知的符号, 上面讲到有全局环境, 那么函数也有自己的局部环境, 局部环境的 parent 是全局环境. 所以在遍历中, 将实参和形参一一对应到函数的局部变量中, 对形参的符号赋值. 最终再进行 `eval` 将函数体进行执行, 执行过程中遇到的符号去函数自己的环境中寻找, 如果找不到则去全局环境中寻找, 如果最终找不到, 则抛出错误.

这里还有一个问题, 如果函数执行过程中接受的参数个数小于形参, 那会怎样? 这种函数半成品也不能是个错误, 所以应该直接返回目前的状态, 当其再被传入剩余参数时候, 可以被正常执行.

再考虑一个问题, 如何设置可变参数? 比如 `f(s y & xs)` 可以接受至少两个参数. 于是增加几行代码:

```c
if (strcmp(sym->sym, "&") == 0) {
  if (f->formals->count != 1) {
    lval_del(a);
    return lval_err("Function format invalid. "
      "Symbol '&' not followed by single symbol.");
  }
  lval* nsym = lval_pop(f->formals, 0);
  lenv_put(f->env, nsym, builtin_list(e, a));
  lval_del(sym); lval_del(nsym);
  break;
}
```

判断如果参数里面有 `&` 符号, 则将后面接受的所有变量存到后一个形参中, 作为一个 list. 当然也要小心如果只收到最少的参数情况:

```c
if (f->formals->count > 0 &&
  strcmp(f->formals->cell[0]->sym, "&") == 0) {
  if (f->formals->count != 2) {
    return lval_err("Function format invalid. "
      "Symbol '&' not followed by single symbol.");
  }
  lval_del(lval_pop(f->formals, 0));
  lval* sym = lval_pop(f->formals, 0);
  lval* val = lval_qexpr();
  lenv_put(f->env, sym, val);
  lval_del(sym); lval_del(val);
}
```

设置最后的形参为空列表.

```
lispy> def {add-mul} (\ {x y} {+ x (* x y)})
()
lispy> add-mul 10 20
210
lispy> add-mul 10
(\ {y} {+ x (* x y)})
lispy> def {add-mul-ten} (add-mul 10)
()
lispy> add-mul-ten 50
510
lispy>
```

通过 `def {a} (\ {x y} {* x y})` 这种方式不符合平时的函数定义, 平时我们习惯这么写: `def func(a b) { a+b }` 对应到 lisp 里应该是 `func {funcname x y} {* x y}`. 所以需要一点诀窍:

```
\ {args body} {def (head args) (\ (tail args) body)}
def {fun} (\ {args body} {def (head args) (\ (tail args) body)})
fun {add-together x y} {+ x y}
```

这个 lambda 接受两个参数, 函数名+参数 和 函数体, 然后将*函数体+参数* 拆分, 再组合成新的 lambda 就可以实现我们的目标.

### 函数柯里化

名字很玄乎, 就是为了解决函数接受一个参数, 如何将多个参数压缩成一个传进去, 和函数接受多个参数, 如何将传如的一个列表展开传进去.

所以:

```
fun {unpack f xs} {eval (join (list f) xs)}
fun {pack f & xs} {f xs}
```

```
lispy> def {uncurry} pack
()
lispy> def {curry} unpack
()
lispy> curry + {5 6 7}
18
lispy> uncurry head 5 6 7
{5}
```
