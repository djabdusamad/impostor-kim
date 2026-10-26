(function(root){
 function resolve(ids,impostors,eliminated,votes){
  const dead=new Set(eliminated),active=ids.filter(id=>!dead.has(id));
  const counts=Object.fromEntries(ids.map(id=>[id,0]));
  for(const id of votes)if(active.includes(id))counts[id]++;
  const max=Math.max(0,...active.map(id=>counts[id]));
  const leaders=active.filter(id=>counts[id]===max);
  const target=max>0&&leaders.length===1?leaders[0]:null;
  if(target!==null)dead.add(target);
  const remaining=ids.filter(id=>!dead.has(id));
  const bad=remaining.filter(id=>impostors.includes(id)).length;
  const good=remaining.length-bad;
  return {counts,target,eliminated:[...dead],winner:bad===0?'civilians':bad>=good?'impostors':null};
 }
 const api={resolve};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundRules=api;
})(typeof globalThis!=='undefined'?globalThis:this);
