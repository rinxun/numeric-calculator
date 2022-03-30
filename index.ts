type IConfig = {
  enableCheckBoundary?: boolean;
};

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
   * get the length of the mantissa of the numeric
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
   * get the precise value
   * @param {number} num numeric
   * @param {number} precision default 15
   */
  private processPrecision(num: number, precision?: number) {
    return +parseFloat(num.toPrecision(precision || 15));
  }

  /**
   * core processor for times
   * @param {number} num1 operand 1
   * @param {number} num2 operand 2
   */
  private processTimes(num1: number, num2: number) {
    const num1MatissaLen = this.getMantissaLen(num1);
    const num2MatissaLen = this.getMantissaLen(num2);
    const amplifyingNum1 = num1 * Math.pow(10, num1MatissaLen);
    const amplifyingNum2 = num2 * Math.pow(10, num2MatissaLen);

    const magnification = Math.pow(10, num1MatissaLen + num2MatissaLen);

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
    const num1MatissaLen = this.getMantissaLen(num1);
    const num2MatissaLen = this.getMantissaLen(num2);

    const amplifyingNum1 = num1 * Math.pow(10, num1MatissaLen);
    const amplifyingNum2 = num2 * Math.pow(10, num2MatissaLen);

    const magnification = Math.pow(10, num2MatissaLen - num1MatissaLen);

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
    const num1MatissaLen = this.getMantissaLen(num1);
    const num2MatissaLen = this.getMantissaLen(num2);
    const maxMatissaLen = Math.max(num1MatissaLen, num2MatissaLen);
    const magnification = Math.pow(10, maxMatissaLen);

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
    const num1MatissaLen = this.getMantissaLen(num1);
    const num2MatissaLen = this.getMantissaLen(num2);
    const maxMatissaLen = Math.max(num1MatissaLen, num2MatissaLen);
    const magnification = Math.pow(10, maxMatissaLen);

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
   * @param {number[]} nums operands
   * @param {"plus" | "minus" | "times" | "divide"} op operator
   */
  private calculate(
    nums: Array<number>,
    op: "plus" | "minus" | "times" | "divide"
  ) {
    const operands = [...nums];
    let firstOperand = this._VALUE;
    if (firstOperand === undefined) {
      firstOperand = operands[0];
      operands.shift();
    }
    const result = operands.reduce((prev, operand) => {
      switch (op) {
        case "plus":
          return this.processPlus(prev, operand);
        case "minus":
          return this.processMinus(prev, operand);
        case "times":
          return this.processTimes(prev, operand);
        case "divide":
          return this.processDivide(prev, operand);
        default:
          return prev;
      }
    }, firstOperand);
    this._VALUE = result;
  }
  // #endregion

  // #region Constructor
  /**
   * @constructor
   * @param {number|undefined} num initial operand
   * @param {Config} config Configurations
   */
  constructor(num?: number, config?: IConfig) {
    if (num !== undefined && num !== null) {
      this._VALUE = num;
    }
    if (config) {
      if (config.enableCheckBoundary) {
        this._enableCheckBoundary = config.enableCheckBoundary;
      }
    }
  }
  // #endregion

  // #region Public Functions
  /**
   * @description parse the result to precise numeric
   * @param precision default to 15
   * @returns {number} precise result
   */
  public toPrecision(precision?: number) {
    return this.processPrecision(this._VALUE || 0, precision);
  }

  /**
   * @description plus operator
   * @param {number[]} nums operands
   */
  public plus(...nums: Array<number>) {
    this.calculate(nums, "plus");
    return this;
  }

  /**
   * @description minus operator
   * @param {number[]} nums operands
   */
  public minus(...nums: Array<number>) {
    this.calculate(nums, "minus");
    return this;
  }

  /**
   * @description times operator
   * @param {number[]} nums operands
   */
  public times(...nums: Array<number>) {
    this.calculate(nums, "times");
    return this;
  }

  /**
   * @description divide operator
   * @param {number[]} nums operands
   */
  public divide(...nums: Array<number>) {
    this.calculate(nums, "divide");
    return this;
  }
  // #endregion
}

export default Calculator;
