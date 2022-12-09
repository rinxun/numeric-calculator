type IConfig = {
  precision?: number;
  fractionDigits?: number;
  enableCheckBoundary?: boolean;
};

type IOperand = Calculator | number | string;

/**
 * @description Calculate addition, subtaction, multiplication, division precisely, for tackling the precision issue
 * @author Janden Ma
 * @copyright Symply Software Inc
 */
class Calculator {
  // #region Private Variables
  /**
   * @private
   * @description global register for temporary results, core for chaining operations
   */
  private _VALUE: number | undefined = undefined;
  /**
   * @private
   * @description global default precision, default to 15, should be in the range 0 - 20, effects `toPrecision` when `toPrecision` has no args
   */
  private _precision: number = 15;
  /**
   * @private
   * @description global default decimal length, default to 2, should be in the range 0 - 20, effects `toFixed` when `toFixed` has no args
   */
  private _fractionDigits: number = 2;
  /**
   * @private
   * @description for debugging, if true, it will check if the value is out of the safe boundary
   */
  private _enableCheckBoundary: boolean = false;
  // #endregion

  // #region Private Functions
  /**
   * @description check if the value is out of the safe boundary
   * @param {number} value
   */
  private checkBoundary(value: number) {
    if (this._enableCheckBoundary) {
      const val = value || this._VALUE || 0;
      if (val > Number.MAX_SAFE_INTEGER || val < Number.MIN_SAFE_INTEGER) {
        console.warn(
          `${val} is out of the safe boundary, the result may be not accurate!`
        );
      }
    }
  }

  /**
   * @description get the length of the mantissa of the numeric
   * @param {number} num numeric
   */
  private getMantissaLen(num: number) {
    const arrBySplittingExponent = num.toString().split(/[Ee]/); // eg: 2.1337983389e-12
    const exponentPrefix = arrBySplittingExponent[0]; // value before e (eg: 2.1337983389)
    const exponentSuffix = arrBySplittingExponent[1] || 0; // exponent length (eg: -12)
    const decimals = exponentPrefix.split(".")[1] || ""; // decimals before e (eg: 1337983389)
    const len = decimals.length - +exponentSuffix;
    return len > 0 ? len : 0;
  }

  /**
   * @description according to the type of operand, parse it to number
   * @param {IOperand} operand operand
   */
  private parseOperandToNum(operand: IOperand) {
    if (operand instanceof Calculator) {
      return operand._VALUE;
    } else if (typeof operand === "number") {
      return operand;
    } else {
      const val = Number(operand);
      return Number.isNaN(val) ? 0 : val;
    }
  }

  /**
   * get the precise value
   * @param {number} num numeric
   * @param {number} precision default 15
   */
  private processPrecision(num: number, precision?: number) {
    return +parseFloat(num.toPrecision(precision || this._precision || 15));
  }

  /**
   * get the fixed-point value
   * @param {number} num numeric
   * @param {number} fractionDigits default 2
   */
  private processFixed(num: number, fractionDigits?: number) {
    return this.processPrecision(num).toFixed(
      fractionDigits || this._fractionDigits || 2
    );
  }

  /**
   * core processor for times
   * @param {number} num1 operand 1
   * @param {number} num2 operand 2
   */
  private processTimes(num1: number, num2: number) {
    const num1MantissaLen = this.getMantissaLen(num1);
    const num2MantissaLen = this.getMantissaLen(num2);
    const amplifyingNum1 = num1 * Math.pow(10, num1MantissaLen);
    const amplifyingNum2 = num2 * Math.pow(10, num2MantissaLen);

    const magnification = Math.pow(10, num1MantissaLen + num2MantissaLen);

    this.checkBoundary(amplifyingNum1);
    this.checkBoundary(amplifyingNum2);

    const amplifyingResult = amplifyingNum1 * amplifyingNum2;

    this.checkBoundary(amplifyingResult);

    return amplifyingResult / magnification;
  }

  /**
   * core processor for divide
   * @param {number} num1 operand 1
   * @param {number} num2 operand 2
   */
  private processDivide(num1: number, num2: number) {
    const num1MantissaLen = this.getMantissaLen(num1);
    const num2MantissaLen = this.getMantissaLen(num2);

    const amplifyingNum1 = num1 * Math.pow(10, num1MantissaLen);
    const amplifyingNum2 = num2 * Math.pow(10, num2MantissaLen);

    const magnification = Math.pow(10, num2MantissaLen - num1MantissaLen);

    this.checkBoundary(amplifyingNum1);
    this.checkBoundary(amplifyingNum2);

    const amplifyingResult = amplifyingNum1 / amplifyingNum2;

    return this.processTimes(
      this.processPrecision(amplifyingResult),
      magnification
    );
  }

