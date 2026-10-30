import { customAlphabet } from "nanoid";

const alphabet = "0123456789";
const generate = customAlphabet(alphabet, 8);

const generateOtp = () => generate();

const generateCode = (prefix) => {
  return `${prefix}${generate()}`;
};

export default { generateCode, generateOtp };
