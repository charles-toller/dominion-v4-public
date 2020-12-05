module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    },
    "parser": "@typescript-eslint/parser",
    "extends": ["eslint:recommended", "plugin:react/recommended", "plugin:@typescript-eslint/recommended"],
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaFeatures": {
            "jsx": true
        },
        "ecmaVersion": 2018,
        "sourceType": "module",
        "project": "./tsconfig.eslint.json"
    },
    "settings": {
        "react": {
            "version": "detect"
        }
    },
    "plugins": [
        "react",
        "@typescript-eslint",
        "dominion"
    ],
    "rules": {
        "semi": [
            "error",
            "always"
        ],
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": "error",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "indent": "off",
        "@typescript-eslint/indent": [
            "error",
            4
        ],
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "require-atomic-updates": "off",
        "@typescript-eslint/explicit-member-accessibility": "off",
        "@typescript-eslint/prefer-interface": "off",
        "@typescript-eslint/array-type": ["error", {
            default: 'array-simple'
        }],
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/ban-ts-ignore": "off",
        "@typescript-eslint/no-empty-function": "off",
        "no-case-declarations": "off",
        "dominion/no-vp-without-feature": ["error"],
        "dominion/no-direct-money-access": ["error"],
        "dominion/no-player-maps": ["error"],
        "no-fallthrough": "off"
    }
};