  /**
   * core processor for minus
   * @param {number} num1 operand 1
   * @param {number} num2 operand 2
   */
  private processMinus(num1: number, num2: number) {
    const num1MantissaLen = this.getMantissaLen(num1);
    const num2MantissaLen = this.getMantissaLen(num2);
    const maxMantissaLen = Math.max(num1MantissaLen, num2MantissaLen);
    const magnification = Math.pow(10, maxMantissaLen);

    const amplifyingNum1 = this.processTimes(num1, magnification);
    const amplifyingNum2 = this.processTimes(num2, magnification);

    this.checkBoundary(amplifyingNum1);
    this.checkBoundary(amplifyingNum2);

    const amplifyingResult = amplifyingNum1 - amplifyingNum2;

    this.checkBoundary(amplifyingResult);

    return amplifyingResult / magnification;
  }

  /**
   * core processor for plus
   * @param {number} num1 operand 1
   * @param {number} num2 operand 2
   */
  private processPlus(num1: number, num2: number) {
    const num1MantissaLen = this.getMantissaLen(num1);
    const num2MantissaLen = this.getMantissaLen(num2);
    const maxMantissaLen = Math.max(num1MantissaLen, num2MantissaLen);
    const magnification = Math.pow(10, maxMantissaLen);

    const amplifyingNum1 = this.processTimes(num1, magnification);
    const amplifyingNum2 = this.processTimes(num2, magnification);

    this.checkBoundary(amplifyingNum1);
    this.checkBoundary(amplifyingNum2);

    const amplifyingResult = amplifyingNum1 + amplifyingNum2;

    this.checkBoundary(amplifyingResult);

    return amplifyingResult / magnification;
  }

  /**
   * core processor for times
   * @param {IOperand[]} operands operands
   * @param {"plus" | "minus" | "times" | "divide"} op operator
   */
  private calculate(
    operands: Array<IOperand>,
    op: "plus" | "minus" | "times" | "divide"
  ) {
    const values = [...operands];
    let firstOperand = this._VALUE;

    const analyzeFirstOperand = (): number => {
      const parsedVal = this.parseOperandToNum(values[0]);
      values.shift();
      if (parsedVal === undefined) {
        return analyzeFirstOperand();
      }
      return parsedVal;
    };

    if (firstOperand === undefined) {
      firstOperand = analyzeFirstOperand();
    }
    const result = values.reduce((prevOperand, currOperand) => {
      const prev = this.parseOperandToNum(prevOperand)!;
      const current = this.parseOperandToNum(currOperand);

      if (current === undefined) {
        return prev;
      }

      switch (op) {
        case "plus": {
          if (current === 0) {
            return prev;
          }
          return this.processPlus(prev, current);
        }
        case "minus": {
          if (current === 0) {
            return prev;
          }
          return this.processMinus(prev, current);
        }
        case "times": {
          if (current === 0) {
            return 0;
          }
          return this.processTimes(prev, current);
        }
        case "divide": {
          if (current === 0) {
            return 0;
          }
          return this.processDivide(prev, current);
        }
        default:
          return prev!;
      }
    }, firstOperand);
    this._VALUE = this.parseOperandToNum(result);
  }
  // #endregion

  // #region Constructor
  /**
   * @constructor
   * @param {IOperand|undefined} operand Initial operand
   * @param {IConfig|undefined} config Configurations
   */
  constructor(operand?: IOperand, config?: IConfig) {
    if (operand !== undefined && operand !== null) {
      this._VALUE = this.parseOperandToNum(operand);
    }
    if (config) {
      if (config.precision !== undefined) {
        this._precision = config.precision;
      }
      if (config.fractionDigits !== undefined) {
        this._fractionDigits = config.fractionDigits;
      }
      if (config.enableCheckBoundary) {
        this._enableCheckBoundary = config.enableCheckBoundary;
      }
    }
  }
  // #endregion

  // #region Public Functions
  /**
   * @description parse the result to precise numeric
   * @param {number} precision default to 15
   * @returns {number} precise result
   */
  public toPrecision(precision?: number): number {
    return this.processPrecision(this._VALUE || 0, precision);
  }

  /**
   * @description parse the result to fixed-point value
   * @param {number} fractionDigits default to 2, should be in the range 0 - 20
   * @returns {string} fixed-point result
   */
  public toFixed(fractionDigits?: number): string {
    return this.processFixed(this._VALUE || 0, fractionDigits);
  }

  /**
   * @description plus operator
   * @param {Array<IOperand>} operands operands
   */
  public plus(...operands: Array<IOperand>) {
    this.calculate(operands, "plus");
    return this;
  }

  /**
   * @description minus operator
   * @param {Array<IOperand>} operands operands
   */
  public minus(...operands: Array<IOperand>) {
    this.calculate(operands, "minus");
    return this;
  }

  /**
   * @description times operator
   * @param {Array<IOperand>} operands operands
   */
  public times(...operands: Array<IOperand>) {
    this.calculate(operands, "times");
    return this;
  }

  /**
   * @description divide operator
   * @param {Array<IOperand>} operands operands
   */
  public divide(...operands: Array<IOperand>) {
    this.calculate(operands, "divide");
    return this;
  }
  // #endregion
}

export default Calculator;
