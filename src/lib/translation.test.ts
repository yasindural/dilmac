import {describe,expect,it} from 'vitest';import {translate} from './translation';
describe('demo çeviri',()=>{it('Türkçe örneği İngilizceye çevirir',async()=>{const result=await translate('Merhaba, nasılsın?','İngilizce');expect(result.demo).toBe(true);expect(result.text).toBe('Hello')})});
