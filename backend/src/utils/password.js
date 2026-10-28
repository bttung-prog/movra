import bcrypt from "bcrypt";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

export const hashPassword = (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};
