<h1 align="center">Numeric Calculator</h1>

<p align="center">Calculate addition, subtraction, multiplication, division precisely, for tackling the precision issue</p>

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

- `new NC(operand: IOperand, config: IConfig)`

  - number: Initial numeric

    - optional
    - `type IOperand = instance | number | string`

  - config: Configurations 

    - optional

    - ```js
      config = {
        enableCheckBoundary?: boolean // if true, it will check if the value is out of the safe boundary
      }
      ```



<h2>Methods</h2>

The instance supports chain operations.

- `plus(operands: IOperand[]) => instance `
- `minus(operands: IOperand[]) => instance`
- `times(operands: IOperand[]) => instance`
- `divide(operands: IOperand[]) => instance`
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
const inst3 = new NC('10'); 
const inst4 = new NC(new NC(10)); 
// or with config
const inst5 = new NC(10, { enableCheckBoundary: true }); 
```



<h4>inst.plus(operands: IOperand[])</h4>

```typescript
const result = new NC().plus(2.134).toPrecision(); // 2.134
const result = new NC().plus(2.1341, new NC(1.09).plus(2), '0.65').toPrecision(); // => 2.1341+(1.09+2)+0.65 = 5.8741
const result = new NC(10).plus(2.134).toPrecision(); // => 10+2.134 = 12.134
const result = new NC(10).plus(2.1341, '3.09', 0.65).toPrecision(); // => 10+2.1341+3.09+0.65 = 15.8741
```



<h4>inst.minus(operands: IOperand[])</h4>

```typescript
const result = new NC().minus(0.4).toPrecision(); // 0.4
const result = new NC().minus(0.25, new NC(2.5).minus(1), '3.498').toPrecision(); // => 0.25-(2.5-1)-3.498 -4.748
const result = new NC(2).minus(0.4).toPrecision(); // => 2-0.4 = 1.6
const result = new NC(-2).minus(0.25, 1.5, 3.498).toPrecision(); // -2-0.25-1.5-3.498 = -7.248
```



<h4>inst.times(operands: IOperand[])</h4>

```typescript
const result = new NC().times(0.12).toPrecision(); // 0.12
const result = new NC().times(0.12, new NC(8).times(12.5), '5').toPrecision(); // => 0.12*(8*12.5)*5 = 60
const result = new NC(-4).times(0.12).toPrecision(); // => -4*0.12 = -0.48
const result = new NC(3.2).times(0.12, '100', 5).toPrecision(); // => 3.2*0.12*100*5 = 192
```



<h4>inst.divide(operands: IOperand[])</h4>

```typescript
const result = new NC().divide(3).toPrecision(); // 3
const result = new NC().divide(100, new NC(60).divide(3), '2').toPrecision(); // => 100/(60/3)/2 = 2.5
const result = new NC(36.12).divide(3).toPrecision(); // => 36.12/3 = 12.04
const result = new NC(-1000).divide(100, '20', 2).toPrecision(); // -1000/100/20/2 = -0.25
```



<h4>inst.toPrecision(precision?: number)</h4>

```typescript
const result = new NC(1.2345).toPrecision(); // 1.2345
const result = new NC(1.2345).toPrecision(4); // 1.234
const result = new NC(1.2e-2).toPrecision(); // 0.012
```



<h4>chain operations</h4>

```typescript
const result = new NC(10).plus(2).minus(4).times(2).divide(8).toPrecision(); // => (10+2-4)*2/8 = 2
const result = new NC(10).plus(new NC().times(2, 4), '6').divide(new NC(12).minus(4)).toPrecision(); // => (10+(2*4)+6)/(12-4) = 3
```



<h2>Changelog</h2>

If you have recently updated, please read the [changelog](https://github.com/rinxun/numeric-calculator/releases) for details of what has changed.