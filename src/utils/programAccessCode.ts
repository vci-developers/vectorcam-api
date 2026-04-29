import { randomInt } from 'crypto';

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ACCESS_CODE_PATTERN = /^[A-Za-z]{2}\d{2}[A-Za-z]{2}\d{2}$/;

function randomFrom(source: string, length: number): string {
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += source[randomInt(source.length)];
  }
  return value;
}

function randomDigits(length: number): string {
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += randomInt(10).toString();
  }
  return value;
}

export function generateProgramAccessCode(): string {
  return `${randomFrom(LETTERS, 2)}${randomDigits(2)}${randomFrom(LETTERS, 2)}${randomDigits(2)}`;
}

export function isValidProgramAccessCode(accessCode: string): boolean {
  return ACCESS_CODE_PATTERN.test(accessCode);
}
