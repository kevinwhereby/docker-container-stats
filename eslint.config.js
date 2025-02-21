// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
    {
        ignores: ["**/dist/"],
    },
    {
        files: ["**/*.ts"],
        extends: [
            eslint.configs.recommended,
            eslintPluginPrettierRecommended,
            ...tseslint.configs.recommendedTypeChecked,
            ...tseslint.configs.stylisticTypeChecked,
            {
                languageOptions: {
                    parserOptions: {
                        project: "./eslint.tsconfig.json",
                        tsconfigRootDir: import.meta.dirname,
                    },
                },
            },
        ],
        rules: {
            "@typescript-eslint/array-type": "off",
            "@typescript-eslint/consistent-type-definitions": "off",
            "@typescript-eslint/consistent-type-imports": [
                "warn",
                {
                    prefer: "type-imports",
                    fixStyle: "inline-type-imports",
                },
            ],
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-misused-promises": [
                "error",
                {
                    checksVoidReturn: { attributes: false },
                },
            ],
            "no-console": "error",
        },
    },
    {
        files: ["src/**/*.spec.ts"],

        rules: {
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/unbound-method": "off",
        },
    },
);
