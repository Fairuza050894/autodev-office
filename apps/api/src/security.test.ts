import { describe,it,expect } from 'vitest';
import { passwordHash,verifyPassword,portalToken,verifyPortal,encrypt,decrypt } from './security.js';
import { pool } from './store.js';
import { afterAll } from 'vitest';
afterAll(async()=>pool.end());
describe('security boundaries',()=>{
 it('hashes passwords with independent salts',()=>{const a=passwordHash('AutoDevLocal2026!'),b=passwordHash('AutoDevLocal2026!');expect(a).not.toBe(b);expect(verifyPassword('AutoDevLocal2026!',a)).toBe(true);expect(verifyPassword('wrong',a)).toBe(false);});
 it('scopes portal token and rejects tampering or expiry',()=>{const token=portalToken('project-a');expect(verifyPortal(token)).toBe('project-a');expect(()=>verifyPortal(`${token}x`)).toThrow();expect(()=>verifyPortal(portalToken('project-a',-1))).toThrow();expect(()=>verifyPortal(`${token}.suffix`)).toThrow();});
 it('encrypts secrets with authenticated ciphertext',()=>{const secret={OPENAI_API_KEY:'test-key'};const ciphertext=encrypt(secret);expect(ciphertext).not.toContain('test-key');expect(decrypt(ciphertext)).toEqual(secret);const changed=Buffer.from(ciphertext,'base64');changed[30]=(changed[30]??0)^1;expect(()=>decrypt(changed.toString('base64'))).toThrow();});
});
