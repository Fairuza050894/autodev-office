import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['**/node_modules/**','**/.next/**','**/next-env.d.ts','**/dist/**','coverage/**','data/**','playwright-report/**','test-results/**']},...tseslint.configs.recommended,{rules:{'@typescript-eslint/no-explicit-any':'error','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}});
