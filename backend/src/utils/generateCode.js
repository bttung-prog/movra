import { customAlphabet } from "nanoid";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const generate = customAlphabet(alphabet, 8);

const generateCode = (prefix) => {
  return `${prefix}${generate()}`;
};

export default generateCode;
