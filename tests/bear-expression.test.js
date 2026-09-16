import test from 'node:test';
import assert from 'node:assert/strict';
import { BearExpression, bearBlink, lookAtBearTarget } from '../src/bear-expression.js';

test('gift reactions move from surprise to delight, then return to context',()=>{
  const state=new BearExpression();state.react('delighted',2);
  state.update(.1,{mood:'curious'});assert.equal(state.mood,'surprised');assert.ok(state.values.open>0);
  state.update(.4,{mood:'curious'});assert.equal(state.mood,'delighted');assert.ok(state.values.smile>0);
  state.update(2,{mood:'curious'});assert.equal(state.mood,'curious');assert.equal(state.reaction,null);
  assert.equal(state.react('unknown'),false);assert.equal(state.react('shy',NaN),false);
});
test('pause freezes emotions, and candle wishes take priority over reactions',()=>{
  const state=new BearExpression();state.react('delighted');state.update(.4);
  const before=JSON.stringify(state);state.update(0,{mood:'wish',scripted:true});assert.equal(JSON.stringify(state),before);
  state.update(.1,{mood:'wish',scripted:true});assert.equal(state.mood,'wish');
  state.reset();assert.equal(state.mood,'calm');assert.equal(state.reaction,null);assert.equal(state.values.open,0);
});
test('expression blends are frame-rate independent and reduced motion changes directly',()=>{
  const a=new BearExpression(),b=new BearExpression();
  for(let i=0;i<60;i++)a.update(1/60,{mood:'shy',look:.2});
  for(let i=0;i<30;i++)b.update(1/30,{mood:'shy',look:.2});
  for(const key of Object.keys(a.values))assert.ok(Math.abs(a.values[key]-b.values[key])<1e-9);
  a.update(.01,{mood:'calm'},true);assert.equal(a.values.blush,0);assert.equal(a.values.tilt,0);
});
test('head tracking stays within the shoulders and eyes do not blink in reduced motion',()=>{
  const bear={position:{x:0,z:0},rotation:{y:0}};
  assert.equal(lookAtBearTarget(bear,{x:0,z:-3}),0);
  assert.ok(lookAtBearTarget(bear,{x:2,z:2})<=.42);
  assert.ok(lookAtBearTarget(bear,{x:-2,z:2})<0);
  assert.ok(bearBlink(.49)<.1);assert.equal(bearBlink(.49,0,true),1);
  assert.notEqual(bearBlink(.49,0),bearBlink(.49,2.2));
});
