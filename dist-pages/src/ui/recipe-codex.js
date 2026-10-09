// A searchable, fully data-driven 3×3 illustrated recipe book.
export function install(S){
  const panel=document.getElementById('recipeCodex'),openBtn=document.getElementById('recipeBookBtn'),closeBtn=document.getElementById('closeRecipeCodex'),list=document.getElementById('codexRecipes'),search=document.getElementById('codexSearch'),all=document.getElementById('codexAll'),ready=document.getElementById('codexReady');
  S.recipeCodexOpen=false;S.codexReadyOnly=false;
  S.closeRecipeCodex=function(){S.recipeCodexOpen=false;panel.classList.add('hidden');openBtn.classList.remove('active');};
  S.openRecipeCodex=function(){if(!S.inventoryOpen)return;S.recipeCodexOpen=true;panel.classList.remove('hidden');openBtn.classList.add('active');S.refreshRecipeCodex();search.focus();};
  S.refreshRecipeCodex=function(){
    if(!S.recipeCodexOpen)return;
    list.replaceChildren();const q=(search.value||'').toLocaleLowerCase('pl').trim();
    let shown=0;
    for(let index=0;index<S.recipes.length;index++){
      const r=S.recipes[index],out=Object.keys(r.out)[0],available=S.canFillCraftRecipe(r);
      if(S.codexReadyOnly&&!available)continue;
      const ingredients=S.recipeIngredients(r),keywords=r.name+' '+out+' '+ingredients.map(v=>S.recipeLabel(v.spec)).join(' ');
      if(q&&!keywords.toLocaleLowerCase('pl').includes(q))continue;
      shown++;
      const entry=document.createElement('article');entry.className='codex-entry'+(available?' available':'');
      const icon=document.createElement('div');icon.className='codex-product';icon.append(S.itemIconCanvas(out));
      const info=document.createElement('div');info.className='codex-description';
      const title=document.createElement('strong');title.textContent=r.name;
      const cost=document.createElement('small');cost.textContent=S.requirementTextForRecipe(r);
      const grid=document.createElement('div');grid.className='codex-pattern';
      const pat=r.pattern||[];const glyph=(r.shapeless?Object.entries(r.shapeless).flatMap(([key,n])=>Array(n).fill(key)):null);
      for(let y=0;y<3;y++)for(let x=0;x<3;x++){
        const cell=document.createElement('div');cell.className='codex-cell';
        let id;
        if(glyph)id=glyph[y*3+x];
        else {const row=pat[y]||'';const character=row[x]||' ';const raw=r.key?.[character];id=Array.isArray(raw)?raw[0]:raw;}
        if(id){cell.append(S.itemIconCanvas(id));cell.title=S.itemDefs[id]?.name||id;}
        grid.append(cell);
      }
      const action=document.createElement('button');action.textContent=available?'UŁÓŻ →':'BRAK MATERIAŁÓW';action.disabled=!available;
      action.onclick=()=>{S.closeRecipeCodex();S.fillCraftFromRecipe(r);};
      info.append(title,cost,action);entry.append(icon,grid,info);list.append(entry);
    }
    if(!shown){const empty=document.createElement('p');empty.className='codex-empty';empty.textContent='Brak receptur dla tych filtrów.';list.append(empty);}
    all.classList.toggle('active',!S.codexReadyOnly);ready.classList.toggle('active',S.codexReadyOnly);
  };
  openBtn.onclick=()=>S.recipeCodexOpen?S.closeRecipeCodex():S.openRecipeCodex();
  closeBtn.onclick=S.closeRecipeCodex;
  search.addEventListener('input',S.refreshRecipeCodex);
  all.onclick=()=>{S.codexReadyOnly=false;S.refreshRecipeCodex();};
  ready.onclick=()=>{S.codexReadyOnly=true;S.refreshRecipeCodex();};
}
