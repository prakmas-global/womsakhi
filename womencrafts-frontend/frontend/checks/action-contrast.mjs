/** Audit real foreground/fill pairs, including generated/custom themes. Node 22+. */
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);throw error;}}});
const {contrast,whiteTextFill,readableOn,STEPS}=await import('../src/theme-engine/palette.ts');
const {themeToVariables,applyTheme,clearTheme}=await import('../src/theme-engine/apply.ts');
const {PRESETS}=await import('../src/theme-engine/presets.ts');
const themes=[...PRESETS,...['#ffff00','#00ffff','#ffd9e8','#777777','#ffffff','#000000'].map(primary=>({id:'custom',primary,secondary:'#a175aa'}))];
let pairs=0,gradients=0;
for(const theme of themes)for(const mode of ['light','dark']){
 const vars=themeToVariables(theme,mode);
 for(const prefix of ['--color-brand','--color-violet'])for(const step of STEPS){
  assert.ok(contrast(vars[`${prefix}-${step}`],vars[`${prefix}-${step}-contrast`])>=4.5,`${theme.id}/${mode}/${prefix}/${step}`);pairs++;
 }
 const start=vars['--color-action-start'],end=vars['--color-action-end'];
 const rgb=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16));const a=rgb(start),b=rgb(end);
 for(let i=0;i<=100;i++){
  const mix='#'+a.map((value,j)=>Math.round(value+(b[j]-value)*i/100).toString(16).padStart(2,'0')).join('');
  assert.ok(contrast(mix,'#ffffff')>=6.99,`${theme.id}/${mode}/gradient/${i}`);gradients++;
 }
}
assert.equal(readableOn('#777777'),'#000000');
assert.equal(whiteTextFill('#742a4f'),'#742a4f');
assert.ok(contrast(whiteTextFill('#a175aa'),'#ffffff')>=7);
// Switching back to CSS defaults must clear every new foreground/action token.
const props=new Map();const target={style:{setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k)}};
globalThis.window={};globalThis.document={documentElement:target};
applyTheme(PRESETS[0],'dark',target);assert.ok(props.has('--color-action-start'));clearTheme(target);assert.equal(props.size,0);
console.log(`PASS: ${pairs} foreground/fill pairs, ${gradients} white-text gradient samples, mid-grey fallback and theme cleanup.`);
