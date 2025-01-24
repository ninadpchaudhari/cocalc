/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["./test/setup.js"], // Path to your setup file
  testMatch: ["**/?(*.)+(spec|test).ts?(x)"],
};
