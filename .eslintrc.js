module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "plugin:react/recommended",
  ],
  plugins: [
    "@typescript-eslint",
    "prefer-arrow",
    "react",
    "react-hooks",
  ],
  parser: "@typescript-eslint/parser",
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  parserOptions: {
    sourceType: "module",
    project: [
      "./tsconfig.json",
      "./functions/tsconfig.json"
    ],
  },
  rules: {
    "max-len": [
      "error",
      {
        code: 120,
        ignorePattern: "^\\s*\\S+\\s*$",
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],
    "@typescript-eslint/explicit-function-return-type": 0,
    "prefer-arrow/prefer-arrow-functions": [
      "error",
      {
        "disallowPrototype": true,
      },
    ],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-no-target-blank": ["error", { "enforceDynamicLinks": "always" }],
    "@typescript-eslint/no-use-before-define": ["error", { variables: false, classes: false }],
    "react/prop-types": ["error", { ignore: ["children"], skipUndeclared: true }],
    "@typescript-eslint/no-parameter-properties": 0,
    "@typescript-eslint/no-object-literal-type-assertion": 0,
    "no-irregular-whitespace": 0,
    "prettier/prettier": ["error", {
      "endOfLine":"auto",
    }]
  },

  settings: {
    react: {
      pragma: "React",
      version: "detect",
    },
  }
};