<h1 align="center">Numeric Calculator</h1>

<p align="center">Calculate addition, subtaction, multiplication, division precisely, for tackling the precision issue</p>

---

<h2>Installation</h2>

It is available as an [npm package](https://www.npmjs.com/package/@rinxun/numeric-calculator).

```sh
// with npm
npm install @rinxun/numeric-calculator

// with yarn
yarn add @rinxun/numeric-calculator
```



<h2>License</h2>

This project is licensed under the terms of the [MIT license](https://github.com/rinxun/numeric-calculator/blob/master/LICENSE).



<h2>Why do we need this</h2>

```typescript
0.1 + 0.2 = 0.30000000000000004; 
0.1 + 0.2 - 0.3 = 5.551115123125783e-17;
```



<h2>Constructor</h2>

- `new NC(number: number, config: object)`

  - number: Initial numeric

    - optional

  - config: Configurations 

    - optional

    - ```js
      config = {
        enableCheckBoundary?: boolean // if true, it will check if the value is out of the safe boundary
      }
      ```



<h2>Methods</h2>

The instance supports chain operations.

- `plus(operands: number[]) => instance `
- `minus(operands: number[]) => instance`
- `times(operands: number[]) => instance`
- `divide(operands: number[]) => instance`
- `toPrecision(precision?: number) => number`



<h2>Usage</h2>

<h4>Import</h4>

```typescript
// CommonJS
const NC = require('@rinxun/numeric-calculator');

// ES6 
import NC from '@rinxun/numeric-calculator';
```



<h4>Instantiate</h4>

```typescript
const inst1 = new NC(); 
// or with initial numeric
const inst2 = new NC(10); 
// or with config
const inst3 = new NC(10, { enableCheckBoundary: true }); 
```



<h4>inst.plus</h4>

```typescript
const result = new NC().plus(2.134).toPrecision(); // 2.134
const result = new NC().plus(2.1341, 3.09, 0.65).toPrecision(); // 5.8741
const result = new NC(10).plus(2.134).toPrecision(); // 12.134
const result = new NC(10).plus(2.1341, 3.09, 0.65).toPrecision(); // 15.8741
```



<h4>inst.minus</h4>

```typescript
const result = new NC().minus(0.4).toPrecision(); // -0.6
const result = new NC().minus(0.25, 1.5, 3.498).toPrecision(); // -4.748
const result = new NC(2).minus(0.4).toPrecision(); // 1.6
const result = new NC(-2).minus(0.25, 1.5, 3.498).toPrecision(); // -7.248
```



<h4>inst.times</h4>

```typescript
const result = new NC().times(0.12).toPrecision(); // 0.12
const result = new NC().times(0.12, 100, 5).toPrecision(); // 60
const result = new NC(-4).times(0.12).toPrecision(); // -0.48
const result = new NC(3.2).times(0.12, 100, 5).toPrecision(); // 192
```



<h4>inst.divide</h4>

```typescript
const result = new NC().divide(3).toPrecision(); // 3
const result = new NC().divide(100, 20, 2).toPrecision(); // 2.5
const result = new NC(36.12).divide(3).toPrecision(); // 12.04
const result = new NC(-1000).divide(100, 20, 2).toPrecision(); // -0.25
```



<h4>inst.toPrecision</h4>

```typescript
const result = new NC(1.2345).toPrecision(); // 1.2345
const result = new NC(1.2345).toPrecision(4); // 1.234
const result = new NC(1.2e-2).toPrecision(); // 0.012
```



<h4>chain operations</h4>

```typescript
const result = new NC(10).plus(2).minus(4).times(2).divide(8).toPrecision(); // 2
```



