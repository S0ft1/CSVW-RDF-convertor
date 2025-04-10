import { CsvwNumberFormat } from '../types/descriptor/datatype.js';
import  issueTracker from '../utils/error-collector.js'

export function parseNumber(value: string, format: CsvwNumberFormat): number {
  let decimal= format?.decimalChar as string;
  let groupChar = format?.groupChar as string;
  let pattern = format?.pattern as string;

  pattern = preparePattern(pattern, decimal,groupChar);
  
  if (value === 'INF') return Infinity;
  if (value === '-INF') return -Infinity;
  if (value === 'NaN') return NaN;

  let transformedNumber: number | null;

  transformedNumber = pattern == null ? 
  castToNumberWithoutPattern(value, decimal, groupChar) 
  : castToNumberByPattern(pattern, value, decimal, groupChar);

  if (transformedNumber == null) {
    throw Error("Invalid number format");
  }
  return transformedNumber; 
}

function preparePattern(pattern: string, decimalChar: string, groupChar:string) : string {
    if (!pattern) return pattern;
 
   const DECIMAL_MARKER = "__DEC__";
   const GROUP_MARKER = "__GRP__";
 
   let result = pattern;
   if (decimalChar) {
     result = result.split(decimalChar).join(DECIMAL_MARKER);
   }
   if (groupChar) {
     result = result.split(groupChar).join(GROUP_MARKER);
   }
   result = result
     .split(DECIMAL_MARKER).join(".")
     .split(GROUP_MARKER).join(",");
 
   return result;
 }


/** 
function prepareDefaultParameters(decimal: any, groupChar: any, pattern:any) : void {
  if(decimal != typeof String){
    issueTracker.addWarning("DecimalChar property is not string at cell:");
    decimal = null;
  }

  if(decimal == null) {
      decimal = '.'
  }

  if(groupChar != typeof String){
    issueTracker.addWarning("GroupChar property is not string at cell:");
    groupChar = null;
  }

  if(groupChar == null) {
    groupChar = ','
  }

  if(pattern != typeof String){
    issueTracker.addWarning("Pattern property is not string at cell:");
    pattern = null;
  }
}
*/

function castToNumberWithoutPattern(value: string, decimal: string, groupChar: string): number | null {
  let newVal : string = "";
  let divideBy : number = 1;

  for(let i = 0;i<value.length;++i){
    console.log(newVal);
    if(value[i]==decimal){
      newVal += '.';
    }
    else if (value[i]==groupChar){
      //ignore group characters
      continue;
    }
    else if(value[i]=='%'|| value[i]=='‰'){
      //if the value is notated with % or ‰, we need to divide it by 100 or 1000
      if(i!=value.length-1){
       issueTracker.addError("% or ‰ symbol not at the end of default patterned number at cell:");
      }
      else{
        divideBy = value[i]=='%' ? 100 : 1000;
      }
    }
    else{
      newVal+= value[i];
    }
  }
  return +newVal/divideBy;
}

function castToNumberByPattern(pattern: string, number: string ,decimal:string, groupChar: string) : number | null {
  let strNumber : string = "";
  let zeroPadding : boolean = true;

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const numberChar = number[i];
    if(i==number.length) {
      break;
    }
    if (char === '#') {
      var regex = new RegExp('[0-9]');
      if(!regex.test(numberChar)) {
        issueTracker.addError("Pattern is not matching with number at cell:");
        return null;
      }
      strNumber += numberChar;
      zeroPadding = false;
    } else if (char === '0') {
      var regex = new RegExp('[0-9]');
      if(!regex.test(numberChar)){
        issueTracker.addError("Pattern is not matching with number at cell:");
        return null;
      }
      if(numberChar!='0'|| !zeroPadding) {
        zeroPadding = false;
        strNumber += numberChar;
      }
    } else if (char === ',') {
      if(numberChar !== groupChar) {
        issueTracker.addError("Group char is not present it the number at cell:");
        return null;
      }
    } else if (char === '.') {
      if(numberChar !== decimal) {
        issueTracker.addError("Decimal char is not present it the number at cell:");
        return null;
      }
      strNumber += '.';
    }
  }
  return +strNumber;
}

