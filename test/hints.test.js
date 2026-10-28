const {test}=require('node:test'),assert=require('node:assert/strict'),{WORDS}=require('../words'),{getHint,revealsWord}=require('../hints');
test('every word has a word-related clue without its answer or category-only fallback',()=>{
 let count=0;for(const [category,words]of Object.entries(WORDS))for(const word of words){const hint=getHint(word,category);assert.equal(typeof hint,'string',category+': '+word);assert.ok(hint.length>=8&&hint.length<=120);assert.notEqual(hint,category);assert.equal(revealsWord(word,hint),false,word);count++}assert.equal(count,534);
 assert.equal(getHint('Osh','Oziq-ovqat'),'Guruch, sabzi va katta davra');assert.notEqual(getHint('Rayhon','Mashhurlar'),getHint('Rayhon','Tabiat va sayohat'));assert.notEqual(getHint('Paxtakor','Sport va o‘yinlar'),getHint('Paxtakor','Kasblar'));assert.equal(getHint('__proto__','Oziq-ovqat'),null);assert.equal(getHint('Unknown','Unknown'),null);assert.equal(revealsWord('Osh','Bu OSH haqida'),true);
});
